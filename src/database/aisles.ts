import { apiClient } from '../api/client';

export interface Aisle {
  id: number;
  name: string;
  order_index: number;
  created_at: string;
}

export interface AisleWithProductCount extends Aisle {
  productCount: number;
}

export async function getAllAisles(): Promise<Aisle[]> {
  const list = await apiClient.aisles.list();
  return list.map(({ productCount: _ignored, ...rest }: any) => rest);
}

export async function getAllAislesWithCount(): Promise<AisleWithProductCount[]> {
  const list = await apiClient.aisles.list();
  return list.filter((a: any) => a?.id != null);
}

export async function getAisleById(id: number): Promise<Aisle | null> {
  const list = await apiClient.aisles.list();
  return list.find((a: any) => a.id === id) ?? null;
}

export async function createAisle(name: string): Promise<number> {
  const aisle = await apiClient.aisles.create(name);
  return aisle.id;
}

export async function updateAisleName(id: number, name: string): Promise<void> {
  await apiClient.aisles.update(id, name);
}

export async function deleteAisleWithTransfer(id: number): Promise<void> {
  await apiClient.aisles.delete(id);
}

export async function reorderAisles(aisleIds: number[]): Promise<void> {
  await apiClient.aisles.reorder(aisleIds);
}

export async function getAisleProductCount(aisleId: number): Promise<number> {
  const list = await apiClient.aisles.list();
  const aisle = list.find((a: any) => a.id === aisleId);
  return aisle?.productCount ?? 0;
}

export async function getOrCreateUnnamedAisle(): Promise<number> {
  const list = await apiClient.aisles.list();
  const unnamed = list.find((a: any) => a.name === '');
  if (unnamed) return unnamed.id;
  const created = await apiClient.aisles.create('');
  return created.id;
}
