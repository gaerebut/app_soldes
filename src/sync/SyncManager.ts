/**
 * Sync Manager
 * Orchestrates synchronization between client and server
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { getDatabase } from '../database/db';
import { apiClient } from '../api/client';
import DeviceRegistry from './DeviceRegistry';
import SyncQueue from './SyncQueue';
import ConflictResolver from './ConflictResolver';
import { SyncChange, SyncMetadata, SyncPushRequest, SyncPushResponse, SyncPullResponse } from './types';

const SYNC_METADATA_KEY = 'dlc_sync_metadata';
const SYNC_INTERVAL = 5 * 1000; // 5 seconds

class SyncManager {
  private static instance: SyncManager;
  private deviceRegistry: DeviceRegistry;
  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private appStateSubscription: any = null;

  private constructor() {
    this.deviceRegistry = DeviceRegistry.getInstance();
  }

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  /**
   * Initialize sync manager
   */
  async initialize(): Promise<void> {
    try {
      // Initialize device registry
      await this.deviceRegistry.initialize();

      // Set up periodic sync
      this.setupPeriodicSync();

      // Listen for app state changes
      this.setupAppStateListener();
    } catch (error) {
      console.error('SyncManager.initialize error:', error);
    }
  }

  /**
   * Setup periodic synchronization
   */
  private setupPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.sync().catch((error) => console.error('Periodic sync error:', error));
    }, SYNC_INTERVAL);
  }

  /**
   * Listen for app foreground/background
   */
  private setupAppStateListener(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }

    this.appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // App came to foreground, trigger sync
        this.sync().catch((error) => console.error('Foreground sync error:', error));
      }
    });
  }

  /**
   * Enqueue a database change
   * This is called by database operations (add, update, delete)
   */
  async enqueueChange(
    tableName: 'products' | 'checks' | 'aisles',
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    entityId: number,
    data: Record<string, any>
  ): Promise<void> {
    try {
      await SyncQueue.enqueue(tableName, operation, entityId, data);
      // Update pending count
      await this.updateSyncMetadata();
    } catch (error) {
      console.error('SyncManager.enqueueChange error:', error);
    }
  }

  /**
   * Perform full synchronization
   */
  async sync(): Promise<void> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return;
    }

    this.isSyncing = true;

    try {
      // Step 0: Register device on server (first time)
      await this.registerDevice();

      // Step 1: Push local changes
      await this.pushChanges();

      // Step 2: Pull server changes
      await this.pullChanges();

      // Step 3: Update metadata
      await this.updateSyncMetadata();
    } catch (error) {
      console.error('SyncManager.sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Register device on server
   */
  private async registerDevice(): Promise<void> {
    try {
      const deviceId = this.deviceRegistry.getDeviceId();
      const deviceName = this.deviceRegistry.getDeviceName();
      const appVersion = this.deviceRegistry.getAppVersion();

      await apiClient.sync.registerDevice(deviceId, deviceName, appVersion);
    } catch (error) {
      console.error('SyncManager.registerDevice error:', error);
      // Non-fatal error, continue with sync
    }
  }

  /**
   * Push local changes to server
   */
  private async pushChanges(): Promise<void> {
    try {
      const pending = await SyncQueue.getPending();
      if (pending.length === 0) {
        return; // Nothing to push
      }

      // Get device info
      const deviceId = this.deviceRegistry.getDeviceId();
      const appVersion = this.deviceRegistry.getAppVersion();

      // Add version info to changes
      const changes = pending.map((change) => ({
        ...change,
        version: change.version + 1,
        device_id: deviceId,
      }));

      const request: SyncPushRequest = {
        device_id: deviceId,
        changes,
      };

      // Send to server
      const response = await this.apiPush(request);

      // Mark applied changes as synced
      const appliedIds = response.applied.map((item) => {
        // Find corresponding queue item
        const queueItem = pending.find((p) => p.entity_id === item.entity_id);
        return queueItem?.id ?? 0;
      });

      if (appliedIds.length > 0) {
        await SyncQueue.markSynced(appliedIds.filter((id) => id > 0));
      }

      // Handle conflicts (log for now, UI will show later)
      if (response.conflicts.length > 0) {
        console.warn(`${response.conflicts.length} conflicts detected`);
        response.conflicts.forEach((conflict) => {
          console.warn(`Conflict on entity ${conflict.entity_id}`);
        });
      }

      // Handle errors
      if (response.errors.length > 0) {
        for (const error of response.errors) {
          await SyncQueue.markError(error.entity_id, error.error);
        }
      }
    } catch (error) {
      console.error('SyncManager.pushChanges error:', error);
    }
  }

  /**
   * Pull server changes and merge locally
   */
  private async pullChanges(): Promise<void> {
    try {
      const metadata = await this.getSyncMetadata();
      const deviceId = this.deviceRegistry.getDeviceId();

      // Fetch changes since last sync
      const response = await this.apiPull(deviceId, metadata.last_sync);

      // Merge changes into local database
      for (const change of response.changes) {
        await this.mergeServerChange(change);
      }

      // Update last sync timestamp
      await AsyncStorage.setItem(SYNC_METADATA_KEY, JSON.stringify({
        last_sync: response.timestamp,
        last_sync_version: response.count,
        pending_count: await SyncQueue.getPendingCount(),
      }));
    } catch (error) {
      console.error('SyncManager.pullChanges error:', error);
    }
  }

  /**
   * Merge a server change into local database
   */
  private async mergeServerChange(change: SyncChange): Promise<void> {
    const db = await getDatabase();
    if (!db) return;

    try {
      // Get current local entity
      let localEntity = null;
      if (change.table === 'products') {
        const results = await db.getAllAsync(`SELECT * FROM products WHERE id = ?`, [change.entity_id]);
        localEntity = results?.[0] ?? null;
      } else if (change.table === 'checks') {
        const results = await db.getAllAsync(`SELECT * FROM checks WHERE id = ?`, [change.entity_id]);
        localEntity = results?.[0] ?? null;
      } else if (change.table === 'aisles') {
        const results = await db.getAllAsync(`SELECT * FROM aisles WHERE id = ?`, [change.entity_id]);
        localEntity = results?.[0] ?? null;
      }

      // Merge using LWW strategy
      let mergedData = change.data;
      if (localEntity) {
        mergedData = ConflictResolver.merge(localEntity, change.data, change.timestamp);
      }

      // Update database using raw SQL to avoid prepareAsync issues on Android
      try {
        if (change.operation === 'DELETE') {
          // Soft delete
          const sql = `UPDATE ${change.table} SET is_deleted = 1, updated_at = '${change.timestamp}' WHERE id = ${change.entity_id}`;
          await db.execAsync(sql);
        } else if (localEntity) {
          // Update with merged data
          const updateParts: string[] = [];
          for (const [key, value] of Object.entries(mergedData)) {
            if (value === null || value === undefined) {
              updateParts.push(`${key} = NULL`);
            } else if (typeof value === 'string') {
              updateParts.push(`${key} = '${value.replace(/'/g, "''")}'`);
            } else {
              updateParts.push(`${key} = ${value}`);
            }
          }
          const sql = `UPDATE ${change.table} SET ${updateParts.join(', ')}, version = ${change.version}, device_id = '${change.device_id}', updated_at = '${change.timestamp}' WHERE id = ${change.entity_id}`;
          await db.execAsync(sql);
        } else {
          // Insert new record
          const cols = Object.keys(mergedData);
          const values: string[] = [];
          for (const col of cols) {
            const value = mergedData[col];
            if (value === null || value === undefined) {
              values.push('NULL');
            } else if (typeof value === 'string') {
              values.push(`'${value.replace(/'/g, "''")}'`);
            } else {
              values.push(String(value));
            }
          }
          const sql = `INSERT INTO ${change.table} (${cols.join(', ')}, version, device_id, updated_at, created_at) VALUES (${values.join(', ')}, ${change.version}, '${change.device_id}', '${change.timestamp}', datetime('now'))`;
          await db.execAsync(sql);
        }
      } catch (sqlError) {
        console.error(`SQL error for ${change.table}:`, sqlError);
      }
    } catch (error) {
      console.error(`SyncManager.mergeServerChange error (${change.table}):`, error);
    }
  }

  /**
   * Get sync metadata
   */
  async getSyncMetadata(): Promise<SyncMetadata> {
    try {
      const data = await AsyncStorage.getItem(SYNC_METADATA_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('SyncManager.getSyncMetadata error:', error);
    }

    return {
      last_sync: null,
      last_sync_version: 0,
      pending_count: 0,
    };
  }

  /**
   * Update sync metadata
   */
  private async updateSyncMetadata(): Promise<void> {
    try {
      const pending = await SyncQueue.getPendingCount();
      const metadata: SyncMetadata = {
        last_sync: new Date().toISOString(),
        last_sync_version: 1,
        pending_count: pending,
      };

      await AsyncStorage.setItem(SYNC_METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('SyncManager.updateSyncMetadata error:', error);
    }
  }

  /**
   * API call: Push changes to server
   */
  private async apiPush(request: SyncPushRequest): Promise<SyncPushResponse> {
    try {
      return await apiClient.sync.push(request.device_id, request.changes);
    } catch (error) {
      console.error('SyncManager.apiPush error:', error);
      // Return empty response on error (will retry on next sync)
      return {
        applied: [],
        conflicts: [],
        errors: request.changes.map((change) => ({
          entity_id: change.entity_id,
          error: 'Network error or server unavailable',
        })),
        timestamp: new Date().toISOString(),
        version: 0,
      };
    }
  }

  /**
   * API call: Pull changes from server
   */
  private async apiPull(deviceId: string, since: string | null): Promise<SyncPullResponse> {
    try {
      return await apiClient.sync.pull(deviceId, since, 100);
    } catch (error) {
      console.error('SyncManager.apiPull error:', error);
      // Return empty response on error (will retry on next sync)
      return {
        changes: [],
        timestamp: new Date().toISOString(),
        count: 0,
        has_more: false,
      };
    }
  }

  /**
   * Full Push: Send all local data to server
   * Used when one device has lots of data to sync
   */
  async fullPush(): Promise<void> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return;
    }

    this.isSyncing = true;

    try {
      console.log('📤 Starting full push of local data to server...');

      // Register device
      await this.registerDevice();

      const db = await getDatabase();
      if (!db) throw new Error('Database not available');

      const deviceId = this.deviceRegistry.getDeviceId();

      // Get ALL local data
      const products = await db.getAllAsync('SELECT * FROM products');
      const checks = await db.getAllAsync('SELECT * FROM checks');
      const aisles = await db.getAllAsync('SELECT * FROM aisles');

      // Convert to sync changes format
      const changes: SyncChange[] = [];

      // Add aisles
      for (const aisle of aisles) {
        changes.push({
          table: 'aisles',
          operation: 'CREATE',
          entity_id: aisle.id,
          version: 1,
          device_id: deviceId,
          data: aisle,
          created_at: new Date().toISOString(),
        });
      }

      // Add products
      for (const product of products) {
        changes.push({
          table: 'products',
          operation: 'CREATE',
          entity_id: product.id,
          version: 1,
          device_id: deviceId,
          data: product,
          created_at: new Date().toISOString(),
        });
      }

      // Add checks
      for (const check of checks) {
        changes.push({
          table: 'checks',
          operation: 'CREATE',
          entity_id: check.id,
          version: 1,
          device_id: deviceId,
          data: check,
          created_at: new Date().toISOString(),
        });
      }

      console.log(`📦 Sending ${changes.length} items to server...`);

      // Send all changes to server
      const request: SyncPushRequest = {
        device_id: deviceId,
        changes,
      };

      const response = await this.apiPush(request);

      console.log(`✅ Server accepted ${response.applied.length} items`);
      if (response.conflicts.length > 0) {
        console.warn(`⚠️ ${response.conflicts.length} conflicts detected`);
      }
      if (response.errors.length > 0) {
        console.error(`❌ ${response.errors.length} errors`);
      }

      // Update metadata
      await this.updateSyncMetadata();
    } catch (error) {
      console.error('❌ Full push error:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Full Pull: Replace local data with server data
   * Used when syncing to a new device
   */
  async fullPull(): Promise<void> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return;
    }

    this.isSyncing = true;

    try {
      console.log('📥 Starting full pull from server...');

      // Register device
      await this.registerDevice();

      const db = await getDatabase();
      if (!db) throw new Error('Database not available');

      // Get all data from server (with no "since" parameter for full sync)
      const response = await this.apiPull(this.deviceRegistry.getDeviceId(), null);

      console.log(`📦 Received ${response.count} items from server`);

      // Clear local database
      console.log('🗑️ Clearing local database...');
      await db.execAsync('DELETE FROM checks;');
      await db.execAsync('DELETE FROM products;');
      await db.execAsync('DELETE FROM aisles;');

      // Insert all server data
      let aisleCount = 0;
      let productCount = 0;
      let checkCount = 0;

      for (const change of response.changes) {
        try {
          const data = change.data;

          if (change.table === 'aisles') {
            const sql = `INSERT OR REPLACE INTO aisles (id, name, order_index, created_at)
                         VALUES (${data.id}, '${data.name.replace(/'/g, "''")}', ${data.order_index || 0}, '${data.created_at}')`;
            await db.execAsync(sql);
            aisleCount++;
          } else if (change.table === 'products') {
            const sql = `INSERT OR REPLACE INTO products (id, name, barcode, category, image_uri, initial_expiry_date, aisle_id, created_at)
                         VALUES (${data.id}, '${data.name.replace(/'/g, "''")}', ${data.barcode ? `'${data.barcode.replace(/'/g, "''")}'` : 'NULL'},
                         '${data.category || 'Autre'}', ${data.image_uri ? `'${data.image_uri.replace(/'/g, "''")}'` : 'NULL'},
                         ${data.initial_expiry_date ? `'${data.initial_expiry_date}'` : 'NULL'}, ${data.aisle_id || 'NULL'}, '${data.created_at}')`;
            await db.execAsync(sql);
            productCount++;
          } else if (change.table === 'checks') {
            const sql = `INSERT OR REPLACE INTO checks (id, product_id, check_date, status, next_expiry_date, created_at)
                         VALUES (${data.id}, ${data.product_id}, '${data.check_date}', '${data.status}',
                         ${data.next_expiry_date ? `'${data.next_expiry_date}'` : 'NULL'}, '${data.created_at}')`;
            await db.execAsync(sql);
            checkCount++;
          }
        } catch (error) {
          console.error(`Error inserting ${change.table}:`, error, change);
        }
      }

      console.log(`✅ Inserted: ${aisleCount} aisles, ${productCount} products, ${checkCount} checks`);

      // Clear sync queue since we just did full pull
      await db.execAsync('DELETE FROM sync_queue');

      // Update metadata
      await AsyncStorage.setItem(SYNC_METADATA_KEY, JSON.stringify({
        last_sync: response.timestamp,
        last_sync_version: response.count,
        pending_count: 0,
      }));

      console.log('✅ Full pull completed successfully');
    } catch (error) {
      console.error('❌ Full pull error:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
  }
}

export default SyncManager;
