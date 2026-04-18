/**
 * Sync Queue
 * Manages offline queue of database changes
 */

import { getDatabase } from '../database/db';
import { SyncChange, SyncQueueItem } from './types';

class SyncQueue {
  /**
   * Enqueue a database change for synchronization
   */
  static async enqueue(
    tableName: 'products' | 'checks' | 'aisles',
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    entityId: number,
    data: Record<string, any>
  ): Promise<void> {
    const db = await getDatabase();
    if (!db) return; // Offline database not available

    try {
      const timestamp = new Date().toISOString();
      const dataJson = JSON.stringify(data);

      const stmt = await db.prepareAsync(`
        INSERT INTO sync_queue (table_name, operation, entity_id, data, timestamp, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `);

      await stmt.executeAsync(tableName, operation, entityId, dataJson, timestamp);
    } catch (error) {
      console.error('SyncQueue.enqueue error:', error);
    }
  }

  /**
   * Get all pending changes
   */
  static async getPending(): Promise<SyncChange[]> {
    const db = await getDatabase();
    if (!db) return [];

    try {
      const rows = await db.getAllAsync<SyncQueueItem>(`
        SELECT * FROM sync_queue WHERE synced_at IS NULL ORDER BY created_at ASC
      `);

      return rows.map((row) => ({
        table: row.table_name,
        operation: row.operation,
        entity_id: row.entity_id,
        data: JSON.parse(row.data),
        timestamp: row.timestamp,
        version: 1, // Will be updated by sync manager
      }));
    } catch (error) {
      console.error('SyncQueue.getPending error:', error);
      return [];
    }
  }

  /**
   * Mark changes as synced
   */
  static async markSynced(queueIds: number[]): Promise<void> {
    const db = await getDatabase();
    if (!db) return;

    try {
      const placeholders = queueIds.map(() => '?').join(',');
      const stmt = await db.prepareAsync(`
        UPDATE sync_queue SET synced_at = datetime('now') WHERE id IN (${placeholders})
      `);

      await stmt.executeAsync(...queueIds);
    } catch (error) {
      console.error('SyncQueue.markSynced error:', error);
    }
  }

  /**
   * Mark change as errored
   */
  static async markError(queueId: number, errorMsg: string): Promise<void> {
    const db = await getDatabase();
    if (!db) return;

    try {
      const stmt = await db.prepareAsync(`
        UPDATE sync_queue SET error = ? WHERE id = ?
      `);

      await stmt.executeAsync(errorMsg, queueId);
    } catch (error) {
      console.error('SyncQueue.markError error:', error);
    }
  }

  /**
   * Get pending count
   */
  static async getPendingCount(): Promise<number> {
    const db = await getDatabase();
    if (!db) return 0;

    try {
      const results = await db.getAllAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM sync_queue WHERE synced_at IS NULL`
      );

      return results?.[0]?.count ?? 0;
    } catch (error) {
      console.error('SyncQueue.getPendingCount error:', error);
      return 0;
    }
  }

  /**
   * Clear all synced items
   */
  static async clearSynced(): Promise<void> {
    const db = await getDatabase();
    if (!db) return;

    try {
      await db.execAsync(`DELETE FROM sync_queue WHERE synced_at IS NOT NULL`);
    } catch (error) {
      console.error('SyncQueue.clearSynced error:', error);
    }
  }

  /**
   * Clear errors (for retry)
   */
  static async clearErrors(): Promise<void> {
    const db = await getDatabase();
    if (!db) return;

    try {
      await db.execAsync(`UPDATE sync_queue SET error = NULL WHERE error IS NOT NULL`);
    } catch (error) {
      console.error('SyncQueue.clearErrors error:', error);
    }
  }

  /**
   * Clear all queue items (used for full resync)
   */
  static async clear(): Promise<void> {
    const db = await getDatabase();
    if (!db) return;

    try {
      await db.execAsync(`DELETE FROM sync_queue`);
    } catch (error) {
      console.error('SyncQueue.clear error:', error);
    }
  }
}

export default SyncQueue;
