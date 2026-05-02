const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ── CONEXIÓN A NEON ──
const pool = new Pool({
  host: 'ep-tiny-pine-am3enfmz-pooler.c-5.us-east-1.aws.neon.tech',
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_WQuxzwFT3Is8',
  ssl: { rejectUnauthorized: false },
  port: 5432,
});

// ── CREAR TABLAS AL INICIAR ──
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS citas (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      telefono VARCHAR(30) NOT NULL,
      servicio VARCHAR(100) NOT NULL,
      fecha DATE NOT NULL,
      hora VARCHAR(20) NOT NULL,
      nota TEXT,
      creado_en TIMESTAMP DEFAULT NOW(),
      UNIQUE(fecha, hora)
    );

    CREATE TABLE IF NOT EXISTS lista_espera (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      telefono VARCHAR(30) NOT NULL,
      anotado_en TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('✅ Tablas listas en Neon');
}

// ── RUTAS DE CITAS ──

// GET /citas?fecha=2026-05-09 — obtener horas ocupadas de un día
app.get('/citas', async (req, res) => {
  const { fecha } = req.query;
  if (!fecha) return res.status(400).json({ error: 'Falta la fecha' });
  try {
    const result = await pool.query(
      'SELECT hora FROM citas WHERE fecha = $1',
      [fecha]
    );
    res.json({ ocupadas: result.rows.map(r => r.hora) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar citas' });
  }
});

// POST /citas — reservar una cita
app.post('/citas', async (req, res) => {
  const { nombre, telefono, servicio, fecha, hora, nota } = req.body;
  if (!nombre || !telefono || !servicio || !fecha || !hora) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  try {
    await pool.query(
      `INSERT INTO citas (nombre, telefono, servicio, fecha, hora, nota)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [nombre, telefono, servicio, fecha, hora, nota || null]
    );
    res.json({ ok: true, mensaje: 'Cita reservada con éxito' });
  } catch (err) {
    if (err.code === '23505') { // unique violation
      return res.status(409).json({ error: 'Esa hora ya está ocupada' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al guardar la cita' });
  }
});

// DELETE /citas/:id — cancelar una cita (para uso del barbero)
app.delete('/citas/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM citas WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al cancelar' });
  }
});

// GET /citas/todas — ver todas las citas (panel del barbero)
app.get('/citas/todas', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM citas ORDER BY fecha ASC, hora ASC'
    );
    res.json({ citas: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// ── RUTAS DE LISTA DE ESPERA ──

// GET /espera
app.get('/espera', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM lista_espera ORDER BY anotado_en ASC');
    res.json({ lista: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// POST /espera
app.post('/espera', async (req, res) => {
  const { nombre, telefono } = req.body;
  if (!nombre || !telefono) return res.status(400).json({ error: 'Faltan datos' });
  try {
    await pool.query(
      'INSERT INTO lista_espera (nombre, telefono) VALUES ($1, $2)',
      [nombre, telefono]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar' });
  }
});

// DELETE /espera/:id
app.delete('/espera/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM lista_espera WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// ── HEALTH CHECK ──
app.get('/', (req, res) => res.json({ status: 'Dorian Barbershop API corriendo ✅' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await initDB();
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
