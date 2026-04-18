/**
 * Conflict Resolver
 * Handles merge logic and conflict detection on client side
 */

import { SyncChange } from './types';

class ConflictResolver {
  /**
   * Merge server changes into local data using Last-Write-Wins (LWW)
   */
  static merge(
    localEntity: Record<string, any>,
    serverEntity: Record<string, any>,
    serverTimestamp: string
  ): Record<string, any> {
    const merged = { ...localEntity };

    // Skip system fields
    const systemFields = ['id', 'version', 'device_id', 'created_at'];

    Object.keys(serverEntity).forEach((key) => {
      if (systemFields.includes(key)) {
        return;
      }

      const localValue = localEntity[key];
      const serverValue = serverEntity[key];

      // If values differ, keep server version (already latest by LWW on server)
      if (localValue !== serverValue) {
        merged[key] = serverValue;
      }
    });

    return merged;
  }

  /**
   * Detect if there's a true conflict
   * (same field modified by different devices at same time)
   */
  static detectConflict(
    localChange: SyncChange,
    serverEntity: Record<string, any>,
    serverTimestamp: string
  ): boolean {
    if (!serverEntity) {
      return false; // No server entity = no conflict
    }

    const localTime = new Date(localChange.timestamp).getTime();
    const serverTime = new Date(serverTimestamp).getTime();

    // If server is newer, no conflict
    if (serverTime > localTime) {
      return false;
    }

    // If local is clearly newer, no conflict
    if (localTime > serverTime + 1000) {
      // More than 1 second newer
      return false;
    }

    // Check if same field was modified
    const modifiedFields = Object.keys(localChange.data).filter(
      (key) => serverEntity[key] !== localChange.data[key] && key !== 'updated_at'
    );

    return modifiedFields.length > 0;
  }

  /**
   * Calculate merge strategy for a change
   * Returns: 'apply', 'reject', or 'conflict'
   */
  static calculateStrategy(
    localChange: SyncChange,
    serverEntity: Record<string, any> | null,
    serverTimestamp: string
  ): 'apply' | 'reject' | 'conflict' {
    if (!serverEntity) {
      return 'apply'; // New entity
    }

    if (localChange.operation === 'DELETE') {
      return 'apply'; // Delete takes priority
    }

    const localTime = new Date(localChange.timestamp).getTime();
    const serverTime = new Date(serverTimestamp).getTime();

    // Last-Write-Wins: newer timestamp wins
    if (localTime > serverTime) {
      return 'apply';
    } else if (localTime < serverTime) {
      return 'reject';
    }

    // Same timestamp: check if true conflict
    if (this.detectConflict(localChange, serverEntity, serverTimestamp)) {
      return 'conflict';
    }

    return 'apply'; // No conflict detected
  }

  /**
   * Log conflict for user review
   */
  static logConflict(
    entityId: number,
    entityType: string,
    localValue: any,
    serverValue: any,
    field: string
  ): void {
    console.warn(`
      Conflict detected!
      Entity: ${entityType} #${entityId}
      Field: ${field}
      Local: ${JSON.stringify(localValue)}
      Server: ${JSON.stringify(serverValue)}
    `);
  }
}

export default ConflictResolver;
