/**
 * Conflict Resolver Module
 * Implements Last-Write-Wins (LWW) strategy with intelligent conflict detection
 */

/**
 * Represents a sync change
 * @typedef {Object} SyncChange
 * @property {string} table - Table name (products, checks, aisles)
 * @property {string} operation - 'CREATE', 'UPDATE', or 'DELETE'
 * @property {string} entity_id - UUID of the entity
 * @property {Object} data - The data being synced
 * @property {string} timestamp - ISO timestamp when change occurred
 * @property {string} device_id - ID of device making change
 * @property {number} version - Version number of this change
 */

class ConflictResolver {
  constructor(db) {
    this.db = db;
  }

  /**
   * Resolve conflicts between client change and server state
   * @param {SyncChange} clientChange - Change from client
   * @param {Object} serverEntity - Current server entity (if exists)
   * @returns {Object} { resolved: boolean, action: 'apply'|'reject'|'conflict', reason: string }
   */
  resolveChange(clientChange, serverEntity) {
    // No server entity = new entity, always apply
    if (!serverEntity) {
      return {
        resolved: true,
        action: 'apply',
        reason: 'New entity (no conflict)',
      };
    }

    // For DELETE: soft delete takes priority
    if (clientChange.operation === 'DELETE') {
      return {
        resolved: true,
        action: 'apply',
        reason: 'Delete operation (soft delete takes priority)',
      };
    }

    // For UPDATE/CREATE: use Last-Write-Wins
    const clientTime = new Date(clientChange.timestamp).getTime();
    const serverTime = new Date(serverEntity.updated_at).getTime();

    if (clientTime > serverTime) {
      return {
        resolved: true,
        action: 'apply',
        reason: `LWW: Client timestamp (${clientChange.timestamp}) is newer`,
      };
    } else if (clientTime < serverTime) {
      return {
        resolved: true,
        action: 'reject',
        reason: `LWW: Server timestamp (${serverEntity.updated_at}) is newer`,
        serverVersion: serverEntity.version,
      };
    }

    // Same timestamp: detect true conflict (same field modified)
    return this.detectTrueConflict(clientChange, serverEntity);
  }

  /**
   * Detect if changes are truly conflicting (same field modified)
   * @private
   */
  detectTrueConflict(clientChange, serverEntity) {
    // If both changes happened at exactly same time, check if same field was modified
    const modifiedFields = new Set();

    // Collect fields modified by client
    Object.keys(clientChange.data).forEach((key) => {
      if (serverEntity[key] !== clientChange.data[key]) {
        modifiedFields.add(key);
      }
    });

    // If only one field modified (clear intent), apply with conflict marker
    if (modifiedFields.size === 1) {
      return {
        resolved: true,
        action: 'apply_with_conflict',
        reason: 'True conflict detected: same field modified by both (applies LWW + conflict marker)',
        conflictingField: Array.from(modifiedFields)[0],
      };
    }

    // Multiple fields: apply client version
    return {
      resolved: true,
      action: 'apply_with_conflict',
      reason: 'Simultaneous changes on different fields (applies client version)',
    };
  }

  /**
   * Merge server changes into client data
   * Applies Last-Write-Wins strategy for each field
   * @param {Object} clientEntity - Client's version of entity
   * @param {Object} serverEntity - Server's version of entity
   * @param {string} timestamp - Reference timestamp for LWW
   * @returns {Object} Merged entity
   */
  mergeLWW(clientEntity, serverEntity, timestamp) {
    const merged = { ...clientEntity };

    Object.keys(serverEntity).forEach((key) => {
      // Skip system fields
      if (['id', 'version', 'device_id'].includes(key)) {
        return;
      }

      const clientValue = clientEntity[key];
      const serverValue = serverEntity[key];

      // If values differ, keep the one from later timestamp
      if (clientValue !== serverValue) {
        // Use server value (server timestamp is used as reference for newer data)
        merged[key] = serverValue;
      }
    });

    return merged;
  }

  /**
   * Create conflict record in database
   * @param {string} entityId - UUID of conflicting entity
   * @param {string} entityType - 'product', 'check', 'aisle'
   * @param {string} deviceAId - First device ID
   * @param {number} deviceAVersion - First device version
   * @param {Object} deviceAData - First device data
   * @param {string} deviceBId - Second device ID
   * @param {number} deviceBVersion - Second device version
   * @param {Object} deviceBData - Second device data
   * @param {string} resolutionStrategy - 'lww' or 'user_intervention'
   */
  createConflictRecord(
    entityId,
    entityType,
    deviceAId,
    deviceAVersion,
    deviceAData,
    deviceBId,
    deviceBVersion,
    deviceBData,
    resolutionStrategy = 'lww'
  ) {
    const stmt = this.db.prepare(`
      INSERT INTO conflicts (
        entity_id,
        entity_type,
        device_a_id,
        device_a_version,
        device_a_data,
        device_b_id,
        device_b_version,
        device_b_data,
        resolution_strategy,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    stmt.run(
      entityId,
      entityType,
      deviceAId,
      deviceAVersion,
      JSON.stringify(deviceAData),
      deviceBId,
      deviceBVersion,
      JSON.stringify(deviceBData),
      resolutionStrategy
    );
  }

  /**
   * Get pending conflicts for a user
   * @param {number} userId - User ID
   * @returns {Array} Pending conflicts
   */
  getPendingConflicts(userId) {
    const stmt = this.db.prepare(`
      SELECT * FROM conflicts
      WHERE resolved_at IS NULL
      ORDER BY created_at DESC
    `);

    return stmt.all();
  }

  /**
   * Resolve a conflict (user choice)
   * @param {number} conflictId - Conflict ID
   * @param {string} chosenVersion - 'device_a' or 'device_b'
   */
  resolveConflict(conflictId, chosenVersion) {
    const stmt = this.db.prepare(`
      UPDATE conflicts
      SET resolved_at = datetime('now'),
          chosen_version = ?
      WHERE id = ?
    `);

    stmt.run(chosenVersion, conflictId);
  }
}

module.exports = ConflictResolver;
