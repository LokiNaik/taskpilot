const router = require('express').Router();
const db     = require('../config/db');
const auth   = require('../middleware/auth');

router.use(auth);

// GET notes for a task — only task owner can see
router.get('/:taskId', async (req, res) => {
  try {
    // Verify task belongs to this user
    const taskCheck = await db.query(
      'SELECT id FROM tasks WHERE id=$1 AND user_id=$2',
      [req.params.taskId, req.userId]
    );
    if (!taskCheck.rows.length) return res.status(403).json({ error: 'Access denied' });

    const { rows } = await db.query(
      `SELECT n.*, u.name as author
       FROM task_notes n
       JOIN users u ON u.id = n.user_id
       WHERE n.task_id=$1
       ORDER BY n.created_at ASC`,
      [req.params.taskId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADD note
router.post('/:taskId', async (req, res) => {
  try {
    const taskCheck = await db.query(
      'SELECT id FROM tasks WHERE id=$1 AND user_id=$2',
      [req.params.taskId, req.userId]
    );
    if (!taskCheck.rows.length) return res.status(403).json({ error: 'Access denied' });

    const { note } = req.body;
    if (!note?.trim()) return res.status(400).json({ error: 'note required' });

    const { rows } = await db.query(
      `INSERT INTO task_notes (task_id, user_id, note)
       VALUES ($1,$2,$3) RETURNING *`,
      [req.params.taskId, req.userId, note.trim()]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE note (add progress to existing note)
router.patch('/:noteId', async (req, res) => {
  try {
    const { note } = req.body;
    if (!note?.trim()) return res.status(400).json({ error: 'note required' });

    const { rows } = await db.query(
      `UPDATE task_notes
       SET note=$1, updated_at=NOW()
       WHERE id=$2 AND user_id=$3
       RETURNING *`,
      [note.trim(), req.params.noteId, req.userId]
    );
    if (!rows.length) return res.status(403).json({ error: 'Access denied' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE note
router.delete('/:noteId', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM task_notes WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.noteId, req.userId]
    );
    if (!result.rows.length) return res.status(403).json({ error: 'Access denied' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;