const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

// GET /api/users — all users
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name, email, timezone FROM users ORDER BY created_at');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/users/:id — single user
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name, email, timezone FROM users WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/users — create user
router.post('/', async (req, res) => {
  try {
    const { name, email, timezone } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'name and email required' });
    const { rows } = await db.query(
      `INSERT INTO users (name, email, timezone)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET name=$1, timezone=$3
       RETURNING id, name, email, timezone`,
      [name, email, timezone || 'Asia/Kolkata']
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/users/:id — update user
router.patch('/:id', async (req, res) => {
  try {
    const { name, email, timezone } = req.body;
    const { rows } = await db.query(
      `UPDATE users SET
        name     = COALESCE($1, name),
        email    = COALESCE($2, email),
        timezone = COALESCE($3, timezone)
       WHERE id=$4
       RETURNING id, name, email, timezone`,
      [name, email, timezone, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
