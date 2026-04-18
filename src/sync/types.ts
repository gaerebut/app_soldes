/**
 * Sync Types
 * Core types for synchronization
 */

export interface SyncChange {
  table: 'products' | 'checks' | 'aisles';
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entity_id: number;
  data: Record<string, any>;
  timestamp: string;
  version: number;
}

export interface SyncMetadata {
  last_sync: string | null;
  last_sync_version: number;
  pending_count: number;
}

export interface SyncQueueItem {
  id: number;
  table_name: 'products' | 'checks' | 'aisles';
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entity_id: number;
  data: string; // JSON string
  timestamp: string;
  synced_at: string | null;
  error: string | null;
  created_at: string;
}

export interface SyncPushRequest {
  device_id: string;
  changes: SyncChange[];
}

export interface SyncPushResponse {
  applied: Array<{
    entity_id: number;
    version: number;
    action: string;
  }>;
  conflicts: Array<{
    entity_id: number;
    entity_type: string;
    device_id: string;
    server_version: number;
    conflict_id: number;
  }>;
  errors: Array<{
    entity_id: number;
    error: string;
  }>;
  timestamp: string;
  version: number;
}

export interface SyncPullResponse {
  changes: SyncChange[];
  timestamp: string;
  count: number;
  has_more: boolean;
}

export interface DeviceInfo {
  device_id: string;
  device_name: string;
  app_version: string;
  last_sync: string | null;
  last_sync_version: number;
}

export interface SyncStatus {
  device_id: string;
  synced: boolean;
  pending_count: number;
  conflicts_pending: any[];
  last_sync: string | null;
}
