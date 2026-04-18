/**
 * Device Registry
 * Manages unique device identification
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'dlc_device_id';
const DEVICE_NAME_KEY = 'dlc_device_name';

class DeviceRegistry {
  private static instance: DeviceRegistry;
  private deviceId: string | null = null;
  private deviceName: string | null = null;

  private constructor() {}

  static getInstance(): DeviceRegistry {
    if (!DeviceRegistry.instance) {
      DeviceRegistry.instance = new DeviceRegistry();
    }
    return DeviceRegistry.instance;
  }

  /**
   * Initialize device registry
   * Loads existing device ID or generates new one
   */
  async initialize(): Promise<void> {
    try {
      // Try to load existing device ID
      this.deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);

      if (!this.deviceId) {
        // Generate new device ID
        this.deviceId = await this.generateDeviceId();
        await AsyncStorage.setItem(DEVICE_ID_KEY, this.deviceId);
      }

      // Load device name (user-friendly)
      this.deviceName = await AsyncStorage.getItem(DEVICE_NAME_KEY);

      if (!this.deviceName) {
        // Generate default name
        this.deviceName = await this.generateDeviceName();
        await AsyncStorage.setItem(DEVICE_NAME_KEY, this.deviceName);
      }
    } catch (error) {
      console.error('DeviceRegistry.initialize error:', error);
      // Fallback
      this.deviceId = 'local-' + Date.now();
      this.deviceName = 'App Device';
    }
  }

  /**
   * Get current device ID
   */
  getDeviceId(): string {
    if (!this.deviceId) {
      throw new Error('Device not initialized. Call initialize() first.');
    }
    return this.deviceId;
  }

  /**
   * Get device name
   */
  getDeviceName(): string {
    return this.deviceName || 'App Device';
  }

  /**
   * Set device name (user-provided)
   */
  async setDeviceName(name: string): Promise<void> {
    this.deviceName = name;
    await AsyncStorage.setItem(DEVICE_NAME_KEY, name);
  }

  /**
   * Generate unique device ID
   * Format: {platform}-{model}-{timestamp}-{random}
   */
  private async generateDeviceId(): Promise<string> {
    try {
      const platform = Platform.OS;
      const model = Platform.OS === 'ios' ? 'iOS' : 'Android';

      // Generate random hex string
      const randomHex = Math.random().toString(16).substring(2, 10);

      const timestamp = Date.now().toString(36);
      const id = `${platform}-${model}-${timestamp}-${randomHex}`.toLowerCase();

      return id;
    } catch (error) {
      console.error('Error generating device ID:', error);
      return `local-${Date.now()}`;
    }
  }

  /**
   * Generate user-friendly device name
   */
  private async generateDeviceName(): Promise<string> {
    try {
      const platform = Platform.OS;
      const name = Platform.OS === 'ios' ? 'iPhone/iPad' : 'Android Phone';
      return `${name} (${new Date().toLocaleDateString()})`;
    } catch (error) {
      return 'My Device';
    }
  }

  /**
   * Get app version
   */
  getAppVersion(): string {
    // This would normally come from app.json or package.json
    return '1.0.0';
  }

  /**
   * Reset device ID (for testing or device reset)
   */
  async reset(): Promise<void> {
    await AsyncStorage.removeItem(DEVICE_ID_KEY);
    await AsyncStorage.removeItem(DEVICE_NAME_KEY);
    this.deviceId = null;
    this.deviceName = null;
    await this.initialize();
  }
}

export default DeviceRegistry;
