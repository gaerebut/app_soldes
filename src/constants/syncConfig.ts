/**
 * Sync Configuration
 * Central place for synchronization settings
 */

export const SYNC_CONFIG = {
  // Sync interval (ms) - Default: 5 minutes
  SYNC_INTERVAL: 5 * 60 * 1000,

  // Strategy for conflict resolution
  CONFLICT_STRATEGY: 'lww' as const, // 'lww' = Last-Write-Wins

  // Server configuration
  SERVER: {
    DEFAULT_URL: 'http://187.124.215.103:3000',
  },

  // Sync behavior
  BEHAVIOR: {
    // Automatically sync when app comes to foreground
    AUTO_SYNC_ON_FOREGROUND: true,
    // Automatically sync on app launch
    AUTO_SYNC_ON_LAUNCH: true,
    // Batch size for large syncs
    BATCH_SIZE: 100,
  },

  // Storage keys
  STORAGE_KEYS: {
    DEVICE_ID: 'dlc_device_id',
    DEVICE_NAME: 'dlc_device_name',
    SYNC_METADATA: 'dlc_sync_metadata',
    SERVER_URL: 'dlc_server_url',
    AUTH_TOKEN: 'dlc_auth_token',
  },

  // Soft delete configuration
  SOFT_DELETE: {
    // Mark items as deleted but keep history
    ENABLED: true,
    // Clear soft-deleted items after N days
    CLEANUP_DAYS: 30,
  },
};

export default SYNC_CONFIG;
