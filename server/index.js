const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');

const BCRYPT_ROUNDS = 10;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const PORT = 3000;
const JWT_SECRET = 'dlc-manager-secret-key-change-in-production';
const DB_PATH = path.join(__dirname, 'dlc-manager.db');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Database setup (better-sqlite3, synchronous)
// ---------------------------------------------------------------------------
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    code_anabel TEXT,
    pricer_id TEXT,
    pricer_password TEXT,
    pricer_token TEXT,
    pricer_token_expireat INTEGER
  );

  CREATE TABLE IF NOT EXISTS aisles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

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

  CREATE TABLE IF NOT EXISTS checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    check_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('ok', 'rupture')),
    next_expiry_date TEXT,
    previous_expiry_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen TEXT NOT NULL DEFAULT (datetime('now')),
    last_connection TEXT,
    last_interaction TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_checks_date ON checks(check_date);
  CREATE INDEX IF NOT EXISTS idx_checks_product ON checks(product_id);
  CREATE INDEX IF NOT EXISTS idx_products_aisle ON products(aisle_id);
  CREATE INDEX IF NOT EXISTS idx_aisles_order ON aisles(order_index);

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    device_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    message TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at DESC);
`);

// Migration: add last_connection / last_interaction / user_login columns to devices if missing
try {
  const cols = db.prepare("PRAGMA table_info(devices)").all().map((c) => c.name);
  if (!cols.includes('last_connection')) {
    db.exec("ALTER TABLE devices ADD COLUMN last_connection TEXT");
  }
  if (!cols.includes('last_interaction')) {
    db.exec("ALTER TABLE devices ADD COLUMN last_interaction TEXT");
  }
  if (!cols.includes('user_login')) {
    db.exec("ALTER TABLE devices ADD COLUMN user_login TEXT");
  }
} catch (err) {
  console.warn('Devices migration warning:', err.message);
}

// Migration: add contact fields + is_active to users if missing
try {
  const userCols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  const newUserCols = {
    enseigne: 'TEXT', nom: 'TEXT', prenom: 'TEXT', telephone: 'TEXT', email: 'TEXT',
    is_active: 'INTEGER NOT NULL DEFAULT 1',
    deleted_at: 'TEXT',
    is_admin: 'INTEGER NOT NULL DEFAULT 0',
  };
  for (const [col, type] of Object.entries(newUserCols)) {
    if (!userCols.includes(col)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${col} ${type}`);
    }
  }
} catch (err) {
  console.warn('Users migration warning:', err.message);
}

// Migration: add actor column to activity_logs if missing + backfill from users table
try {
  const logCols = db.prepare("PRAGMA table_info(activity_logs)").all().map((c) => c.name);
  if (!logCols.includes('actor')) {
    db.exec("ALTER TABLE activity_logs ADD COLUMN actor TEXT");
  }
  // Backfill: entries with a device_id → mobile app user, else Backoffice
  const mobileUser = db.prepare('SELECT login FROM users LIMIT 1').get();
  if (mobileUser) {
    db.prepare(`
      UPDATE activity_logs
      SET actor = CASE
        WHEN device_id IS NOT NULL THEN ?
        ELSE 'Backoffice'
      END
      WHERE actor IS NULL
    `).run(mobileUser.login);
  }
} catch (err) {
  console.warn('activity_logs migration warning:', err.message);
}

// Migration: add user extra columns if missing
try {
  const userCols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  if (!userCols.includes('code_anabel'))         db.exec("ALTER TABLE users ADD COLUMN code_anabel TEXT");
  if (!userCols.includes('pricer_id'))           db.exec("ALTER TABLE users ADD COLUMN pricer_id TEXT");
  if (!userCols.includes('pricer_password'))     db.exec("ALTER TABLE users ADD COLUMN pricer_password TEXT");
  if (!userCols.includes('pricer_token'))          db.exec("ALTER TABLE users ADD COLUMN pricer_token TEXT");
  if (!userCols.includes('pricer_token_expireat')) db.exec("ALTER TABLE users ADD COLUMN pricer_token_expireat INTEGER");
} catch (err) {
  console.warn('Users migration warning:', err.message);
}

// Migration: add user_id to aisles, products, devices, activity_logs
try {
  const aisleCols = db.prepare("PRAGMA table_info(aisles)").all().map((c) => c.name);
  if (!aisleCols.includes('user_id')) db.exec("ALTER TABLE aisles ADD COLUMN user_id INTEGER REFERENCES users(id)");

  const productCols = db.prepare("PRAGMA table_info(products)").all().map((c) => c.name);
  if (!productCols.includes('user_id')) db.exec("ALTER TABLE products ADD COLUMN user_id INTEGER REFERENCES users(id)");

  const deviceCols = db.prepare("PRAGMA table_info(devices)").all().map((c) => c.name);
  if (!deviceCols.includes('user_id')) db.exec("ALTER TABLE devices ADD COLUMN user_id INTEGER REFERENCES users(id)");

  const logCols2 = db.prepare("PRAGMA table_info(activity_logs)").all().map((c) => c.name);
  if (!logCols2.includes('user_id')) db.exec("ALTER TABLE activity_logs ADD COLUMN user_id INTEGER REFERENCES users(id)");
} catch (err) {
  console.warn('user_id migration warning:', err.message);
}

// Seed default user (bcrypt hash synchronous at startup is acceptable — runs once)
const existingUser = db.prepare('SELECT id, password, code_anabel FROM users WHERE login = ?').get('Honfleur');
if (!existingUser) {
  const hashed = bcrypt.hashSync('Honfleur', BCRYPT_ROUNDS);
  db.prepare('INSERT INTO users (login, password, code_anabel, pricer_id, pricer_password) VALUES (?, ?, ?, ?, ?)').run(
    'Honfleur', hashed,
    '8314',
    'ef5b2ad5-273b-4fa7-bffd-5e3597986c9c',
    '62ee2f8d-15bb-49eb-ac46-3c1e1af08797-rT4OTWhEBKPxucQwzVcnZ5ZQlgE6IYODrMLnLQRznxEHlzwDuo416WBOMaLLTXJ'
  );
  console.log('Default user "Honfleur" created.');
} else {
  // Migrer le mot de passe en clair vers bcrypt si nécessaire
  if (!existingUser.password.startsWith('$2')) {
    const hashed = bcrypt.hashSync(existingUser.password, BCRYPT_ROUNDS);
    db.prepare('UPDATE users SET password = ? WHERE login = ?').run(hashed, 'Honfleur');
    console.log('Password "Honfleur" migrated to bcrypt.');
  }
  // Backfill valeurs par défaut si les colonnes sont vides
  db.prepare(`
    UPDATE users SET
      code_anabel     = COALESCE(code_anabel,     '8314'),
      pricer_id       = COALESCE(pricer_id,       'ef5b2ad5-273b-4fa7-bffd-5e3597986c9c'),
      pricer_password = COALESCE(pricer_password, '62ee2f8d-15bb-49eb-ac46-3c1e1af08797-rT4OTWhEBKPxucQwzVcnZ5ZQlgE6IYODrMLnLQRznxEHlzwDuo416WBOMaLLTXJ'),
      is_admin        = 1
    WHERE login = 'Honfleur'
  `).run();
}

// Backfill user_id = admin user pour toutes les données sans user_id
try {
  const adminUser = db.prepare("SELECT id FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1").get();
  if (adminUser) {
    db.prepare("UPDATE aisles SET user_id = ? WHERE user_id IS NULL").run(adminUser.id);
    db.prepare("UPDATE products SET user_id = ? WHERE user_id IS NULL").run(adminUser.id);
    db.prepare("UPDATE devices SET user_id = ? WHERE user_id IS NULL").run(adminUser.id);
    db.prepare("UPDATE activity_logs SET user_id = ? WHERE user_id IS NULL").run(adminUser.id);
  }
} catch (err) {
  console.warn('Backfill user_id warning:', err.message);
}

console.log('✅ Database connected');

// ---------------------------------------------------------------------------
// Multer setup for photo uploads
// ---------------------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, _file, cb) => cb(null, `${req.params.id}.jpg`),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// ---------------------------------------------------------------------------
// Express + Socket.IO
// ---------------------------------------------------------------------------
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`🔌 Socket disconnected: ${socket.id}`));
});

// Broadcast helper
function broadcast(event, payload) {
  io.emit(event, payload);
}

// Generic activity-log middleware: records every successful mutating API call
function activityLogger(req, res, next) {
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) return next();
  if (!req.path.startsWith('/api/')) return next();
  // Skip noisy / non-user actions
  if (req.path === '/api/auth/login') return next();
  if (req.path === '/api/devices' && req.method === 'POST') return next(); // device heartbeat
  if (req.path === '/api/logs') return next();

  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    try {
      const deviceId = req.headers['x-device-id'] || null;
      let deviceName = null;
      if (deviceId) {
        const d = db.prepare('SELECT name FROM devices WHERE id = ?').get(deviceId);
        deviceName = d?.name || null;
      }
      if (!deviceName) deviceName = req.user?.deviceName || req.user?.login || 'Backoffice';
      const actor = req.user?.deviceName || req.user?.login || 'Backoffice';

      const action = `${req.method} ${req.path}`;
      const message = `${req.method} ${req.path} → ${res.statusCode}`;
      const safeBody = req.body && typeof req.body === 'object' ? { ...req.body } : null;
      if (safeBody) delete safeBody.password;
      const details = {
        params: req.params && Object.keys(req.params).length ? req.params : undefined,
        body: safeBody && Object.keys(safeBody).length ? safeBody : undefined,
        status: res.statusCode,
      };
      const logUserId = req.user?.userId ?? null;
      const ins = db.prepare(
        `INSERT INTO activity_logs (device_id, device_name, actor, action, entity_type, entity_id, message, details, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        deviceId,
        deviceName,
        actor,
        action,
        null,
        req.params?.id != null ? String(req.params.id) : null,
        message,
        JSON.stringify(details),
        logUserId
      );
      const log = db.prepare('SELECT * FROM activity_logs WHERE id = ?').get(ins.lastInsertRowid);
      broadcast('logs:changed', { action: 'create', log });
    } catch (err) {
      console.warn('activityLogger error:', err.message);
    }
  });
  next();
}
app.use(activityLogger);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Track last_interaction for the device making this call (silently, no broadcast)
  const deviceId = req.headers['x-device-id'];
  if (deviceId) {
    try {
      if (req.user.userId) {
        // Token utilisateur : on associe le login et l'id de l'user à ce device
        const u = db.prepare('SELECT id, login FROM users WHERE id = ?').get(req.user.userId);
        db.prepare(
          "UPDATE devices SET last_interaction = datetime('now'), last_seen = datetime('now'), user_login = ?, user_id = ? WHERE id = ?"
        ).run(u?.login ?? null, u?.id ?? null, deviceId);
      } else {
        db.prepare(
          "UPDATE devices SET last_interaction = datetime('now'), last_seen = datetime('now') WHERE id = ?"
        ).run(deviceId);
      }
    } catch (err) { /* ignore tracking errors */ }
  }
  next();
}

/**
 * Vérifie si le token Pricer en BDD est valide (existe + non expiré).
 * Sinon en demande un nouveau via l'API IAM Pricer et le stocke en BDD.
 * Retourne le token à jour ou null en cas d'erreur.
 */
async function refreshPricerTokenIfNeeded(user) {
  const nowSec = Math.floor(Date.now() / 1000);
  // Token valide : existe et expire dans plus de 60 secondes
  if (user.pricer_token && user.pricer_token_expireat && user.pricer_token_expireat > nowSec + 60) {
    return user.pricer_token;
  }

  if (!user.pricer_id || !user.pricer_password) {
    console.warn(`[Pricer] Pas de pricer_id/pricer_password pour user ${user.login}`);
    return null;
  }

  try {
    const body = new URLSearchParams({
      client_id: user.pricer_id,
      client_secret: user.pricer_password,
      grant_type: 'client_credentials',
    });

    const response = await fetch('https://iam.pricer-plaza.com/api/v2/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[Pricer] Erreur IAM ${response.status}: ${text}`);
      return null;
    }

    const data = await response.json();
    const accessToken = data.access_token;
    const expiresIn = data.expires_in ?? 3600; // secondes
    const expireAt = nowSec + expiresIn;

    db.prepare('UPDATE users SET pricer_token = ?, pricer_token_expireat = ? WHERE id = ?')
      .run(accessToken, expireAt, user.id);

    console.log(`[Pricer] Token renouvelé pour user ${user.login}, expire dans ${expiresIn}s`);
    return accessToken;
  } catch (err) {
    console.error('[Pricer] Erreur lors du renouvellement du token:', err.message);
    return null;
  }
}

app.post('/api/auth/login', async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) return res.status(400).json({ error: 'Login and password are required' });
  const user = db.prepare('SELECT * FROM users WHERE login = ?').get(login);
  if (!user || user.deleted_at) return res.status(401).json({ error: 'Invalid credentials' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.is_active === 0) return res.status(403).json({ error: 'Compte désactivé. Veuillez contacter votre administrateur.' });

  // Vérifier / renouveler le token Pricer et l'inclure dans la réponse
  const pricerToken = await refreshPricerTokenIfNeeded(user).catch((err) => {
    console.error('[Pricer] refreshPricerTokenIfNeeded error:', err.message);
    return user.pricer_token ?? null;
  });

  const token = jwt.sign({ userId: user.id, login: user.login }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, pricer_token: pricerToken, code_anabel: user.code_anabel ?? null, is_admin: user.is_admin === 1 });
});

app.post('/api/auth/device', (req, res) => {
  const { deviceId, deviceName } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId requis' });
  const name = (deviceName || 'Appareil mobile').trim().slice(0, 30);
  db.prepare(`
    INSERT INTO devices (id, name, last_connection, last_seen)
    VALUES (?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      last_connection = datetime('now'),
      last_seen = datetime('now')
  `).run(deviceId, name);
  const token = jwt.sign({ deviceId, deviceName: name }, JWT_SECRET, { expiresIn: '365d' });
  res.json({ token });
});

// Health check (used by mobile NetworkGuard)
app.get('/api/ping', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ---------------------------------------------------------------------------
// USER MANAGEMENT (admin CRUD)
// ---------------------------------------------------------------------------
const USER_PUBLIC_FIELDS = 'id, login, is_admin, is_active, deleted_at, enseigne, nom, prenom, telephone, email, code_anabel, pricer_id, pricer_password, pricer_token, pricer_token_expireat';

function requireAdmin(req, res, next) {
  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user?.userId);
  if (!user || user.is_admin !== 1) return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  next();
}

app.get('/api/users', authenticate, requireAdmin, (req, res) => {
  const includeDeleted = req.query.include_deleted === '1';
  const users = includeDeleted
    ? db.prepare(`SELECT ${USER_PUBLIC_FIELDS} FROM users ORDER BY deleted_at ASC, id ASC`).all()
    : db.prepare(`SELECT ${USER_PUBLIC_FIELDS} FROM users WHERE deleted_at IS NULL ORDER BY id ASC`).all();
  res.json(users);
});

app.post('/api/users', authenticate, requireAdmin, async (req, res) => {
  const { login, password, enseigne, nom, prenom, telephone, email, code_anabel, pricer_id, pricer_password } = req.body;
  if (!login || !password) return res.status(400).json({ error: 'login et password requis' });
  const existing = db.prepare('SELECT id FROM users WHERE login = ?').get(login);
  if (existing) return res.status(409).json({ error: 'Ce login existe déjà' });
  try {
    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    db.prepare(`
      INSERT INTO users (login, password, enseigne, nom, prenom, telephone, email, code_anabel, pricer_id, pricer_password)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(login, hashed, enseigne || null, nom || null, prenom || null, telephone || null, email || null, code_anabel || null, pricer_id || null, pricer_password || null);
    const created = db.prepare(`SELECT ${USER_PUBLIC_FIELDS} FROM users WHERE login = ?`).get(login);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { login, password, enseigne, nom, prenom, telephone, email, code_anabel, pricer_id, pricer_password, is_admin } = req.body;
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (login) {
    const conflict = db.prepare('SELECT id FROM users WHERE login = ? AND id != ?').get(login, id);
    if (conflict) return res.status(409).json({ error: 'Ce login est déjà utilisé' });
  }
  try {
    let hashedPassword = null;
    if (password) hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    // Un admin ne peut pas se retirer ses propres droits admin
    const isSelf = req.user.userId && String(req.user.userId) === String(id);
    const adminValue = isSelf ? undefined : (is_admin != null ? (is_admin ? 1 : 0) : undefined);
    db.prepare(`
      UPDATE users SET
        login           = COALESCE(?, login),
        password        = COALESCE(?, password),
        enseigne        = ?,
        nom             = ?,
        prenom          = ?,
        telephone       = ?,
        email           = ?,
        code_anabel     = ?,
        pricer_id       = ?,
        pricer_password = ?
        ${adminValue != null ? ', is_admin = ' + adminValue : ''}
      WHERE id = ?
    `).run(
      login || null, hashedPassword,
      enseigne ?? null, nom ?? null, prenom ?? null, telephone ?? null, email ?? null,
      code_anabel ?? null, pricer_id ?? null, pricer_password ?? null,
      id
    );
    const updated = db.prepare(`SELECT ${USER_PUBLIC_FIELDS} FROM users WHERE id = ?`).get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  if (req.user.userId && String(req.user.userId) === String(id))
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  const user = db.prepare('SELECT id, deleted_at FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (user.deleted_at) return res.status(400).json({ error: 'Utilisateur déjà supprimé' });
  db.prepare("UPDATE users SET deleted_at = datetime('now') WHERE id = ?").run(id);
  res.json({ ok: true });
});

app.put('/api/users/:id/restore', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const user = db.prepare('SELECT id, deleted_at FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (!user.deleted_at) return res.status(400).json({ error: 'Utilisateur non supprimé' });
  db.prepare('UPDATE users SET deleted_at = NULL WHERE id = ?').run(id);
  const restored = db.prepare(`SELECT ${USER_PUBLIC_FIELDS} FROM users WHERE id = ?`).get(id);
  res.json(restored);
});

app.put('/api/users/:id/toggle-active', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  if (req.user.userId && String(req.user.userId) === String(id))
    return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte' });
  const user = db.prepare('SELECT id, is_active FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  const newState = user.is_active === 0 ? 1 : 0;
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(newState, id);
  const updated = db.prepare(`SELECT ${USER_PUBLIC_FIELDS} FROM users WHERE id = ?`).get(id);
  res.json(updated);
});

// ---------------------------------------------------------------------------
// USER PROFILE (self — code_anabel, pricer_id, pricer_password)
// ---------------------------------------------------------------------------

app.get('/api/users/me', authenticate, (req, res) => {
  const user = db.prepare(`SELECT ${USER_PUBLIC_FIELDS} FROM users WHERE id = ?`).get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.put('/api/users/me', authenticate, async (req, res) => {
  const { nom, prenom, enseigne, telephone, email, password,
          code_anabel, pricer_id, pricer_password, pricer_token, pricer_token_expireat } = req.body;
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (code_anabel != null && String(code_anabel).length > 10)
    return res.status(400).json({ error: 'code_anabel max 10 caractères' });
  if (pricer_id != null && String(pricer_id).length > 100)
    return res.status(400).json({ error: 'pricer_id max 100 caractères' });
  if (pricer_password != null && String(pricer_password).length > 255)
    return res.status(400).json({ error: 'pricer_password max 255 caractères' });
  if (pricer_token != null && String(pricer_token).length > 255)
    return res.status(400).json({ error: 'pricer_token max 255 caractères' });
  if (pricer_token_expireat != null && (!Number.isInteger(Number(pricer_token_expireat)) || Number(pricer_token_expireat) < 0))
    return res.status(400).json({ error: 'pricer_token_expireat doit être un timestamp Unix (entier)' });

  let hashedPassword = null;
  if (password) hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  db.prepare(`
    UPDATE users SET
      nom                   = COALESCE(?, nom),
      prenom                = COALESCE(?, prenom),
      enseigne              = COALESCE(?, enseigne),
      telephone             = COALESCE(?, telephone),
      email                 = COALESCE(?, email),
      password              = COALESCE(?, password),
      code_anabel           = COALESCE(?, code_anabel),
      pricer_id             = COALESCE(?, pricer_id),
      pricer_password       = COALESCE(?, pricer_password),
      pricer_token          = COALESCE(?, pricer_token),
      pricer_token_expireat = COALESCE(?, pricer_token_expireat)
    WHERE id = ?
  `).run(
    nom ?? null,
    prenom ?? null,
    enseigne ?? null,
    telephone ?? null,
    email ?? null,
    hashedPassword,
    code_anabel ?? null,
    pricer_id ?? null,
    pricer_password ?? null,
    pricer_token ?? null,
    pricer_token_expireat != null ? Number(pricer_token_expireat) : null,
    req.user.userId
  );
  const updated = db.prepare(`SELECT ${USER_PUBLIC_FIELDS} FROM users WHERE id = ?`).get(req.user.userId);
  res.json(updated);
});

// ---------------------------------------------------------------------------
// Helper : résout le user_id depuis un token user ou device
// ---------------------------------------------------------------------------
function getRequestUserId(req) {
  if (req.user?.userId) return req.user.userId;
  if (req.user?.deviceId) {
    const dev = db.prepare('SELECT user_login FROM devices WHERE id = ?').get(req.user.deviceId);
    if (dev?.user_login) {
      const u = db.prepare('SELECT id FROM users WHERE login = ?').get(dev.user_login);
      return u?.id ?? null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helpers for product DLC computation
// ---------------------------------------------------------------------------
function getLatestCheck(productId) {
  return db.prepare(
    'SELECT status, next_expiry_date FROM checks WHERE product_id = ? ORDER BY check_date DESC, created_at DESC LIMIT 1'
  ).get(productId);
}

function getCheckOnDate(productId, dateStr) {
  return db.prepare(
    'SELECT status, next_expiry_date FROM checks WHERE product_id = ? AND check_date = ? ORDER BY created_at DESC LIMIT 1'
  ).get(productId, dateStr);
}

function getPreviousCheckBefore(productId, dateStr) {
  return db.prepare(
    'SELECT next_expiry_date FROM checks WHERE product_id = ? AND check_date < ? ORDER BY check_date DESC LIMIT 1'
  ).get(productId, dateStr);
}

function getAllProductsOrdered(userId) {
  return db.prepare(
    `SELECT p.* FROM products p
     LEFT JOIN aisles a ON p.aisle_id = a.id
     WHERE p.user_id = ?
     ORDER BY COALESCE(a.order_index, 999), p.name`
  ).all(userId);
}

// ---------------------------------------------------------------------------
// AISLES
// ---------------------------------------------------------------------------
app.get('/api/aisles', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const aisles = db.prepare(`
    SELECT a.*, COUNT(p.id) as productCount
    FROM aisles a
    LEFT JOIN products p ON a.id = p.aisle_id
    WHERE a.user_id = ?
    GROUP BY a.id
    ORDER BY a.order_index ASC
  `).all(uid);
  res.json(aisles);
});

app.post('/api/aisles', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const { name } = req.body;
  if (name == null) return res.status(400).json({ error: 'name is required' });
  const result = db.prepare('SELECT MAX(order_index) as max_order FROM aisles WHERE user_id = ?').get(uid);
  const nextOrder = (result?.max_order ?? 0) + 1;
  const insert = db.prepare('INSERT INTO aisles (name, order_index, user_id) VALUES (?, ?, ?)').run(name, nextOrder, uid);
  const aisle = db.prepare('SELECT * FROM aisles WHERE id = ?').get(insert.lastInsertRowid);
  broadcast('aisles:changed', { action: 'create', aisle });
  res.status(201).json(aisle);
});

app.put('/api/aisles/:id', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const { id } = req.params;
  const { name } = req.body;
  if (name == null) return res.status(400).json({ error: 'name is required' });
  const existing = db.prepare('SELECT * FROM aisles WHERE id = ? AND user_id = ?').get(id, uid);
  if (!existing) return res.status(404).json({ error: 'Aisle not found' });
  db.prepare('UPDATE aisles SET name = ? WHERE id = ?').run(name, id);
  const aisle = db.prepare('SELECT * FROM aisles WHERE id = ?').get(id);
  broadcast('aisles:changed', { action: 'update', aisle });
  res.json(aisle);
});

app.delete('/api/aisles/:id', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM aisles WHERE id = ? AND user_id = ?').get(id, uid);
  if (!existing) return res.status(404).json({ error: 'Aisle not found' });

  // Transfer products to "unnamed" aisle (per user) if needed
  const count = db.prepare('SELECT COUNT(*) as count FROM products WHERE aisle_id = ?').get(id);
  if (count.count > 0) {
    let unnamed = db.prepare("SELECT id FROM aisles WHERE name = '' AND user_id = ? ORDER BY id ASC LIMIT 1").get(uid);
    if (!unnamed) {
      const r = db.prepare('SELECT MAX(order_index) as max_order FROM aisles WHERE user_id = ?').get(uid);
      const nextOrder = (r?.max_order ?? -1) + 1;
      const ins = db.prepare("INSERT INTO aisles (name, order_index, user_id) VALUES ('', ?, ?)").run(nextOrder, uid);
      unnamed = { id: ins.lastInsertRowid };
      broadcast('aisles:changed', {
        action: 'create',
        aisle: db.prepare('SELECT * FROM aisles WHERE id = ?').get(unnamed.id),
      });
    }
    db.prepare('UPDATE products SET aisle_id = ? WHERE aisle_id = ?').run(unnamed.id, id);
    broadcast('products:changed', { action: 'bulk_update' });
  }

  db.prepare('DELETE FROM aisles WHERE id = ?').run(id);
  broadcast('aisles:changed', { action: 'delete', id: Number(id) });
  res.json({ success: true });
});

app.post('/api/aisles/reorder', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array is required' });
  const stmt = db.prepare('UPDATE aisles SET order_index = ? WHERE id = ? AND user_id = ?');
  const tx = db.transaction((aisleIds) => {
    aisleIds.forEach((id, i) => stmt.run(i, id, uid));
  });
  tx(ids);
  broadcast('aisles:changed', { action: 'reorder', ids });
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// ACTIVITY LOGS
// ---------------------------------------------------------------------------
app.get('/api/logs', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
  const logs = db.prepare(
    'SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?'
  ).all(uid, limit);
  res.json(logs);
});

// ---------------------------------------------------------------------------
// DEVICES
// ---------------------------------------------------------------------------
app.get('/api/devices', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const devices = db.prepare(
    'SELECT id, name, user_login, created_at, last_seen, last_connection, last_interaction FROM devices WHERE user_id = ? ORDER BY last_seen DESC'
  ).all(uid);
  res.json(devices);
});

app.post('/api/devices', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const { id, name } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name are required' });

  const existing = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
  if (existing) {
    db.prepare(
      "UPDATE devices SET last_seen = datetime('now'), last_connection = datetime('now'), last_interaction = datetime('now'), user_id = COALESCE(user_id, ?) WHERE id = ?"
    ).run(uid, id);
    const device = db.prepare('SELECT id, name, created_at, last_seen, last_connection, last_interaction FROM devices WHERE id = ?').get(id);
    broadcast('devices:changed', { action: 'connect', device });
    return res.json(device);
  }

  db.prepare(
    "INSERT INTO devices (id, name, last_connection, last_interaction, user_id) VALUES (?, ?, datetime('now'), datetime('now'), ?)"
  ).run(id, name, uid);
  const device = db.prepare('SELECT id, name, created_at, last_seen, last_connection, last_interaction FROM devices WHERE id = ?').get(id);
  broadcast('devices:changed', { action: 'register', device });
  res.status(201).json(device);
});

app.put('/api/devices/:id', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const existing = db.prepare('SELECT * FROM devices WHERE id = ? AND user_id = ?').get(id, uid);
  if (!existing) return res.status(404).json({ error: 'Device not found' });

  db.prepare('UPDATE devices SET name = ? WHERE id = ?').run(name, id);
  const device = db.prepare('SELECT id, name, created_at, last_seen, last_connection, last_interaction FROM devices WHERE id = ?').get(id);
  broadcast('devices:changed', { action: 'update', device });
  res.json(device);
});

// ---------------------------------------------------------------------------
// PRODUCTS
// ---------------------------------------------------------------------------
app.get('/api/products', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const { barcode } = req.query;
  if (barcode) {
    const product = db.prepare('SELECT * FROM products WHERE barcode = ? AND user_id = ?').get(barcode, uid);
    return res.json(product || null);
  }
  const products = db.prepare('SELECT * FROM products WHERE user_id = ? ORDER BY category, name').all(uid);
  res.json(products);
});

app.get('/api/products/:id', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(req.params.id, uid);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

app.post('/api/products', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const { name, category, barcode, image_uri, initial_expiry_date, aisle_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const result = db.prepare(
    `INSERT INTO products (name, category, barcode, image_uri, initial_expiry_date, aisle_id, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    name,
    category || 'Autre',
    barcode ?? null,
    image_uri ?? null,
    initial_expiry_date ?? null,
    aisle_id ?? null,
    uid
  );
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  broadcast('products:changed', { action: 'create', product });
  res.status(201).json(product);
});

app.put('/api/products/:id', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const { id } = req.params;
  const { name, category, barcode, image_uri, initial_expiry_date, aisle_id } = req.body;
  const existing = db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(id, uid);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  db.prepare(
    `UPDATE products SET
       name = COALESCE(?, name),
       category = COALESCE(?, category),
       barcode = ?,
       image_uri = ?,
       initial_expiry_date = ?,
       aisle_id = ?
     WHERE id = ?`
  ).run(
    name ?? null,
    category ?? null,
    barcode ?? existing.barcode,
    image_uri ?? existing.image_uri,
    initial_expiry_date ?? existing.initial_expiry_date,
    aisle_id ?? existing.aisle_id,
    id
  );
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  broadcast('products:changed', { action: 'update', product });
  if (initial_expiry_date && initial_expiry_date !== existing.initial_expiry_date) {
    broadcast('checks:changed', { action: 'dlc_update', productId: Number(id) });
  }
  res.json(product);
});

app.delete('/api/products/:id', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(id, uid);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  db.prepare('DELETE FROM products WHERE id = ?').run(id);

  const photoPath = path.join(UPLOADS_DIR, `${id}.jpg`);
  if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);

  broadcast('products:changed', { action: 'delete', id: Number(id) });
  broadcast('checks:changed', { action: 'product_deleted', productId: Number(id) });
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// PHOTOS
// ---------------------------------------------------------------------------
app.post('/api/products/:id/photo', authenticate, upload.single('photo'), (req, res) => {
  const uid = getRequestUserId(req);
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'No photo file provided' });
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(id, uid);
  if (!product) {
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'Product not found' });
  }
  const url = `/uploads/${id}.jpg?ts=${Date.now()}`;
  db.prepare('UPDATE products SET image_uri = ? WHERE id = ?').run(url, id);
  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  broadcast('products:changed', { action: 'update', product: updated });
  res.json({ success: true, image_uri: url });
});

// ---------------------------------------------------------------------------
// CHECKS
// ---------------------------------------------------------------------------
app.get('/api/checks', authenticate, (_req, res) => {
  const checks = db.prepare(
    'SELECT * FROM checks ORDER BY check_date DESC, created_at DESC LIMIT 200'
  ).all();
  res.json(checks);
});

app.get('/api/checks/product/:productId', authenticate, (req, res) => {
  const checks = db.prepare(
    'SELECT * FROM checks WHERE product_id = ? ORDER BY check_date DESC, created_at DESC'
  ).all(req.params.productId);
  res.json(checks);
});

app.post('/api/checks', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const { product_id, check_date, status, next_expiry_date } = req.body;
  if (!product_id || !check_date || !status) {
    return res.status(400).json({ error: 'product_id, check_date, status are required' });
  }
  if (!['ok', 'rupture'].includes(status)) {
    return res.status(400).json({ error: 'status must be "ok" or "rupture"' });
  }
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(product_id, uid);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  // For ruptures: capture previous DLC
  let previousDLC = null;
  if (status === 'rupture') {
    const last = getLatestCheck(product_id);
    previousDLC = last?.next_expiry_date ?? product.initial_expiry_date ?? null;
  }

  // Replace any existing check for that product+date
  db.prepare('DELETE FROM checks WHERE product_id = ? AND check_date = ?').run(product_id, check_date);
  const ins = db.prepare(
    `INSERT INTO checks (product_id, check_date, status, next_expiry_date, previous_expiry_date)
     VALUES (?, ?, ?, ?, ?)`
  ).run(product_id, check_date, status, next_expiry_date ?? null, previousDLC);

  const check = db.prepare('SELECT * FROM checks WHERE id = ?').get(ins.lastInsertRowid);
  broadcast('checks:changed', { action: 'create', check });
  res.status(201).json(check);
});

// Update product DLC by creating a new check for today
app.post('/api/products/:id/dlc', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const { id } = req.params;
  const { dlc, today } = req.body;
  if (!dlc || !today) return res.status(400).json({ error: 'dlc and today are required' });
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(id, uid);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  db.prepare('DELETE FROM checks WHERE product_id = ? AND check_date = ?').run(id, today);
  db.prepare(
    `INSERT INTO checks (product_id, check_date, status, next_expiry_date) VALUES (?, ?, 'ok', ?)`
  ).run(id, today, dlc);
  broadcast('checks:changed', { action: 'dlc_update', productId: Number(id) });
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// COMPUTED VIEWS (server-side complex queries)
// ---------------------------------------------------------------------------
function buildProductWithStatus(product, dateStr) {
  const lastCheck = getLatestCheck(product.id);
  if (lastCheck?.status === 'rupture') return null;
  const currentDLC = lastCheck?.next_expiry_date ?? product.initial_expiry_date;
  if (currentDLC !== dateStr) return null;

  const dateCheck = getCheckOnDate(product.id, dateStr);
  let previousDLC = null;
  if (dateCheck) {
    const prev = getPreviousCheckBefore(product.id, dateStr);
    previousDLC = prev?.next_expiry_date ?? product.initial_expiry_date ?? null;
  }
  return {
    ...product,
    last_status: dateCheck?.status ?? lastCheck?.status ?? null,
    next_expiry_date: dateCheck?.next_expiry_date ?? currentDLC,
    previous_expiry_date: previousDLC,
    checked_today: !!dateCheck,
  };
}

app.get('/api/views/products-for-date', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date is required' });
  const products = getAllProductsOrdered(uid);
  const out = [];
  for (const p of products) {
    const item = buildProductWithStatus(p, date);
    if (item) out.push(item);
  }
  res.json(out);
});

app.get('/api/views/overdue', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const { today } = req.query;
  if (!today) return res.status(400).json({ error: 'today is required' });
  const products = getAllProductsOrdered(uid);
  const out = [];
  for (const p of products) {
    const last = getLatestCheck(p.id);
    if (last?.status === 'rupture') continue;
    const currentDLC = last?.next_expiry_date ?? p.initial_expiry_date;
    if (!currentDLC || currentDLC >= today) continue;
    out.push({
      ...p,
      last_status: last?.status ?? null,
      next_expiry_date: currentDLC,
      previous_expiry_date: null,
      checked_today: false,
    });
  }
  res.json(out);
});

app.get('/api/views/today-expiry', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const { today } = req.query;
  if (!today) return res.status(400).json({ error: 'today is required' });
  const products = getAllProductsOrdered(uid);
  const out = [];
  for (const p of products) {
    const last = getLatestCheck(p.id);
    if (last?.status === 'rupture') continue;
    const currentDLC = last?.next_expiry_date ?? p.initial_expiry_date;
    if (!currentDLC || currentDLC !== today) continue;
    out.push({
      ...p,
      last_status: last?.status ?? null,
      next_expiry_date: currentDLC,
      previous_expiry_date: null,
      checked_today: false,
    });
  }
  res.json(out);
});

app.get('/api/views/ruptures', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const rows = db.prepare(
    `SELECT p.*, c.check_date as last_check_date FROM products p
     INNER JOIN checks c ON p.id = c.product_id
     INNER JOIN (
       SELECT product_id, MAX(check_date) as max_date FROM checks GROUP BY product_id
     ) latest ON c.product_id = latest.product_id AND c.check_date = latest.max_date
     WHERE c.status = 'rupture' AND p.user_id = ?
     ORDER BY p.name`
  ).all(uid);
  res.json(
    rows.map((r) => ({
      ...r,
      last_status: 'rupture',
      next_expiry_date: null,
      previous_expiry_date: null,
      checked_today: false,
    }))
  );
});

app.get('/api/views/checked-today', authenticate, (req, res) => {
  const uid = getRequestUserId(req);
  const { today } = req.query;
  if (!today) return res.status(400).json({ error: 'today is required' });

  const checks = db.prepare(
    `SELECT c.product_id, c.status, c.next_expiry_date, c.previous_expiry_date
     FROM checks c
     INNER JOIN products p ON c.product_id = p.id
     WHERE c.check_date = ? AND p.user_id = ?
     ORDER BY c.created_at DESC`
  ).all(today, uid);

  const seen = new Set();
  const unique = [];
  for (const c of checks) {
    if (!seen.has(c.product_id)) {
      seen.add(c.product_id);
      unique.push(c);
    }
  }

  const out = [];
  for (const check of unique) {
    if (check.next_expiry_date && check.next_expiry_date <= today) continue;
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(check.product_id, uid);
    if (!product) continue;

    let previousDLC = check.previous_expiry_date;
    if (!previousDLC) {
      const prev = db.prepare(
        `SELECT next_expiry_date FROM checks
         WHERE product_id = ? AND next_expiry_date IS NOT NULL
         ORDER BY check_date DESC, created_at DESC LIMIT 1`
      ).get(check.product_id);
      previousDLC = prev?.next_expiry_date ?? product.initial_expiry_date ?? null;
    }

    out.push({
      ...product,
      last_status: check.status,
      next_expiry_date: check.next_expiry_date,
      previous_expiry_date: previousDLC,
      checked_today: true,
      check_status: check.status,
    });
  }
  res.json(out);
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
// Start
// ---------------------------------------------------------------------------
server.listen(PORT, '0.0.0.0', () => {
  console.log(`DLC Manager server running on http://0.0.0.0:${PORT}`);
  console.log(`Socket.IO ready`);
});
