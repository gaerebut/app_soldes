/**
 * DLC Manager Server - Dev Mode (Memory-based)
 * Simplified in-memory version for development without native modules
 */

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const createSyncRoutes = require('./sync');
const ConflictResolver = require('./conflictResolver');
const DeviceRegistry = require('./deviceRegistry');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const PORT = 3000;
const JWT_SECRET = 'dlc-manager-secret-key-change-in-production';
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// In-Memory Database (for development)
// ---------------------------------------------------------------------------
const database = {
  users: [
    { id: 1, login: 'Honfleur', password: 'Honfleur' }
  ],
  products: [],
  checks: [],
  device_registry: [],
  sync_history: [],
  conflicts: [],
  next_ids: {
    users: 2,
    products: 1,
    checks: 1,
    device_registry: 1,
    sync_history: 1,
    conflicts: 1
  }
};

// Create a mock db object that mimics better-sqlite3 API
const db = {
  prepare: (sql) => ({
    run: (...params) => {
      console.log(`[SQL] ${sql}`, params);
      return { lastInsertRowid: 1 };
    },
    get: (...params) => {
      console.log(`[SQL] ${sql}`, params);
      return null;
    },
    all: (...params) => {
      console.log(`[SQL] ${sql}`, params);
      return [];
    }
  }),
  exec: (sql) => {
    console.log(`[SQL EXEC] ${sql}`);
  }
};

console.log('⚠️  Running in memory mode (development)');

// ---------------------------------------------------------------------------
// Multer setup for photo uploads
// ---------------------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, _file, cb) => {
    const ext = '.jpg';
    cb(null, `${req.params.ean}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();
const syncRouter = express.Router();
app.use(cors());
app.use(express.json());

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Sync Modules (will use mock DB)
const conflictResolver = new ConflictResolver(db);
const deviceRegistry = new DeviceRegistry(db);

// Override sync routes for in-memory database
app.post('/api/sync/device/register', (req, res) => {
  const { device_id, device_name, app_version } = req.body;

  if (!device_id) {
    return res.status(400).json({ error: 'device_id is required' });
  }

  // Find or create device
  let device = database.device_registry.find(d => d.device_id === device_id);
  if (!device) {
    device = {
      device_id,
      device_name: device_name || 'Unknown Device',
      app_version: app_version || 'unknown',
      last_sync: new Date().toISOString(),
      last_sync_version: 0,
      is_active: 1,
      last_seen: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    database.device_registry.push(device);
    console.log('✅ Device registered:', device_id);
  } else {
    device.last_seen = new Date().toISOString();
    device.app_version = app_version || device.app_version;
    console.log('✅ Device updated:', device_id);
  }

  res.json({ success: true, device });
});

app.get('/api/sync/devices', authenticate, (req, res) => {
  res.json({
    devices: database.device_registry
  });
});

app.get('/api/sync/history', authenticate, (req, res) => {
  res.json({
    history: database.sync_history
  });
});

app.get('/api/sync/full', authenticate, (_req, res) => {
  res.json({
    products: database.products,
    checks: database.checks,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/sync/changes', authenticate, (req, res) => {
  const { since } = req.query;
  if (!since) {
    return res.status(400).json({ error: 'since query parameter is required (ISO timestamp)' });
  }

  const sinceDate = new Date(since);
  const products = database.products.filter(p => {
    const createdAt = new Date(p.created_at);
    return createdAt > sinceDate;
  });
  const checks = database.checks.filter(c => {
    const createdAt = new Date(c.created_at);
    return createdAt > sinceDate;
  });

  res.json({
    products,
    checks,
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/sync/push', authenticate, (req, res) => {
  const { device_id, changes } = req.body;

  if (!device_id || !Array.isArray(changes)) {
    return res.status(400).json({ error: 'device_id and changes array are required' });
  }

  const applied = [];
  const conflicts = [];
  const errors = [];

  // Process each change
  for (const change of changes) {
    try {
      if (change.table === 'products') {
        const existing = database.products.find(p => p.id === change.entity_id);
        if (existing) {
          Object.assign(existing, change.data);
        } else {
          database.products.push({ ...change.data, id: database.next_ids.products++ });
        }
        applied.push({ entity_id: change.entity_id, table: change.table });
      } else if (change.table === 'checks') {
        const existing = database.checks.find(c => c.id === change.entity_id);
        if (existing) {
          Object.assign(existing, change.data);
        } else {
          database.checks.push({ ...change.data, id: database.next_ids.checks++ });
        }
        applied.push({ entity_id: change.entity_id, table: change.table });
      }

      // Record in sync history
      database.sync_history.push({
        id: database.next_ids.sync_history++,
        device_id,
        table_name: change.table,
        operation: change.operation,
        entity_id: change.entity_id,
        data_before: null,
        data_after: JSON.stringify(change.data),
        timestamp: new Date().toISOString(),
        version: change.version,
        synced_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
    } catch (error) {
      errors.push({
        entity_id: change.entity_id,
        error: error.message
      });
    }
  }

  console.log(`✅ Push: ${applied.length} applied, ${errors.length} errors`);

  res.json({
    applied,
    conflicts,
    errors,
    timestamp: new Date().toISOString(),
    version: 1
  });
});

// Register remaining sync routes
createSyncRoutes(syncRouter, db, conflictResolver, deviceRegistry);
app.use(syncRouter);

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ---------------------------------------------------------------------------
// AUTH routes
// ---------------------------------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ error: 'Login and password are required' });
  }

  const user = database.users.find(u => u.login === login && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user.id, login: user.login }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token });
});

// ---------------------------------------------------------------------------
// PRODUCTS routes
// ---------------------------------------------------------------------------
app.get('/api/products', authenticate, (_req, res) => {
  res.json(database.products);
});

app.post('/api/products', authenticate, (req, res) => {
  const { ean, name, initial_expiry_date } = req.body;
  if (!ean || !name) {
    return res.status(400).json({ error: 'ean and name are required' });
  }

  const existing = database.products.find(p => p.ean === ean);
  if (existing) {
    existing.name = name;
    existing.initial_expiry_date = initial_expiry_date;
    return res.json(existing);
  }

  const product = {
    id: database.next_ids.products++,
    ean,
    name,
    initial_expiry_date: initial_expiry_date || null,
    created_at: new Date().toISOString(),
    image_version: 0
  };

  database.products.push(product);
  res.json(product);
});

app.delete('/api/products/:ean', authenticate, (req, res) => {
  const { ean } = req.params;
  const index = database.products.findIndex(p => p.ean === ean);
  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }

  database.products.splice(index, 1);

  // Also remove photo if exists
  const photoPath = path.join(UPLOADS_DIR, `${ean}.jpg`);
  if (fs.existsSync(photoPath)) {
    fs.unlinkSync(photoPath);
  }

  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// CHECKS routes
// ---------------------------------------------------------------------------
app.get('/api/checks', authenticate, (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: 'date query parameter is required (YYYY-MM-DD)' });
  }

  const checks = database.checks.filter(c => c.check_date === date);
  res.json(checks);
});

app.get('/api/checks/product/:ean', authenticate, (req, res) => {
  const { ean } = req.params;
  const checks = database.checks.filter(c => c.ean === ean);
  res.json(checks);
});

app.post('/api/checks', authenticate, (req, res) => {
  const { ean, check_date, status, next_expiry_date } = req.body;
  if (!ean || !check_date || !status) {
    return res.status(400).json({ error: 'ean, check_date, and status are required' });
  }
  if (!['ok', 'rupture'].includes(status)) {
    return res.status(400).json({ error: 'status must be "ok" or "rupture"' });
  }

  const product = database.products.find(p => p.ean === ean);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const check = {
    id: database.next_ids.checks++,
    ean,
    check_date,
    status,
    next_expiry_date: next_expiry_date || null,
    created_at: new Date().toISOString()
  };

  database.checks.push(check);
  res.status(201).json(check);
});

// ---------------------------------------------------------------------------
// PHOTOS routes
// ---------------------------------------------------------------------------
app.post('/api/photos/upload/:ean', authenticate, upload.single('photo'), (req, res) => {
  const { ean } = req.params;
  if (!req.file) {
    return res.status(400).json({ error: 'No photo file provided' });
  }

  const product = database.products.find(p => p.ean === ean);
  if (!product) {
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'Product not found' });
  }

  product.image_version = (product.image_version || 0) + 1;
  res.json({ success: true, image_version: product.image_version });
});

app.get('/api/photos/:ean', authenticate, (req, res) => {
  const { ean } = req.params;
  const photoPath = path.join(UPLOADS_DIR, `${ean}.jpg`);

  if (!fs.existsSync(photoPath)) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  const product = database.products.find(p => p.ean === ean);
  const version = product ? product.image_version : 0;

  res.set({
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'public, max-age=86400',
    'ETag': `"${ean}-v${version}"`,
  });

  res.sendFile(photoPath);
});

app.get('/api/photos/:ean/version', authenticate, (req, res) => {
  const { ean } = req.params;
  const product = database.products.find(p => p.ean === ean);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json({ ean, image_version: product.image_version });
});

// ---------------------------------------------------------------------------
// SYNC routes (legacy)
// ---------------------------------------------------------------------------
app.get('/api/sync/full', authenticate, (_req, res) => {
  res.json({
    products: database.products,
    checks: database.checks,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/sync/changes', authenticate, (req, res) => {
  const { since } = req.query;
  if (!since) {
    return res.status(400).json({ error: 'since query parameter is required (ISO timestamp)' });
  }

  const products = database.products.filter(p => new Date(p.created_at) > new Date(since));
  const checks = database.checks.filter(c => new Date(c.created_at) > new Date(since));

  res.json({
    products,
    checks,
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║  DLC Manager Server (Development Mode)    ║
║  http://localhost:${PORT}                     ║
║                                            ║
║  ⚠️  IN-MEMORY DATABASE (data not persisted)  ║
║  For production: Use index.js with        ║
║  Visual Studio or better-sqlite3 binary   ║
╚════════════════════════════════════════════╝
`);
});
