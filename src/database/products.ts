import { getDatabase } from './db';
import { getTodayStr, toLocalDateStr } from '../utils/date';

export interface Product {
  id: number;
  name: string;
  barcode: string | null;
  category: string;
  image_uri: string | null;
  initial_expiry_date: string | null;
  aisle_id: number | null;
  created_at: string;
}

export interface ProductWithStatus extends Product {
  last_status: string | null;
  next_expiry_date: string | null;
  previous_expiry_date: string | null;
  checked_today: boolean;
}

export async function getAllProducts(): Promise<Product[]> {
  const db = await getDatabase();
  if (!db) return [];
  return db.getAllAsync<Product>('SELECT * FROM products ORDER BY category, name');
}

/**
 * Get products whose current DLC matches the given date.
 * A product's "current DLC" is the next_expiry_date from its latest check,
 * or its initial_expiry_date if never checked.
 * Excludes products currently in rupture.
 */
export async function getProductsForDate(dateStr: string): Promise<ProductWithStatus[]> {
  const db = await getDatabase();
  if (!db) return [];
  const products = await db.getAllAsync<Product>(
    `SELECT p.* FROM products p
     LEFT JOIN aisles a ON p.aisle_id = a.id
     ORDER BY COALESCE(a.order_index, 999), p.name`
  );

  const result: ProductWithStatus[] = [];
  for (const product of products) {
    // Get latest check overall
    const lastCheck = await db.getFirstAsync<{ status: string; next_expiry_date: string | null }>(
      'SELECT status, next_expiry_date FROM checks WHERE product_id = ? ORDER BY check_date DESC, created_at DESC LIMIT 1',
      [product.id]
    );

    // Skip products in rupture
    if (lastCheck?.status === 'rupture') continue;

    // Determine current DLC
    const currentDLC = lastCheck?.next_expiry_date ?? product.initial_expiry_date;

    // Only show products whose DLC matches the selected date
    if (currentDLC !== dateStr) continue;

    // Check if already controlled for this selected date
    const dateCheck = await db.getFirstAsync<{ status: string; next_expiry_date: string | null }>(
      'SELECT status, next_expiry_date FROM checks WHERE product_id = ? AND check_date = ? ORDER BY created_at DESC LIMIT 1',
      [product.id, dateStr]
    );

    // Get the previous check before dateStr to find old DLC
    let previousDLC: string | null = null;
    if (dateCheck) {
      const prevCheck = await db.getFirstAsync<{ next_expiry_date: string | null }>(
        'SELECT next_expiry_date FROM checks WHERE product_id = ? AND check_date < ? ORDER BY check_date DESC LIMIT 1',
        [product.id, dateStr]
      );
      previousDLC = prevCheck?.next_expiry_date ?? product.initial_expiry_date;
    }

    result.push({
      ...product,
      last_status: dateCheck?.status ?? lastCheck?.status ?? null,
      next_expiry_date: dateCheck?.next_expiry_date ?? currentDLC,
      previous_expiry_date: previousDLC,
      checked_today: !!dateCheck,
    });
  }
  return result;
}

/**
 * Get products that were checked today (for the "congrats" summary).
 */
export async function getCheckedToday(): Promise<Array<ProductWithStatus & { check_status: string }>> {
  const db = await getDatabase();
  if (!db) return [];
  const today = getTodayStr();
  const checks = await db.getAllAsync<{
    product_id: number; status: string; next_expiry_date: string | null; previous_expiry_date: string | null;
  }>(
    'SELECT product_id, status, next_expiry_date, previous_expiry_date FROM checks WHERE check_date = ? ORDER BY created_at DESC',
    [today]
  );

  // Deduplicate by product_id (keep latest)
  const seen = new Set<number>();
  const uniqueChecks: typeof checks = [];
  for (const c of checks) {
    if (!seen.has(c.product_id)) {
      seen.add(c.product_id);
      uniqueChecks.push(c);
    }
  }

  const result: Array<ProductWithStatus & { check_status: string }> = [];
  for (const check of uniqueChecks) {
    // Skip checks with DLC in the past or today (these are DLC updates, not real checks)
    if (check.next_expiry_date && check.next_expiry_date <= today) {
      continue;
    }

    const product = await db.getFirstAsync<Product>(
      'SELECT * FROM products WHERE id = ?', [check.product_id]
    );
    if (!product) continue;

    // Use previous_expiry_date stored in the check (for ruptures),
    // or find the last known DLC for non-rupture checks
    let previousDLC = check.previous_expiry_date;
    if (!previousDLC) {
      const prevCheck = await db.getFirstAsync<{ next_expiry_date: string | null }>(
        `SELECT next_expiry_date FROM checks
         WHERE product_id = ? AND next_expiry_date IS NOT NULL
         ORDER BY check_date DESC, created_at DESC LIMIT 1`,
        [check.product_id]
      );
      previousDLC = prevCheck?.next_expiry_date ?? product.initial_expiry_date;
    }

    result.push({
      ...product,
      last_status: check.status,
      next_expiry_date: check.next_expiry_date,
      previous_expiry_date: previousDLC,
      checked_today: true,
      check_status: check.status,
    });
  }
  return result;
}

export async function addProduct(
  name: string,
  category: string,
  barcode?: string,
  imageUri?: string,
  initialExpiryDate?: string,
  aisleId?: number,
): Promise<number> {
  const db = await getDatabase();
  if (!db) return -1;
  const result = await db.runAsync(
    'INSERT INTO products (name, category, barcode, image_uri, initial_expiry_date, aisle_id) VALUES (?, ?, ?, ?, ?, ?)',
    [name, category, barcode ?? null, imageUri ?? null, initialExpiryDate ?? null, aisleId ?? null]
  );
  return result.lastInsertRowId;
}

export async function updateProduct(id: number, name: string, category: string, barcode?: string, imageUri?: string, aisleId?: number): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  await db.runAsync(
    'UPDATE products SET name = ?, category = ?, barcode = ?, image_uri = ?, aisle_id = ? WHERE id = ?',
    [name, category, barcode ?? null, imageUri ?? null, aisleId ?? null, id]
  );
}

export async function deleteProduct(id: number): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  await db.runAsync('DELETE FROM checks WHERE product_id = ?', [id]);
  await db.runAsync('DELETE FROM products WHERE id = ?', [id]);
}

export async function recordCheck(
  productId: number,
  date: string,
  status: 'ok' | 'rupture',
  nextExpiryDate?: string
): Promise<void> {
  const db = await getDatabase();
  if (!db) return;

  // If declaring rupture, save the current DLC before deleting today's checks
  let previousDLC: string | null = null;
  if (status === 'rupture') {
    const currentCheck = await db.getFirstAsync<{ next_expiry_date: string | null }>(
      'SELECT next_expiry_date FROM checks WHERE product_id = ? ORDER BY check_date DESC, created_at DESC LIMIT 1',
      [productId]
    );
    if (currentCheck?.next_expiry_date) {
      previousDLC = currentCheck.next_expiry_date;
    } else {
      const product = await db.getFirstAsync<{ initial_expiry_date: string | null }>(
        'SELECT initial_expiry_date FROM products WHERE id = ?',
        [productId]
      );
      previousDLC = product?.initial_expiry_date ?? null;
    }
  }

  await db.runAsync(
    'DELETE FROM checks WHERE product_id = ? AND check_date = ?',
    [productId, date]
  );
  await db.runAsync(
    'INSERT INTO checks (product_id, check_date, status, next_expiry_date, previous_expiry_date) VALUES (?, ?, ?, ?, ?)',
    [productId, date, status, nextExpiryDate ?? null, previousDLC]
  );
}

/**
 * Update product DLC without marking it as checked today
 * Used when editing DLC from product edit screen
 */
export async function updateProductDLC(
  productId: number,
  newDLC: string
): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  const today = getTodayStr();

  // Delete any existing check for TODAY
  await db.runAsync(
    'DELETE FROM checks WHERE product_id = ? AND check_date = ?',
    [productId, today]
  );

  // Create a check for TODAY with the new DLC
  await db.runAsync(
    'INSERT INTO checks (product_id, check_date, status, next_expiry_date) VALUES (?, ?, ?, ?)',
    [productId, today, 'ok', newDLC]
  );
}

export async function getRuptureProducts(): Promise<ProductWithStatus[]> {
  const db = await getDatabase();
  if (!db) return [];
  const rows = await db.getAllAsync<Product & { last_check_date: string }>(
    `SELECT p.*, c.check_date as last_check_date FROM products p
     INNER JOIN checks c ON p.id = c.product_id
     INNER JOIN (
       SELECT product_id, MAX(check_date) as max_date FROM checks GROUP BY product_id
     ) latest ON c.product_id = latest.product_id AND c.check_date = latest.max_date
     WHERE c.status = 'rupture'
     ORDER BY p.name`
  );
  return rows.map((r) => ({
    ...r,
    last_status: 'rupture',
    next_expiry_date: null,
    previous_expiry_date: null,
    checked_today: false,
  }));
}

export async function getCheckHistory(productId: number, limit = 100): Promise<Array<{
  check_date: string;
  status: string;
  next_expiry_date: string | null;
}>> {
  const db = await getDatabase();
  if (!db) return [];
  return db.getAllAsync(
    'SELECT check_date, status, next_expiry_date FROM checks WHERE product_id = ? ORDER BY check_date DESC LIMIT ?',
    [productId, limit]
  );
}

/**
 * Get products that are overdue (past DLC, not checked today, not in rupture)
 * to display in urgent section
 */
export async function getOverdueProducts(): Promise<ProductWithStatus[]> {
  const db = await getDatabase();
  if (!db) return [];
  const today = getTodayStr();
  const products = await db.getAllAsync<Product>(
    `SELECT p.* FROM products p
     LEFT JOIN aisles a ON p.aisle_id = a.id
     ORDER BY COALESCE(a.order_index, 999), p.name`
  );

  const result: ProductWithStatus[] = [];
  for (const product of products) {
    // Get latest check overall
    const lastCheck = await db.getFirstAsync<{ status: string; next_expiry_date: string | null }>(
      'SELECT status, next_expiry_date FROM checks WHERE product_id = ? ORDER BY check_date DESC, created_at DESC LIMIT 1',
      [product.id]
    );

    // Skip products in rupture
    if (lastCheck?.status === 'rupture') continue;

    // Determine current DLC
    const currentDLC = lastCheck?.next_expiry_date ?? product.initial_expiry_date;

    // Skip if no DLC
    if (!currentDLC) continue;

    // Only show products whose DLC is in the past (before today)
    if (currentDLC >= today) continue;

    // Overdue products appear regardless of whether they've been checked today
    // (they were modified to have a past DLC, so they should appear in urgent list)

    result.push({
      ...product,
      last_status: lastCheck?.status ?? null,
      next_expiry_date: currentDLC,
      previous_expiry_date: null,
      checked_today: false,
    });
  }
  return result;
}

export async function getTodayExpiryProducts(): Promise<ProductWithStatus[]> {
  const db = await getDatabase();
  if (!db) return [];
  const today = getTodayStr();
  const products = await db.getAllAsync<Product>(
    `SELECT p.* FROM products p
     LEFT JOIN aisles a ON p.aisle_id = a.id
     ORDER BY COALESCE(a.order_index, 999), p.name`
  );

  const result: ProductWithStatus[] = [];
  for (const product of products) {
    const lastCheck = await db.getFirstAsync<{ status: string; next_expiry_date: string | null }>(
      'SELECT status, next_expiry_date FROM checks WHERE product_id = ? ORDER BY check_date DESC, created_at DESC LIMIT 1',
      [product.id]
    );

    if (lastCheck?.status === 'rupture') continue;

    const currentDLC = lastCheck?.next_expiry_date ?? product.initial_expiry_date;

    if (!currentDLC) continue;
    if (currentDLC !== today) continue;

    result.push({
      ...product,
      last_status: lastCheck?.status ?? null,
      next_expiry_date: currentDLC,
      previous_expiry_date: null,
      checked_today: false,
    });
  }
  return result;
}
