/**
 * Device Registry Module
 * Manages device identities and sync metadata
 */

const crypto = require('crypto');

class DeviceRegistry {
  constructor(db) {
    this.db = db;
  }

  /**
   * Register or update a device
   * @param {string} deviceId - Unique device identifier (from client)
   * @param {string} deviceName - User-friendly device name
   * @param {string} appVersion - App version
   * @returns {Object} Device registration info
   */
  registerDevice(deviceId, deviceName, appVersion) {
    // Check if device exists
    const existing = this.db
      .prepare('SELECT * FROM device_registry WHERE device_id = ?')
      .get(deviceId);

    if (existing) {
      // Update last_seen
      this.db
        .prepare(
          `UPDATE device_registry
         SET device_name = ?, app_version = ?, last_seen = datetime('now')
         WHERE device_id = ?`
        )
        .run(deviceName, appVersion, deviceId);

      return {
        registered: true,
        is_new: false,
        device_id: deviceId,
        last_sync: existing.last_sync,
        last_sync_version: existing.last_sync_version,
      };
    }

    // New device
    this.db
      .prepare(
        `INSERT INTO device_registry (device_id, device_name, app_version, last_seen, created_at)
       VALUES (?, ?, ?, datetime('now'), datetime('now'))`
      )
      .run(deviceId, deviceName, appVersion);

    return {
      registered: true,
      is_new: true,
      device_id: deviceId,
      last_sync: null,
      last_sync_version: 0,
    };
  }

  /**
   * Get device info
   * @param {string} deviceId - Device ID
   * @returns {Object|null} Device info
   */
  getDevice(deviceId) {
    return this.db
      .prepare('SELECT * FROM device_registry WHERE device_id = ?')
      .get(deviceId);
  }

  /**
   * Update device sync metadata
   * @param {string} deviceId - Device ID
   * @param {string} lastSync - ISO timestamp of last sync
   * @param {number} lastSyncVersion - Version number of last sync
   */
  updateSyncMetadata(deviceId, lastSync, lastSyncVersion) {
    this.db
      .prepare(
        `UPDATE device_registry
       SET last_sync = ?, last_sync_version = ?, last_seen = datetime('now')
       WHERE device_id = ?`
      )
      .run(lastSync, lastSyncVersion, deviceId);
  }

  /**
   * Get all registered devices
   * @returns {Array} All devices
   */
  getAllDevices() {
    return this.db
      .prepare(`
        SELECT device_id, device_name, app_version, last_sync, last_sync_version, last_seen, is_active
        FROM device_registry
        ORDER BY last_seen DESC
      `)
      .all();
  }

  /**
   * Get sync metadata for sync operations
   * @param {string} deviceId - Device ID
   * @returns {Object} Sync metadata
   */
  getSyncMetadata(deviceId) {
    const device = this.getDevice(deviceId);

    if (!device) {
      return {
        device_id: deviceId,
        last_sync: null,
        last_sync_version: 0,
        pending_count: 0,
      };
    }

    // Count pending changes for this device
    const pending = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM sync_history
       WHERE device_id = ? AND synced_at IS NULL`
      )
      .get(deviceId);

    return {
      device_id: deviceId,
      last_sync: device.last_sync,
      last_sync_version: device.last_sync_version,
      pending_count: pending.count,
      last_seen: device.last_seen,
    };
  }

  /**
   * Record a sync operation in history
   * @param {string} deviceId - Device ID
   * @param {string} tableName - Table name
   * @param {string} operation - 'CREATE', 'UPDATE', 'DELETE'
   * @param {string} entityId - UUID of entity
   * @param {Object} dataBefore - Previous data (for auditing)
   * @param {Object} dataAfter - New data (for auditing)
   * @param {string} timestamp - Operation timestamp
   * @param {number} version - Change version
   */
  recordSyncHistory(
    deviceId,
    tableName,
    operation,
    entityId,
    dataBefore,
    dataAfter,
    timestamp,
    version
  ) {
    this.db
      .prepare(
        `INSERT INTO sync_history (
        device_id, table_name, operation, entity_id,
        data_before, data_after, timestamp, version, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(
        deviceId,
        tableName,
        operation,
        entityId,
        JSON.stringify(dataBefore),
        JSON.stringify(dataAfter),
        timestamp,
        version
      );
  }

  /**
   * Get sync history for auditing
   * @param {string} deviceId - Device ID (optional)
   * @param {number} limit - Limit results
   * @returns {Array} Sync history
   */
  getSyncHistory(deviceId = null, limit = 50) {
    let stmt;
    if (deviceId) {
      stmt = this.db.prepare(`
        SELECT * FROM sync_history
        WHERE device_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `);
      return stmt.all(deviceId, limit);
    }

    stmt = this.db.prepare(`
      SELECT * FROM sync_history
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }

  /**
   * Disable a device (mark as inactive)
   * @param {string} deviceId - Device ID
   */
  disableDevice(deviceId) {
    this.db
      .prepare('UPDATE device_registry SET is_active = 0 WHERE device_id = ?')
      .run(deviceId);
  }

  /**
   * Generate unique device identifier (for new devices)
   * Format: {model}-{os-version}-{random-hash}
   * @param {string} deviceModel - Device model name
   * @param {string} osVersion - OS version
   * @returns {string} Unique device ID
   */
  static generateDeviceId(deviceModel = 'unknown', osVersion = 'unknown') {
    const hash = crypto.randomBytes(8).toString('hex').substring(0, 8);
    const timestamp = Date.now().toString(36);
    return `${deviceModel}-${osVersion}-${timestamp}-${hash}`.toLowerCase();
  }
}

module.exports = DeviceRegistry;
