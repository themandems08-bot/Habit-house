// Habit House — Railway server
// Serves the static app AND replaces Firebase Realtime Database with:
//   - Postgres (Railway plugin) for persistence
//   - a WebSocket for live cross-device sync
//
// Env vars used (see .env.example):
//   DATABASE_URL  - injected automatically by Railway's Postgres plugin
//   PORT          - injected automatically by Railway

const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL. Add a Postgres plugin in Railway (it sets this automatically),');
  console.error('or set it yourself for local dev — see .env.example.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  // Railway's internal Postgres doesn't need SSL; its public proxy does.
  ssl: DATABASE_URL.includes('proxy.rlwy.net') || process.env.PGSSLMODE === 'require'
    ? { rejectUnauthorized: false }
    : false,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS households (
      id TEXT PRIMARY KEY,
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getHousehold(id) {
  const { rows } = await pool.query('SELECT state FROM households WHERE id = $1', [id]);
  return rows.length ? rows[0].state : null;
}

async function saveHousehold(id, state) {
  await pool.query(
    `INSERT INTO households (id, state, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (id) DO UPDATE SET state = $2, updated_at = now()`,
    [id, state]
  );
}

const app = express();
app.use(express.static(path.join(__dirname), { extensions: ['html'] }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// householdId -> Set of ws clients
const rooms = new Map();

function roomFor(id) {
  if (!rooms.has(id)) rooms.set(id, new Set());
  return rooms.get(id);
}

wss.on('connection', async (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const householdId = (url.searchParams.get('household') || '').trim();
  if (!householdId) {
    ws.close(1008, 'missing household');
    return;
  }

  const room = roomFor(householdId);
  room.add(ws);
  ws.householdId = householdId;

  try {
    const existing = await getHousehold(householdId);
    if (existing) {
      ws.send(JSON.stringify({ type: 'state', state: existing }));
    } else {
      ws.send(JSON.stringify({ type: 'empty' }));
    }
  } catch (err) {
    console.error('DB read failed on connect:', err);
    ws.send(JSON.stringify({ type: 'error', message: 'backend unavailable' }));
  }

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type !== 'state' || !msg.state) return;

    try {
      await saveHousehold(householdId, msg.state);
    } catch (err) {
      console.error('DB write failed:', err);
      return;
    }

    // broadcast to every other client in the same household
    for (const client of room) {
      if (client !== ws && client.readyState === client.OPEN) {
        client.send(JSON.stringify({ type: 'state', state: msg.state }));
      }
    }
  });

  ws.on('close', () => {
    room.delete(ws);
    if (room.size === 0) rooms.delete(householdId);
  });
});

initDb()
  .then(() => {
    server.listen(PORT, () => console.log(`Habit House server listening on :${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
