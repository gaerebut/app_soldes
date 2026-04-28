import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'dlc_device_id';
const SERVER_URL_KEY = 'dlc_server_url';
const DEFAULT_SERVER_URL = 'https://dlc-manager.cloud';
const OBSOLETE_URLS = [
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://187.124.215.103:3000',
  'http://dlc-manager.cloud',
  'http://dlc-manager.cloud/',
  'https://dlc-manager.cloud/',
];

let cachedServerUrl: string | null = null;
let _onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: () => void): void {
  _onUnauthorized = fn;
}

function isValidServerUrl(url: string): boolean {
  return /^https?:\/\/.+/.test(url);
}

export async function getServerUrl(): Promise<string> {
  if (cachedServerUrl) return cachedServerUrl;
  const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
  const clean = stored ? stored.replace(/\/+$/, '') : null;
  if (!clean || !isValidServerUrl(clean) || OBSOLETE_URLS.includes(clean)) {
    cachedServerUrl = DEFAULT_SERVER_URL;
    await AsyncStorage.setItem(SERVER_URL_KEY, DEFAULT_SERVER_URL);
  } else {
    cachedServerUrl = clean;
  }
  return cachedServerUrl;
}

export async function setServerUrl(url: string): Promise<void> {
  const clean = url.replace(/\/+$/, '');
  cachedServerUrl = clean;
  await AsyncStorage.setItem(SERVER_URL_KEY, clean);
}

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('dlc_auth_token');
}

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const [serverUrl, token, deviceId] = await Promise.all([
    getServerUrl(),
    getToken(),
    AsyncStorage.getItem(DEVICE_ID_KEY),
  ]);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (deviceId) headers['X-Device-Id'] = deviceId;
  const res = await fetch(`${serverUrl}${path}`, { ...options, headers });
  if (res.status === 401) {
    await AsyncStorage.removeItem('dlc_auth_token');
    _onUnauthorized?.();
  }
  return res;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
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

  async loginAsDevice(deviceId: string, deviceName: string): Promise<{ token?: string; error?: string }> {
    const serverUrl = await getServerUrl();
    const url = `${serverUrl}/api/auth/device`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, deviceName }),
    });
    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch {}
    if (!res.ok) return { error: data.error || `Erreur serveur (${res.status})` };
    if (!data.token) return { error: 'Réponse invalide du serveur' };
    return { token: data.token };
  },

  async ping(): Promise<boolean> {
    try {
      const serverUrl = await getServerUrl();
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(`${serverUrl}/api/ping`, { signal: ctrl.signal });
      clearTimeout(t);
      return res.ok;
    } catch {
      return false;
    }
  },

  // Aisles
  aisles: {
    async list(): Promise<any[]> {
      return jsonOrThrow(await authFetch('/api/aisles'));
    },
    async create(name: string): Promise<any> {
      return jsonOrThrow(
        await authFetch('/api/aisles', { method: 'POST', body: JSON.stringify({ name }) })
      );
    },
    async update(id: number, name: string): Promise<any> {
      return jsonOrThrow(
        await authFetch(`/api/aisles/${id}`, { method: 'PUT', body: JSON.stringify({ name }) })
      );
    },
    async delete(id: number): Promise<void> {
      await jsonOrThrow(await authFetch(`/api/aisles/${id}`, { method: 'DELETE' }));
    },
    async reorder(ids: number[]): Promise<void> {
      await jsonOrThrow(
        await authFetch('/api/aisles/reorder', { method: 'POST', body: JSON.stringify({ ids }) })
      );
    },
  },

  // Products
  products: {
    async list(): Promise<any[]> {
      return jsonOrThrow(await authFetch('/api/products'));
    },
    async get(id: number): Promise<any> {
      return jsonOrThrow(await authFetch(`/api/products/${id}`));
    },
    async findByBarcode(barcode: string): Promise<any | null> {
      return jsonOrThrow(await authFetch(`/api/products?barcode=${encodeURIComponent(barcode)}`));
    },
    async create(payload: {
      name: string;
      category?: string;
      barcode?: string | null;
      image_uri?: string | null;
      initial_expiry_date?: string | null;
      aisle_id?: number | null;
    }): Promise<any> {
      return jsonOrThrow(
        await authFetch('/api/products', { method: 'POST', body: JSON.stringify(payload) })
      );
    },
    async update(
      id: number,
      payload: {
        name?: string;
        category?: string;
        barcode?: string | null;
        image_uri?: string | null;
        initial_expiry_date?: string | null;
        aisle_id?: number | null;
      }
    ): Promise<any> {
      return jsonOrThrow(
        await authFetch(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      );
    },
    async delete(id: number): Promise<void> {
      await jsonOrThrow(await authFetch(`/api/products/${id}`, { method: 'DELETE' }));
    },
    async setDLC(id: number, dlc: string, today: string): Promise<void> {
      await jsonOrThrow(
        await authFetch(`/api/products/${id}/dlc`, {
          method: 'POST',
          body: JSON.stringify({ dlc, today }),
        })
      );
    },
    async uploadPhoto(id: number, fileUri: string): Promise<{ image_uri: string }> {
      const serverUrl = await getServerUrl();
      const token = await getToken();
      const formData = new FormData();
      formData.append('photo', { uri: fileUri, type: 'image/jpeg', name: `${id}.jpg` } as any);
      const res = await fetch(`${serverUrl}/api/products/${id}/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      return jsonOrThrow(res);
    },
    async photoUrl(imageUri: string | null | undefined): Promise<string | null> {
      if (!imageUri) return null;
      if (imageUri.startsWith('http')) return imageUri;
      const serverUrl = await getServerUrl();
      return `${serverUrl}${imageUri}`;
    },
  },

  // Checks
  checks: {
    async forProduct(productId: number): Promise<any[]> {
      return jsonOrThrow(await authFetch(`/api/checks/product/${productId}`));
    },
    async create(payload: {
      product_id: number;
      check_date: string;
      status: 'ok' | 'rupture';
      next_expiry_date?: string | null;
    }): Promise<any> {
      return jsonOrThrow(
        await authFetch('/api/checks', { method: 'POST', body: JSON.stringify(payload) })
      );
    },
  },

  // Devices
  devices: {
    async register(id: string, name: string): Promise<any> {
      return jsonOrThrow(
        await authFetch('/api/devices', { method: 'POST', body: JSON.stringify({ id, name }) })
      );
    },
    async rename(id: string, name: string): Promise<any> {
      return jsonOrThrow(
        await authFetch(`/api/devices/${id}`, { method: 'PUT', body: JSON.stringify({ name }) })
      );
    },
  },

  // Computed views
  views: {
    async productsForDate(date: string): Promise<any[]> {
      return jsonOrThrow(await authFetch(`/api/views/products-for-date?date=${date}`));
    },
    async overdue(today: string): Promise<any[]> {
      return jsonOrThrow(await authFetch(`/api/views/overdue?today=${today}`));
    },
    async todayExpiry(today: string): Promise<any[]> {
      return jsonOrThrow(await authFetch(`/api/views/today-expiry?today=${today}`));
    },
    async ruptures(): Promise<any[]> {
      return jsonOrThrow(await authFetch('/api/views/ruptures'));
    },
    async checkedToday(today: string): Promise<any[]> {
      return jsonOrThrow(await authFetch(`/api/views/checked-today?today=${today}`));
    },
  },
};
