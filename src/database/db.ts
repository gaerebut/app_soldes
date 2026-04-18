import { Platform } from 'react-native';

let db: any = null;
let SQLite: any = null;

// Only import expo-sqlite on native platforms
if (Platform.OS !== 'web') {
  SQLite = require('expo-sqlite');
}

export async function getDatabase(): Promise<any> {
  if (!SQLite) {
    console.warn('Database not available on web platform');
    return null;
  }

  if (db) return db;
  db = await SQLite.openDatabaseAsync('dlc_manager.db');

  try {
    await db.execAsync(`PRAGMA journal_mode = WAL;`);
  } catch (err) {
    console.error('WAL mode error:', err);
  }

  // Create tables one by one
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS aisles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  } catch (err) {
    console.error('Create aisles table error:', err);
  }

  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        barcode TEXT,
        category TEXT NOT NULL DEFAULT 'Autre',
        image_uri TEXT,
        initial_expiry_date TEXT,
        aisle_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (aisle_id) REFERENCES aisles(id) ON DELETE SET NULL
      );
    `);
  } catch (err) {
    console.error('Create products table error:', err);
  }

  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        check_date TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('ok', 'rupture')),
        next_expiry_date TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );
    `);
  } catch (err) {
    console.error('Create checks table error:', err);
  }

  // Create indexes
  try {
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_checks_date ON checks(check_date);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_checks_product ON checks(product_id);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_products_aisle ON products(aisle_id);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_aisles_order ON aisles(order_index);`);
  } catch (err) {
    console.error('Create indexes error:', err);
  }

  // Migrations for existing databases
  try {
    // Vérifier les colonnes existantes
    const columns = await db.getAllAsync<any>(`PRAGMA table_info(products)`);
    const columnNames = columns.map((col: any) => col.name);

    if (!columnNames.includes('image_uri')) {
      await db.execAsync(`ALTER TABLE products ADD COLUMN image_uri TEXT;`);
    }
    if (!columnNames.includes('initial_expiry_date')) {
      await db.execAsync(`ALTER TABLE products ADD COLUMN initial_expiry_date TEXT;`);
    }
    if (!columnNames.includes('aisle_id')) {
      await db.execAsync(`ALTER TABLE products ADD COLUMN aisle_id INTEGER;`);
    }
  } catch (err) {
    console.error('Migration error:', err);
  }

  // Migration: add previous_expiry_date to checks
  try {
    const checkColumns = await db.getAllAsync<any>(`PRAGMA table_info(checks)`);
    const checkColumnNames = checkColumns.map((col: any) => col.name);
    if (!checkColumnNames.includes('previous_expiry_date')) {
      await db.execAsync(`ALTER TABLE checks ADD COLUMN previous_expiry_date TEXT;`);
    }
  } catch (err) {
    console.error('Migration checks error:', err);
  }

  // Migration: add sync columns to products
  try {
    const productColumns = await db.getAllAsync<any>(`PRAGMA table_info(products)`);
    const productColumnNames = productColumns.map((col: any) => col.name);

    if (!productColumnNames.includes('version')) {
      await db.execAsync(`ALTER TABLE products ADD COLUMN version INTEGER DEFAULT 0;`);
    }
    if (!productColumnNames.includes('device_id')) {
      await db.execAsync(`ALTER TABLE products ADD COLUMN device_id TEXT DEFAULT 'local';`);
    }
    if (!productColumnNames.includes('updated_at')) {
      await db.execAsync(`ALTER TABLE products ADD COLUMN updated_at TEXT;`);
    }
    if (!productColumnNames.includes('is_deleted')) {
      await db.execAsync(`ALTER TABLE products ADD COLUMN is_deleted INTEGER DEFAULT 0;`);
    }
  } catch (err) {
    console.error('Migration products sync columns error:', err);
  }

  // Migration: add sync columns to checks
  try {
    const checkColumns = await db.getAllAsync<any>(`PRAGMA table_info(checks)`);
    const checkColumnNames = checkColumns.map((col: any) => col.name);

    if (!checkColumnNames.includes('version')) {
      await db.execAsync(`ALTER TABLE checks ADD COLUMN version INTEGER DEFAULT 0;`);
    }
    if (!checkColumnNames.includes('device_id')) {
      await db.execAsync(`ALTER TABLE checks ADD COLUMN device_id TEXT DEFAULT 'local';`);
    }
    if (!checkColumnNames.includes('updated_at')) {
      await db.execAsync(`ALTER TABLE checks ADD COLUMN updated_at TEXT;`);
    }
    if (!checkColumnNames.includes('is_deleted')) {
      await db.execAsync(`ALTER TABLE checks ADD COLUMN is_deleted INTEGER DEFAULT 0;`);
    }
  } catch (err) {
    console.error('Migration checks sync columns error:', err);
  }

  // Migration: add sync columns to aisles
  try {
    const aisleColumns = await db.getAllAsync<any>(`PRAGMA table_info(aisles)`);
    const aisleColumnNames = aisleColumns.map((col: any) => col.name);

    if (!aisleColumnNames.includes('version')) {
      await db.execAsync(`ALTER TABLE aisles ADD COLUMN version INTEGER DEFAULT 0;`);
    }
    if (!aisleColumnNames.includes('device_id')) {
      await db.execAsync(`ALTER TABLE aisles ADD COLUMN device_id TEXT DEFAULT 'local';`);
    }
    if (!aisleColumnNames.includes('updated_at')) {
      await db.execAsync(`ALTER TABLE aisles ADD COLUMN updated_at TEXT;`);
    }
    if (!aisleColumnNames.includes('is_deleted')) {
      await db.execAsync(`ALTER TABLE aisles ADD COLUMN is_deleted INTEGER DEFAULT 0;`);
    }
  } catch (err) {
    console.error('Migration aisles sync columns error:', err);
  }

  // Create sync metadata table
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        last_sync TEXT,
        last_sync_version INTEGER DEFAULT 0,
        pending_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  } catch (err) {
    console.error('Create sync_metadata table error:', err);
  }

  // Create sync queue table (for offline changes)
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        operation TEXT NOT NULL,
        entity_id INTEGER,
        data TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        synced_at TEXT,
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  } catch (err) {
    console.error('Create sync_queue table error:', err);
  }

  // Add getFirstAsync method if it doesn't exist
  if (!db.getFirstAsync) {
    db.getFirstAsync = async function(sql: string, params?: any[]) {
      const results = await this.getAllAsync(sql, params);
      return results?.[0] ?? null;
    };
  }

  return db;
}
