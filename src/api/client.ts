import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_URL_KEY = 'dlc_server_url';
const DEFAULT_SERVER_URL = 'http://187.124.215.103';

let cachedServerUrl: string | null = null;

async function getServerUrl(): Promise<string> {
  if (cachedServerUrl) return cachedServerUrl;
  const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
  cachedServerUrl = stored || DEFAULT_SERVER_URL;
  return cachedServerUrl;
}

export async function setServerUrl(url: string): Promise<void> {
  cachedServerUrl = url;
  await AsyncStorage.setItem(SERVER_URL_KEY, url);
}

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('dlc_auth_token');
}

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const [serverUrl, token] = await Promise.all([getServerUrl(), getToken()]);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(`${serverUrl}${path}`, { ...options, headers });
}

export const apiClient = {
  // Auth
  async login(login: string, password: string): Promise<{ token?: string; error?: string }> {
    const serverUrl = await getServerUrl();
    const res = await fetch(`${serverUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || 'Erreur de connexion' };
    return { token: data.token };
  },

  // Products
  async getProducts(): Promise<any[]> {
    const res = await authFetch('/api/products');
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },

  async createProduct(ean: string, name: string, initialExpiryDate?: string): Promise<any> {
    const res = await authFetch('/api/products', {
      method: 'POST',
      body: JSON.stringify({ ean, name, initial_expiry_date: initialExpiryDate }),
    });
    if (!res.ok) throw new Error('Failed to create product');
    return res.json();
  },

  async deleteProduct(ean: string): Promise<void> {
    const res = await authFetch(`/api/products/${ean}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete product');
  },

  // Checks
  async createCheck(ean: string, checkDate: string, status: 'ok' | 'rupture', nextExpiryDate?: string): Promise<any> {
    const res = await authFetch('/api/checks', {
      method: 'POST',
      body: JSON.stringify({ ean, check_date: checkDate, status, next_expiry_date: nextExpiryDate }),
    });
    if (!res.ok) throw new Error('Failed to create check');
    return res.json();
  },

  async getChecksForDate(date: string): Promise<any[]> {
    const res = await authFetch(`/api/checks?date=${date}`);
    if (!res.ok) throw new Error('Failed to fetch checks');
    return res.json();
  },

  async getCheckHistory(ean: string): Promise<any[]> {
    const res = await authFetch(`/api/checks/product/${ean}`);
    if (!res.ok) throw new Error('Failed to fetch check history');
    return res.json();
  },

  // Photos
  async uploadPhoto(ean: string, fileUri: string): Promise<{ image_version: number }> {
    const serverUrl = await getServerUrl();
    const token = await getToken();
    const formData = new FormData();
    formData.append('photo', {
      uri: fileUri,
      type: 'image/jpeg',
      name: `${ean}.jpg`,
    } as any);

    const res = await fetch(`${serverUrl}/api/photos/upload/${ean}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload photo');
    return res.json();
  },

  async getPhotoUrl(ean: string): Promise<string> {
    const serverUrl = await getServerUrl();
    return `${serverUrl}/api/photos/${ean}`;
  },

  async getPhotoVersion(ean: string): Promise<number> {
    const res = await authFetch(`/api/photos/${ean}/version`);
    if (!res.ok) return 0;
    const data = await res.json();
    return data.image_version || 0;
  },

  // Sync - Legacy endpoints (kept for compatibility)
  async fullSync(): Promise<{ products: any[]; checks: any[]; aisles: any[]; timestamp: string }> {
    const res = await authFetch('/api/sync/full');
    if (!res.ok) throw new Error('Failed to sync');
    return res.json();
  },

  async syncChanges(since: string): Promise<{ products: any[]; checks: any[]; timestamp: string }> {
    const res = await authFetch(`/api/sync/changes?since=${encodeURIComponent(since)}`);
    if (!res.ok) throw new Error('Failed to sync changes');
    return res.json();
  },

  // Sync - New endpoints (multi-device)
  sync: {
    /**
     * Register or update device on server
     */
    async registerDevice(deviceId: string, deviceName: string, appVersion: string): Promise<any> {
      const res = await authFetch('/api/sync/device/register', {
        method: 'POST',
        body: JSON.stringify({ device_id: deviceId, device_name: deviceName, app_version: appVersion }),
      });
      if (!res.ok) throw new Error('Failed to register device');
      return res.json();
    },

    /**
     * Push local changes to server
     */
    async push(deviceId: string, changes: any[]): Promise<any> {
      const res = await authFetch('/api/sync/push', {
        method: 'POST',
        body: JSON.stringify({ device_id: deviceId, changes }),
      });
      if (!res.ok) throw new Error('Failed to push changes');
      return res.json();
    },

    /**
     * Pull changes from server
     */
    async pull(deviceId: string, since?: string, limit: number = 100): Promise<any> {
      const params = new URLSearchParams({ device_id: deviceId, limit: limit.toString() });
      if (since) {
        params.append('since', since);
      }
      const res = await authFetch(`/api/sync/pull?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to pull changes');
      return res.json();
    },

    /**
     * Resolve a conflict (user choice)
     */
    async resolveConflict(conflictId: number, chosenVersion: 'device_a' | 'device_b'): Promise<any> {
      const res = await authFetch(`/api/sync/conflict-resolve/${conflictId}`, {
        method: 'POST',
        body: JSON.stringify({ chosen_version: chosenVersion }),
      });
      if (!res.ok) throw new Error('Failed to resolve conflict');
      return res.json();
    },

    /**
     * Get sync status for device
     */
    async getStatus(deviceId: string): Promise<any> {
      const res = await authFetch(`/api/sync/status?device_id=${deviceId}`);
      if (!res.ok) throw new Error('Failed to get sync status');
      return res.json();
    },

    /**
     * Get list of registered devices
     */
    async getDevices(): Promise<any> {
      const res = await authFetch('/api/sync/devices');
      if (!res.ok) throw new Error('Failed to get devices');
      return res.json();
    },

    /**
     * Get sync history
     */
    async getHistory(deviceId?: string, limit: number = 50): Promise<any> {
      let url = `/api/sync/history?limit=${limit}`;
      if (deviceId) {
        url += `&device_id=${deviceId}`;
      }
      const res = await authFetch(url);
      if (!res.ok) throw new Error('Failed to get sync history');
      return res.json();
    },
  },
};
