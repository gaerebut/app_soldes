import { getDatabase } from './db';

export interface Aisle {
  id: number;
  name: string;
  order_index: number;
  created_at: string;
}

export interface AisleWithProductCount extends Aisle {
  productCount: number;
}

// Get all aisles ordered by order_index
export async function getAllAisles(): Promise<Aisle[]> {
  const db = await getDatabase();
  if (!db) return [];
  const aisles = await db.getAllAsync<Aisle>(
    'SELECT * FROM aisles ORDER BY order_index ASC'
  );
  return aisles || [];
}

// Get all aisles with product count
export async function getAllAislesWithCount(): Promise<AisleWithProductCount[]> {
  const db = await getDatabase();
  if (!db) return [];
  const aisles = await db.getAllAsync<AisleWithProductCount>(
    `SELECT a.*, COUNT(p.id) as productCount
     FROM aisles a
     LEFT JOIN products p ON a.id = p.aisle_id
     GROUP BY a.id
     ORDER BY a.order_index ASC`
  );
  return aisles || [];
}

// Get aisle by ID
export async function getAisleById(id: number): Promise<Aisle | null> {
  const db = await getDatabase();
  if (!db) return null;
  const aisle = await db.getFirstAsync<Aisle>(
    'SELECT * FROM aisles WHERE id = ?',
    [id]
  );
  return aisle || null;
}

// Create new aisle
export async function createAisle(name: string): Promise<number> {
  const db = await getDatabase();
  if (!db) return -1;
  // Get the highest order_index
  const result = await db.getFirstAsync<{ max_order: number | null }>(
    'SELECT MAX(order_index) as max_order FROM aisles'
  );
  const nextOrder = (result?.max_order ?? -1) + 1;

  const insertResult = await db.runAsync(
    'INSERT INTO aisles (name, order_index) VALUES (?, ?)',
    [name, nextOrder]
  );
  return insertResult.lastInsertRowId;
}

// Update aisle name
export async function updateAisleName(id: number, name: string): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  await db.runAsync('UPDATE aisles SET name = ? WHERE id = ?', [name, id]);
}

// Delete aisle and transfer products to "unnamed" aisle
export async function deleteAisleWithTransfer(id: number): Promise<void> {
  const db = await getDatabase();
  if (!db) return;

  // Check if aisle has products
  const count = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM products WHERE aisle_id = ?',
    [id]
  );

  if ((count?.count ?? 0) > 0) {
    // Create or get unnamed aisle
    const unnamedAisle = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM aisles WHERE name = ? ORDER BY id ASC LIMIT 1',
      ['']
    );

    let unnamedId: number;
    if (unnamedAisle) {
      unnamedId = unnamedAisle.id;
    } else {
      // Create unnamed aisle with highest order
      const result = await db.getFirstAsync<{ max_order: number | null }>(
        'SELECT MAX(order_index) as max_order FROM aisles'
      );
      const nextOrder = (result?.max_order ?? -1) + 1;
      const insertResult = await db.runAsync(
        'INSERT INTO aisles (name, order_index) VALUES (?, ?)',
        ['', nextOrder]
      );
      unnamedId = insertResult.lastInsertRowId;
    }

    // Transfer products to unnamed aisle
    await db.runAsync(
      'UPDATE products SET aisle_id = ? WHERE aisle_id = ?',
      [unnamedId, id]
    );
  }

  // Delete the aisle
  await db.runAsync('DELETE FROM aisles WHERE id = ?', [id]);
}

// Reorder aisles (drag and drop)
export async function reorderAisles(aisleIds: number[]): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  for (let i = 0; i < aisleIds.length; i++) {
    await db.runAsync(
      'UPDATE aisles SET order_index = ? WHERE id = ?',
      [i, aisleIds[i]]
    );
  }
}

// Get products count for an aisle
export async function getAisleProductCount(aisleId: number): Promise<number> {
  const db = await getDatabase();
  if (!db) return 0;
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM products WHERE aisle_id = ?',
    [aisleId]
  );
  return result?.count ?? 0;
}

// Get unnamed aisle or create it
export async function getOrCreateUnnamedAisle(): Promise<number> {
  const db = await getDatabase();
  if (!db) return -1;
  const unnamed = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM aisles WHERE name = ? LIMIT 1',
    ['']
  );

  if (unnamed) {
    return unnamed.id;
  }

  // Create it with highest order
  const result = await db.getFirstAsync<{ max_order: number | null }>(
    'SELECT MAX(order_index) as max_order FROM aisles'
  );
  const nextOrder = (result?.max_order ?? -1) + 1;
  const insertResult = await db.runAsync(
    'INSERT INTO aisles (name, order_index) VALUES (?, ?)',
    ['', nextOrder]
  );
  return insertResult.lastInsertRowId;
}
