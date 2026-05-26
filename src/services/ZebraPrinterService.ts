import BleManager from 'react-native-ble-manager';
import {
  NativeEventEmitter, NativeModules, Platform,
  PermissionsAndroid, EmitterSubscription,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Zebra Link-OS BLE GATT profile (ZQ620 / ZD series)
const ZEBRA_SERVICE = '38EB4A80-C570-11E3-9507-0002A5D5C51B';
const ZEBRA_WRITE_CHAR = '38EB4A82-C570-11E3-9507-0002A5D5C51B';

const STORAGE_DEVICE_ID = 'zebra_ble_id';
const STORAGE_NAME = 'zebra_name';
const STORAGE_DISCOUNT = 'zebra_discount';

const SCAN_SECONDS = 15;

type StateListener = () => void;

export interface FoundDevice {
  id: string;
  name: string;
  rssi: number;
}

export interface PrinterState {
  savedDeviceId: string | null;
  savedName: string | null;
  discount: number;
  isConnected: boolean;
  isConnecting: boolean;
  isPrinting: boolean;
  isScanning: boolean;
  foundDevices: FoundDevice[];
}

class ZebraPrinterService {
  private connectedDeviceId: string | null = null;
  private currentMTU = 185;
  private subs: EmitterSubscription[] = [];
  private listeners = new Set<StateListener>();
  private initialized = false;
  private bleAvailable = false;

  private state: PrinterState = {
    savedDeviceId: null,
    savedName: null,
    discount: 50,
    isConnected: false,
    isConnecting: false,
    isPrinting: false,
    isScanning: false,
    foundDevices: [],
  };

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const [id, name, disc] = await Promise.all([
      AsyncStorage.getItem(STORAGE_DEVICE_ID),
      AsyncStorage.getItem(STORAGE_NAME),
      AsyncStorage.getItem(STORAGE_DISCOUNT),
    ]);
    this.state.savedDeviceId = id;
    this.state.savedName = name;
    this.state.discount = disc ? parseInt(disc, 10) : 50;

    try {
      if (!NativeModules.BleManager) {
        this.notify();
        return;
      }

      const bleEmitter = new NativeEventEmitter(NativeModules.BleManager);
      await BleManager.start({ showAlert: false });
      this.bleAvailable = true;

      this.subs.push(
        bleEmitter.addListener('BleManagerDiscoverPeripheral', (p: any) => {
          const name = p.name || p.advertising?.localName || '';
          if (!name) return;
          const n = name.toLowerCase();
          if (n.includes('zebra') || n.includes('zq') || n.includes('zd') || n.includes('zt')) {
            if (!this.state.foundDevices.find(d => d.id === p.id)) {
              this.state.foundDevices = [
                ...this.state.foundDevices,
                { id: p.id, name, rssi: p.rssi ?? 0 },
              ];
              this.notify();
            }
          }
        }),
        bleEmitter.addListener('BleManagerStopScan', () => {
          if (this.state.isScanning) {
            this.state.isScanning = false;
            this.notify();
          }
        }),
        bleEmitter.addListener('BleManagerDisconnectPeripheral', (data: any) => {
          if (data.peripheral === this.connectedDeviceId) {
            this.connectedDeviceId = null;
            this.state.isConnected = false;
            this.notify();
          }
        }),
      );
    } catch (e) {
      // BLE unavailable (simulator, permissions denied at OS level, etc.)
    }

    this.notify();
  }

  getState(): PrinterState {
    return { ...this.state };
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  private async requestAndroidPermissions(): Promise<void> {
    if (Platform.OS !== 'android') return;
    if ((Platform.Version as number) >= 31) {
      await PermissionsAndroid.requestMultiple([
        'android.permission.BLUETOOTH_SCAN' as any,
        'android.permission.BLUETOOTH_CONNECT' as any,
      ]);
    } else {
      await PermissionsAndroid.request('android.permission.ACCESS_FINE_LOCATION' as any);
    }
  }

  async startScan(): Promise<void> {
    if (!this.bleAvailable) throw new Error('Bluetooth non disponible sur cet appareil');
    await this.requestAndroidPermissions();
    this.state.isScanning = true;
    this.state.foundDevices = [];
    this.notify();
    await BleManager.scan([], SCAN_SECONDS, false);
  }

  stopScan(): void {
    if (this.state.isScanning) {
      BleManager.stopScan();
      this.state.isScanning = false;
      this.notify();
    }
  }

  async connect(deviceId: string, deviceName: string): Promise<void> {
    if (!this.bleAvailable) throw new Error('Bluetooth non disponible sur cet appareil');
    this.stopScan();
    this.state.isConnecting = true;
    this.notify();
    try {
      await BleManager.connect(deviceId);
      await BleManager.retrieveServices(deviceId);
      try {
        this.currentMTU = await BleManager.requestMTU(deviceId, 512);
      } catch {
        this.currentMTU = 185;
      }
      this.connectedDeviceId = deviceId;
      this.state.isConnected = true;
      this.state.savedDeviceId = deviceId;
      this.state.savedName = deviceName;
      await Promise.all([
        AsyncStorage.setItem(STORAGE_DEVICE_ID, deviceId),
        AsyncStorage.setItem(STORAGE_NAME, deviceName),
      ]);
    } catch (e) {
      this.state.isConnected = false;
      throw e;
    } finally {
      this.state.isConnecting = false;
      this.notify();
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.connectedDeviceId) await BleManager.disconnect(this.connectedDeviceId);
    } catch { /* ignore */ }
    this.connectedDeviceId = null;
    this.state.isConnected = false;
    this.notify();
  }

  async print(zpl: string): Promise<void> {
    if (!this.connectedDeviceId || !this.state.isConnected) {
      throw new Error('Imprimante non connectée');
    }
    this.state.isPrinting = true;
    this.notify();
    try {
      const bytes = Array.from(zpl).map(c => c.charCodeAt(0) & 0xff);
      const chunkSize = Math.max(20, this.currentMTU - 3);
      for (let i = 0; i < bytes.length; i += chunkSize) {
        await BleManager.write(
          this.connectedDeviceId,
          ZEBRA_SERVICE,
          ZEBRA_WRITE_CHAR,
          bytes.slice(i, i + chunkSize),
        );
      }
    } finally {
      this.state.isPrinting = false;
      this.notify();
    }
  }

  async setDiscount(pct: number): Promise<void> {
    const clamped = Math.max(10, Math.min(80, Math.round(pct / 5) * 5));
    this.state.discount = clamped;
    await AsyncStorage.setItem(STORAGE_DISCOUNT, String(clamped));
    this.notify();
  }
}

export const zebraPrinterService = new ZebraPrinterService();
