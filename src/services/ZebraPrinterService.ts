import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_ADDRESS = 'zebra_address';
const STORAGE_NAME = 'zebra_name';
const STORAGE_DISCOUNT = 'zebra_discount';

type StateListener = () => void;

export interface PairedDevice {
  address: string;
  name: string;
}

export interface PrinterState {
  savedAddress: string | null;
  savedName: string | null;
  discount: number;
  isConnected: boolean;
  isConnecting: boolean;
  isPrinting: boolean;
}

function getBT(): any {
  try {
    return require('react-native-bluetooth-classic').default;
  } catch {
    return null;
  }
}

class ZebraPrinterService {
  private state: PrinterState = {
    savedAddress: null,
    savedName: null,
    discount: 50,
    isConnected: false,
    isConnecting: false,
    isPrinting: false,
  };
  private connectedDevice: any = null;
  private listeners: Set<StateListener> = new Set();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    const [addr, name, disc] = await Promise.all([
      AsyncStorage.getItem(STORAGE_ADDRESS),
      AsyncStorage.getItem(STORAGE_NAME),
      AsyncStorage.getItem(STORAGE_DISCOUNT),
    ]);
    this.state.savedAddress = addr;
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
    this.listeners.forEach((fn) => fn());
  }

  async getPairedDevices(): Promise<PairedDevice[]> {
    const BT = getBT();
    if (!BT) throw new Error('Module Bluetooth non disponible.\nUne compilation native est requise (expo prebuild).');
    const devices = await BT.getBondedDevices();
    return (devices as any[]).map((d) => ({ address: d.address, name: d.name || d.address }));
  }

  async connect(address: string, name: string): Promise<void> {
    const BT = getBT();
    if (!BT) throw new Error('Module Bluetooth non disponible.\nUne compilation native est requise (expo prebuild).');
    this.state.isConnecting = true;
    this.notify();
    try {
      this.connectedDevice = await BT.connectToDevice(address);
      this.state.isConnected = true;
      this.state.savedAddress = address;
      this.state.savedName = name;
      await Promise.all([
        AsyncStorage.setItem(STORAGE_ADDRESS, address),
        AsyncStorage.setItem(STORAGE_NAME, name),
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
      if (this.connectedDevice) {
        await this.connectedDevice.disconnect();
      }
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
      await this.connectedDevice.write(zpl);
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
