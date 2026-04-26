import { apiClient, getServerUrl } from '../api/client';
import { getTodayStr } from '../utils/date';

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

async function resolveImageUri<T extends { image_uri: string | null }>(item: T): Promise<T> {
  if (!item.image_uri || item.image_uri.startsWith('http') || item.image_uri.startsWith('file://')) {
    return item;
  }
  const serverUrl = await getServerUrl();
  return { ...item, image_uri: `${serverUrl}${item.image_uri}` };
}

async function resolveImages<T extends { image_uri: string | null }>(items: T[]): Promise<T[]> {
  if (!items.length) return items;
  const serverUrl = await getServerUrl();
  return items.map((item) => {
    if (!item.image_uri || item.image_uri.startsWith('http') || item.image_uri.startsWith('file://')) {
      return item;
    }
    return { ...item, image_uri: `${serverUrl}${item.image_uri}` };
  });
}

export async function getAllProducts(): Promise<Product[]> {
  const list = await apiClient.products.list();
  return resolveImages(list);
}

export async function getProductsForDate(dateStr: string): Promise<ProductWithStatus[]> {
  const list = await apiClient.views.productsForDate(dateStr);
  return resolveImages(list);
}

export async function getCheckedToday(): Promise<Array<ProductWithStatus & { check_status: string }>> {
  const list = await apiClient.views.checkedToday(getTodayStr());
  return resolveImages(list);
}

export async function getRuptureProducts(): Promise<ProductWithStatus[]> {
  const list = await apiClient.views.ruptures();
  return resolveImages(list);
}

export async function getOverdueProducts(): Promise<ProductWithStatus[]> {
  const list = await apiClient.views.overdue(getTodayStr());
  return resolveImages(list);
}

export async function getTodayExpiryProducts(): Promise<ProductWithStatus[]> {
  const list = await apiClient.views.todayExpiry(getTodayStr());
  return resolveImages(list);
}

export async function addProduct(
  name: string,
  category: string,
  barcode?: string,
  imageUri?: string,
  initialExpiryDate?: string,
  aisleId?: number
): Promise<number> {
  const product = await apiClient.products.create({
    name,
    category,
    barcode: barcode ?? null,
    image_uri: imageUri ?? null,
    initial_expiry_date: initialExpiryDate ?? null,
    aisle_id: aisleId ?? null,
  });
  return product.id;
}

export async function updateProduct(
  id: number,
  name: string,
  category: string,
  barcode?: string,
  imageUri?: string,
  aisleId?: number
): Promise<void> {
  await apiClient.products.update(id, {
    name,
    category,
    barcode: barcode ?? null,
    image_uri: imageUri ?? null,
    aisle_id: aisleId ?? null,
  });
}

export async function deleteProduct(id: number): Promise<void> {
  await apiClient.products.delete(id);
}

export async function recordCheck(
  productId: number,
  date: string,
  status: 'ok' | 'rupture',
  nextExpiryDate?: string
): Promise<void> {
  await apiClient.checks.create({
    product_id: productId,
    check_date: date,
    status,
    next_expiry_date: nextExpiryDate ?? null,
  });
}

export async function updateProductDLC(productId: number, newDLC: string): Promise<void> {
  await apiClient.products.setDLC(productId, newDLC, getTodayStr());
}

export async function getCheckHistory(
  productId: number,
  _limit = 100
): Promise<Array<{ check_date: string; status: string; next_expiry_date: string | null }>> {
  const list = await apiClient.checks.forProduct(productId);
  return list.map((c: any) => ({
    check_date: c.check_date,
    status: c.status,
    next_expiry_date: c.next_expiry_date,
  }));
}

export async function getProductById(id: number): Promise<Product | null> {
  try {
    const product = await apiClient.products.get(id);
    return resolveImageUri(product);
  } catch {
    return null;
  }
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  try {
    const product = await apiClient.products.findByBarcode(barcode);
    if (!product) return null;
    return resolveImageUri(product);
  } catch {
    return null;
  }
}
