const express   = require('express');
const router    = express.Router();
const db        = require('../config/db');
const aiService = require('../services/aiService');

// ── GET /api/tasks?userId=&date= ─────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { userId, date, status } = req.query;

    if (!userId) return res.status(400).json({ error: 'userId is required' });

    let query  = 'SELECT * FROM tasks WHERE user_id = $1';
    const params = [userId];

    if (date) {
      params.push(date);
      query += ` AND log_date = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ' ORDER BY ai_priority_score DESC NULLS LAST, created_at DESC';

    const { rows } = await db.query(query, params);
    res.json({ tasks: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/tasks/:id ───────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/tasks — create task manually ───────────────────
router.post('/', async (req, res) => {
  try {
    const {
      userId, title, description,
      due_date, due_time, priority,
      tags, reminder_at, meeting_id,
    } = req.body;

    if (!userId || !title) {
      return res.status(400).json({ error: 'userId and title are required' });
    }

    const { rows } = await db.query(
      `INSERT INTO tasks
         (user_id, title, description, due_date, due_time, priority, tags, reminder_at, meeting_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [userId, title, description, due_date, due_time, priority || 'medium', tags || [], reminder_at, meeting_id]
    );

    const task = rows[0];

    // AI score in background (don't block the response)
    aiService.computePriorityScore(task)
      .then(({ score, reason }) =>
        db.query('UPDATE tasks SET ai_priority_score=$1, ai_notes=$2 WHERE id=$3', [score, reason, task.id])
      )
      .catch(() => {});

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/tasks/:id — update status or any field ────────
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['title', 'description', 'status', 'priority', 'due_date', 'due_time', 'reminder_at', 'tags'];
    const updates = [];
    const values  = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        values.push(req.body[key]);
        updates.push(`${key} = $${values.length}`);
      }
    }

    if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });

    // Log status change to history
    if (req.body.status) {
      const { rows: old } = await db.query('SELECT status FROM tasks WHERE id=$1', [req.params.id]);
      if (old[0] && old[0].status !== req.body.status) {
        await db.query(
          `INSERT INTO task_history (task_id, old_status, new_status) VALUES ($1,$2,$3)`,
          [req.params.id, old[0].status, req.body.status]
        );
      }
    }

    values.push(req.params.id);
    const { rows } = await db.query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/tasks/:id ─────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
