import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'dlc_device_id';
const DEVICE_NAME_KEY = 'dlc_device_name';

function generateUUID(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `${timestamp}-${random}-${Math.floor(Math.random() * 10000)}`;
}

export async function getOrCreateDeviceId(): Promise<string> {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = generateUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export async function getDeviceName(): Promise<string> {
  const name = await AsyncStorage.getItem(DEVICE_NAME_KEY);
  return name || 'Appareil mobile';
}

export async function setDeviceName(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Le nom ne peut pas être vide');
  if (trimmed.length > 30) throw new Error('Le nom ne peut pas dépasser 30 caractères');
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) {
    throw new Error('Le nom ne peut contenir que des lettres, chiffres, espaces, tirets et underscores');
  }
  await AsyncStorage.setItem(DEVICE_NAME_KEY, trimmed);
}

export async function registerDevice(apiClient: any): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  const deviceName = await getDeviceName();

  try {
    await apiClient.devices.register(deviceId, deviceName);
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de l\'appareil:', error);
  }
}
