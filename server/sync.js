/**
 * Sync Module
 * Handles bidirectional synchronization between clients and server
 */

/**
 * Create sync routes
 * @param {express.Router} router - Express router
 * @param {Database} db - better-sqlite3 database instance
 * @param {ConflictResolver} conflictResolver - Conflict resolver instance
 * @param {DeviceRegistry} deviceRegistry - Device registry instance
 * @returns {void}
 */
function createSyncRoutes(router, db, conflictResolver, deviceRegistry) {
  /**
   * Register or update device
   * POST /api/sync/device/register
   */
  router.post('/api/sync/device/register', (req, res) => {
    const { device_id, device_name, app_version } = req.body;

    if (!device_id) {
      return res.status(400).json({ error: 'device_id is required' });
    }

    const result = deviceRegistry.registerDevice(
      device_id,
      device_name || 'Unknown Device',
      app_version || 'unknown'
    );

    res.json(result);
  });

  /**
   * Push changes from client to server
   * POST /api/sync/push
   * Body: { device_id, changes: [{table, operation, entity_id, data, timestamp, version}] }
   */
  router.post('/api/sync/push', (req, res) => {
    const { device_id, changes } = req.body;

    if (!device_id || !Array.isArray(changes)) {
      return res.status(400).json({ error: 'device_id and changes array are required' });
    }

    const applied = [];
    const conflicts = [];
    const errors = [];

    // Process each change
    changes.forEach((change) => {
      try {
        const result = processSyncChange(db, conflictResolver, deviceRegistry, device_id, change);

        if (result.status === 'applied') {
          applied.push({
            entity_id: change.entity_id,
            version: result.version,
            action: result.action,
          });
        } else if (result.status === 'conflict') {
          conflicts.push({
            entity_id: change.entity_id,
            entity_type: change.table,
            device_id,
            server_version: result.serverVersion,
            conflict_id: result.conflictId,
          });
        } else {
          errors.push({
            entity_id: change.entity_id,
            error: result.error,
          });
        }
      } catch (error) {
        errors.push({
          entity_id: change.entity_id,
          error: error.message,
        });
      }
    });

    // Update device sync metadata
    const timestamp = new Date().toISOString();
    const maxVersion = Math.max(...changes.map((c) => c.version || 0), 0);
    deviceRegistry.updateSyncMetadata(device_id, timestamp, maxVersion);

    res.json({
      applied,
      conflicts,
      errors,
      timestamp,
      version: maxVersion,
    });
  });

  /**
   * Pull changes from server
   * GET /api/sync/pull?device_id=xxx&since=2025-04-17T10:00:00Z&limit=100
   */
  router.get('/api/sync/pull', (req, res) => {
    const { device_id, since, limit = 100 } = req.query;

    if (!device_id) {
      return res.status(400).json({ error: 'device_id is required' });
    }

    const changes = [];

    if (since) {
      // Incremental sync: fetch changes since timestamp
      const changesSince = db
        .prepare(
          `SELECT * FROM sync_history
         WHERE created_at > ?
         ORDER BY created_at ASC
         LIMIT ?`
        )
        .all(since, parseInt(limit));

      changesSince.forEach((row) => {
        changes.push({
          table: row.table_name,
          operation: row.operation,
          entity_id: row.entity_id,
          data: JSON.parse(row.data_after),
          timestamp: row.timestamp,
          version: row.version,
          device_id: row.device_id,
        });
      });
    } else {
      // Full sync: fetch all current entities
      const products = db.prepare('SELECT * FROM products LIMIT ?').all(parseInt(limit));
      const checks = db.prepare('SELECT * FROM checks LIMIT ?').all(parseInt(limit));
      const aisles = db.prepare('SELECT * FROM aisles LIMIT ?').all(parseInt(limit));

      products.forEach((p) => {
        changes.push({
          table: 'products',
          operation: 'CREATE',
          entity_id: p.id || p.ean, // Backward compat: use id if present, else ean
          data: p,
          timestamp: p.updated_at || p.created_at,
          version: p.version || 0,
          device_id: p.device_id || 'server',
        });
      });

      checks.forEach((c) => {
        changes.push({
          table: 'checks',
          operation: 'CREATE',
          entity_id: c.id,
          data: c,
          timestamp: c.updated_at || c.created_at,
          version: c.version || 0,
          device_id: c.device_id || 'server',
        });
      });

      aisles.forEach((a) => {
        changes.push({
          table: 'aisles',
          operation: 'CREATE',
          entity_id: a.id,
          data: a,
          timestamp: a.updated_at || a.created_at,
          version: a.version || 0,
          device_id: a.device_id || 'server',
        });
      });
    }

    res.json({
      changes,
      timestamp: new Date().toISOString(),
      count: changes.length,
      has_more: changes.length === parseInt(limit),
    });
  });

  /**
   * Resolve a conflict (user choice)
   * POST /api/sync/conflict-resolve/:conflict_id
   */
  router.post('/api/sync/conflict-resolve/:conflict_id', (req, res) => {
    const { conflict_id } = req.params;
    const { chosen_version } = req.body; // 'device_a' or 'device_b'

    if (!['device_a', 'device_b'].includes(chosen_version)) {
      return res.status(400).json({ error: 'chosen_version must be "device_a" or "device_b"' });
    }

    conflictResolver.resolveConflict(parseInt(conflict_id), chosen_version);

    res.json({
      resolved: true,
      conflict_id: parseInt(conflict_id),
      chosen_version,
    });
  });

  /**
   * Get sync status
   * GET /api/sync/status?device_id=xxx
   */
  router.get('/api/sync/status', (req, res) => {
    const { device_id } = req.query;

    if (!device_id) {
      return res.status(400).json({ error: 'device_id is required' });
    }

    const metadata = deviceRegistry.getSyncMetadata(device_id);
    const conflicts = conflictResolver.getPendingConflicts();

    res.json({
      ...metadata,
      pending_conflicts: conflicts.filter((c) => !c.resolved_at),
    });
  });

  /**
   * Get all devices
   * GET /api/sync/devices
   */
  router.get('/api/sync/devices', (req, res) => {
    const devices = deviceRegistry.getAllDevices();
    res.json({ devices });
  });

  /**
   * Get sync history
   * GET /api/sync/history?device_id=xxx&limit=50
   */
  router.get('/api/sync/history', (req, res) => {
    const { device_id, limit = 50 } = req.query;
    const history = deviceRegistry.getSyncHistory(device_id, parseInt(limit));
    res.json({ history, count: history.length });
  });
}

/**
 * Process a single sync change
 * @private
 */
function processSyncChange(db, conflictResolver, deviceRegistry, deviceId, change) {
  const { table, operation, entity_id, data, timestamp, version } = change;

  // Validate change
  if (!table || !operation || !entity_id) {
    throw new Error('Missing required fields: table, operation, entity_id');
  }

  // Get current server state
  let getStmt;
  switch (table) {
    case 'products':
      getStmt = db.prepare('SELECT * FROM products WHERE id = ? OR ean = ?');
      break;
    case 'checks':
      getStmt = db.prepare('SELECT * FROM checks WHERE id = ?');
      break;
    case 'aisles':
      getStmt = db.prepare('SELECT * FROM aisles WHERE id = ?');
      break;
    default:
      throw new Error(`Unknown table: ${table}`);
  }

  const serverEntity = getStmt.all(entity_id, entity_id)[0];

  // Resolve conflicts
  const resolution = conflictResolver.resolveChange(change, serverEntity);

  if (resolution.action === 'reject') {
    return {
      status: 'rejected',
      reason: resolution.reason,
      serverVersion: resolution.serverVersion,
    };
  }

  // Apply change to database
  let newVersion = (serverEntity?.version || 0) + 1;

  if (resolution.action === 'apply' || resolution.action === 'apply_with_conflict') {
    // Update or insert entity
    switch (table) {
      case 'products':
        applyProductChange(db, operation, entity_id, data, deviceId, newVersion, timestamp);
        break;
      case 'checks':
        applyCheckChange(db, operation, entity_id, data, deviceId, newVersion, timestamp);
        break;
      case 'aisles':
        applyAisleChange(db, operation, entity_id, data, deviceId, newVersion, timestamp);
        break;
    }

    // Record in sync history
    deviceRegistry.recordSyncHistory(
      deviceId,
      table,
      operation,
      entity_id,
      serverEntity || null,
      data,
      timestamp,
      newVersion
    );

    // Create conflict record if needed
    if (resolution.action === 'apply_with_conflict' && serverEntity) {
      conflictResolver.createConflictRecord(
        entity_id,
        table,
        deviceId,
        version,
        data,
        serverEntity.device_id,
        serverEntity.version,
        serverEntity,
        'lww'
      );

      return {
        status: 'applied',
        version: newVersion,
        action: 'apply_with_conflict',
        reason: resolution.reason,
      };
    }

    return {
      status: 'applied',
      version: newVersion,
      action: 'apply',
      reason: resolution.reason,
    };
  }

  return {
    status: 'error',
    error: resolution.reason,
  };
}

/**
 * Apply a product change
 * @private
 */
function applyProductChange(db, operation, entityId, data, deviceId, version, timestamp) {
  if (operation === 'DELETE') {
    // Soft delete
    db.prepare('UPDATE products SET is_deleted = 1, version = ?, device_id = ?, updated_at = ? WHERE id = ? OR ean = ?')
      .run(version, deviceId, timestamp, entityId, entityId);
  } else {
    // Create or update
    const existing = db.prepare('SELECT * FROM products WHERE id = ? OR ean = ?').get(entityId, entityId);

    if (existing) {
      db.prepare(
        `UPDATE products SET
       name = ?, barcode = ?, category = ?, initial_expiry_date = ?, aisle_id = ?,
       version = ?, device_id = ?, updated_at = ?
       WHERE id = ? OR ean = ?`
      ).run(
        data.name,
        data.barcode,
        data.category,
        data.initial_expiry_date,
        data.aisle_id,
        version,
        deviceId,
        timestamp,
        entityId,
        entityId
      );
    } else {
      db.prepare(
        `INSERT INTO products (id, name, barcode, category, initial_expiry_date, aisle_id, version, device_id, updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(entityId, data.name, data.barcode, data.category, data.initial_expiry_date, data.aisle_id, version, deviceId, timestamp, timestamp);
    }
  }
}

/**
 * Apply a check change
 * @private
 */
function applyCheckChange(db, operation, entityId, data, deviceId, version, timestamp) {
  if (operation === 'DELETE') {
    // Soft delete
    db.prepare('UPDATE checks SET is_deleted = 1, version = ?, device_id = ?, updated_at = ? WHERE id = ?')
      .run(version, deviceId, timestamp, entityId);
  } else {
    const existing = db.prepare('SELECT * FROM checks WHERE id = ?').get(entityId);

    if (existing) {
      db.prepare(
        `UPDATE checks SET
       product_id = ?, check_date = ?, status = ?, next_expiry_date = ?,
       version = ?, device_id = ?, updated_at = ?
       WHERE id = ?`
      ).run(data.product_id, data.check_date, data.status, data.next_expiry_date, version, deviceId, timestamp, entityId);
    } else {
      db.prepare(
        `INSERT INTO checks (id, product_id, check_date, status, next_expiry_date, version, device_id, updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        entityId,
        data.product_id,
        data.check_date,
        data.status,
        data.next_expiry_date,
        version,
        deviceId,
        timestamp,
        timestamp
      );
    }
  }
}

/**
 * Apply an aisle change
 * @private
 */
function applyAisleChange(db, operation, entityId, data, deviceId, version, timestamp) {
  if (operation === 'DELETE') {
    // Soft delete
    db.prepare('UPDATE aisles SET is_deleted = 1, version = ?, device_id = ?, updated_at = ? WHERE id = ?')
      .run(version, deviceId, timestamp, entityId);
  } else {
    const existing = db.prepare('SELECT * FROM aisles WHERE id = ?').get(entityId);

    if (existing) {
      db.prepare(
        `UPDATE aisles SET
       name = ?, order_index = ?,
       version = ?, device_id = ?, updated_at = ?
       WHERE id = ?`
      ).run(data.name, data.order_index, version, deviceId, timestamp, entityId);
    } else {
      db.prepare(
        `INSERT INTO aisles (id, name, order_index, version, device_id, updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(entityId, data.name, data.order_index, version, deviceId, timestamp, timestamp);
    }
  }
}

module.exports = createSyncRoutes;
