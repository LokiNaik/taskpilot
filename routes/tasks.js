const router = require('express').Router();
const db     = require('../config/db');
const auth   = require('../middleware/auth');

// Apply auth to ALL routes
router.use(auth);

// GET all tasks — userId JWT se lega, query param se nahi
router.get('/', async (req, res) => {
  try {
    const { date, status } = req.query;
    const userId = req.userId; // ← JWT se, safe!

    let query  = `SELECT * FROM tasks WHERE user_id=$1`;
    let values = [userId];
    let idx    = 2;

    if (date)   { query += ` AND (log_date=$${idx} OR due_date=$${idx})`; values.push(date); idx++; }
    if (status) { query += ` AND status=$${idx}`;  values.push(status); idx++; }

    query += ` ORDER BY ai_priority_score DESC NULLS LAST, created_at DESC`;

    const { rows } = await db.query(query, values);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single task — ownership check
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM tasks WHERE id=$1 AND user_id=$2',
      [req.params.id, req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create task
router.post('/', async (req, res) => {
  try {
    const { title, description, priority, due_date, due_time, tags, source } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });

    const { rows } = await db.query(
      `INSERT INTO tasks
        (user_id, title, description, priority, due_date, due_time, tags, source, log_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_DATE)
       RETURNING *`,
      [
        req.userId,
        title,
        description || null,
        priority    || 'medium',
        due_date    || null,
        due_time    || null,
        tags        || [],
        source      || 'manual'
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update — ownership check
router.patch('/:id', async (req, res) => {
  try {
    // Verify ownership first
    const check = await db.query(
      'SELECT id FROM tasks WHERE id=$1 AND user_id=$2',
      [req.params.id, req.userId]
    );
    if (!check.rows.length) return res.status(403).json({ error: 'Access denied' });

    const allowed = ['title','description','status','priority',
                     'due_date','due_time','tags','ai_notes'];
    const updates = [];
    const values  = [];
    let idx = 1;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key}=$${idx++}`);
        if ((key === 'due_date' || key === 'due_time') && req.body[key] === '') {
          values.push(null);
        } else {
          values.push(req.body[key]);
        }
      }
    }

    if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
    updates.push(`updated_at=NOW()`);
    values.push(req.params.id);

    const { rows } = await db.query(
      `UPDATE tasks SET ${updates.join(',')} WHERE id=$${idx} RETURNING *`,
      values
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE — ownership check
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM tasks WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (!result.rows.length) return res.status(403).json({ error: 'Access denied' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;