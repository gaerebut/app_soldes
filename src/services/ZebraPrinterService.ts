import { BleManager, Device, State } from 'react-native-ble-plx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, PermissionsAndroid } from 'react-native';

// Zebra Link-OS BLE GATT profile (ZQ620 / ZD series)
const ZEBRA_SERVICE = '38EB4A80-C570-11E3-9507-0002A5D5C51B';
const ZEBRA_WRITE_CHAR = '38EB4A82-C570-11E3-9507-0002A5D5C51B';

const STORAGE_DEVICE_ID = 'zebra_ble_id';
const STORAGE_NAME = 'zebra_name';
const STORAGE_DISCOUNT = 'zebra_discount';

const SCAN_TIMEOUT_MS = 15000;

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

function zplToBase64(chunk: string): string {
  // Safe base64 for ZPL (ASCII + Latin-1 for French accents)
  let bin = '';
  for (let i = 0; i < chunk.length; i++) {
    bin += String.fromCharCode(chunk.charCodeAt(i) & 0xff);
  }
  return btoa(bin);
}

class ZebraPrinterService {
  private manager = new BleManager();
  private connectedDevice: Device | null = null;
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<StateListener>();
  private initialized = false;

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
      await PermissionsAndroid.request(
        'android.permission.ACCESS_FINE_LOCATION' as any,
      );
    }
  }

  private waitForBleReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sub = this.manager.onStateChange((s) => {
        if (s === State.PoweredOn) {
          sub.remove();
          resolve();
        } else if (s === State.PoweredOff || s === State.Unauthorized) {
          sub.remove();
          reject(new Error('Bluetooth désactivé ou non autorisé'));
        }
      }, true);
    });
  }

  async startScan(): Promise<void> {
    await this.requestAndroidPermissions();
    await this.waitForBleReady();

    this.state.isScanning = true;
    this.state.foundDevices = [];
    this.notify();

    this.manager.startDeviceScan(null, { allowDuplicates: false }, (_err, device) => {
      if (!device) return;
      const name = device.name || device.localName || '';
      if (!name) return;
      const n = name.toLowerCase();
      if (n.includes('zebra') || n.includes('zq') || n.includes('zd') || n.includes('zt')) {
        if (!this.state.foundDevices.find(d => d.id === device.id)) {
          this.state.foundDevices = [
            ...this.state.foundDevices,
            { id: device.id, name, rssi: device.rssi ?? 0 },
          ];
          this.notify();
        }
      }
    });

    this.scanTimer = setTimeout(() => this.stopScan(), SCAN_TIMEOUT_MS);
  }

  stopScan(): void {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.state.isScanning) {
      this.manager.stopDeviceScan();
      this.state.isScanning = false;
      this.notify();
    }
  }

  async connect(deviceId: string, deviceName: string): Promise<void> {
    this.stopScan();
    this.state.isConnecting = true;
    this.notify();
    try {
      let device = await this.manager.connectToDevice(deviceId, { requestMTU: 512 });
      device = await device.discoverAllServicesAndCharacteristics();

      device.onDisconnected(() => {
        this.connectedDevice = null;
        this.state.isConnected = false;
        this.notify();
      });

      this.connectedDevice = device;
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
      await this.connectedDevice?.cancelConnection();
    } catch { /* ignore */ }
    this.connectedDevice = null;
    this.state.isConnected = false;
    this.notify();
  }

  async print(zpl: string): Promise<void> {
    if (!this.connectedDevice || !this.state.isConnected) {
      throw new Error('Imprimante non connectée');
    }
    this.state.isPrinting = true;
    this.notify();
    try {
      const mtu = this.connectedDevice.mtu ?? 512;
      const chunkSize = Math.max(20, mtu - 3);
      for (let i = 0; i < zpl.length; i += chunkSize) {
        const b64 = zplToBase64(zpl.substring(i, i + chunkSize));
        await this.connectedDevice.writeCharacteristicWithResponseForService(
          ZEBRA_SERVICE,
          ZEBRA_WRITE_CHAR,
          b64,
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
