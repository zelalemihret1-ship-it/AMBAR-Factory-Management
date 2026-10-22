'use strict';
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const app = express();
const PORT = Number(process.env.PORT || 3000);
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Attach a PostgreSQL database in Render and set DATABASE_URL.');
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }, max: 10 });
app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));
const EMPTY = { orders: [], products: [], materials: [], sales: [], activityLog: [], nextId: 1 };
async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS ambar_workshop_state (
    id smallint PRIMARY KEY CHECK (id = 1),
    state jsonb NOT NULL,
    version bigint NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by text
  )`);
  await pool.query(`INSERT INTO ambar_workshop_state(id,state) VALUES (1,$1::jsonb) ON CONFLICT(id) DO NOTHING`, [JSON.stringify(EMPTY)]);
}
app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, service: 'AMBAR Workshop ERP', database: 'postgresql', status: 'connected' }); }
  catch (e) { console.error('health check failed', e.message); res.status(503).json({ ok: false, database: 'unavailable' }); }
});
app.get('/api/state', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT state, version, updated_at FROM ambar_workshop_state WHERE id=1');
    res.set('Cache-Control', 'no-store');
    res.json({ ...rows[0].state, _meta: { version: Number(rows[0].version), updatedAt: rows[0].updated_at } });
  } catch (e) { console.error('state read failed', e.message); res.status(500).json({ error: 'Could not load workshop data from PostgreSQL' }); }
});
app.put('/api/state', async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Expected a state object' });
  for (const key of ['orders', 'products', 'materials', 'sales', 'activityLog']) {
    if (body[key] !== undefined && !Array.isArray(body[key])) return res.status(400).json({ error: `${key} must be an array` });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize writes so two devices cannot write the shared snapshot simultaneously.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('ambar_workshop_state'))");
    const current = await client.query('SELECT state, version FROM ambar_workshop_state WHERE id=1 FOR UPDATE');
    const old = current.rows[0].state || EMPTY;
    const next = {};
    for (const key of Object.keys(EMPTY)) next[key] = body[key] === undefined ? old[key] : body[key];
    // Normalize basic stock fields to prevent undefined/NaN stock from entering shared records.
    next.materials = (next.materials || []).filter(x => x && typeof x === 'object').map((m, i) => ({
      ...m, id: Number(m.id) || i + 1, name: String(m.name || 'Unnamed material'), unit: String(m.unit || 'Unit'),
      stock: Number.isFinite(Number(m.stock)) ? Number(m.stock) : 0,
      threshold: Number.isFinite(Number(m.threshold)) ? Number(m.threshold) : 0,
      cost: Number.isFinite(Number(m.cost)) ? Number(m.cost) : 0
    }));
    const version = Number(current.rows[0].version) + 1;
    await client.query('UPDATE ambar_workshop_state SET state=$1::jsonb, version=$2, updated_at=now() WHERE id=1', [JSON.stringify(next), version]);
    await client.query('COMMIT');
    res.json({ ok: true, version, savedAt: new Date().toISOString(), database: 'postgresql' });
  } catch (e) {
    await client.query('ROLLBACK'); console.error('state write failed', e.message);
    res.status(500).json({ error: 'Could not save workshop data transactionally' });
  } finally { client.release(); }
});
app.use((err, _req, res, _next) => { console.error(err.message); res.status(400).json({ error: 'Invalid request' }); });
initDb().then(() => app.listen(PORT, () => console.log(`AMBAR Workshop ERP listening on ${PORT}; PostgreSQL connected`))).catch(e => { console.error('Database initialization failed:', e.message); process.exit(1); });
process.on('SIGTERM', async () => { await pool.end(); process.exit(0); });
