const express       = require('express');
const router        = express.Router();
const db            = require('../config/db');
const digestService = require('../services/digestService');

// ── GET /api/digest?userId=&date= ────────────────────────────
// Returns existing digest or generates one on the fly
router.get('/', async (req, res) => {
  try {
     const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const dateStr = date || new Date().toISOString().split('T')[0];

    // Check if already generated today
    const { rows } = await db.query(
      `SELECT * FROM daily_digests WHERE user_id=$1 AND digest_date=$2`,
      [userId, dateStr]
    );

    if (rows.length) return res.json(rows[0]);

    // Not found → generate now
    const result = await digestService.generateForUser(userId, dateStr);
    if (!result) return res.json({ message: 'No tasks found for this date' });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/digest/generate ─────────────────────────────────
// Force regenerate digest for a date
router.post('/generate', async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const result = await digestService.generateForUser(userId, date);
    res.json(result || { message: 'No tasks found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/digest/history?userId= ──────────────────────────
// Last 30 daily digests
router.get('/history', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const { rows } = await db.query(
      `SELECT digest_date, summary_text, stats
       FROM daily_digests
       WHERE user_id=$1
       ORDER BY digest_date DESC
       LIMIT 30`,
      [userId]
    );

    res.json({ digests: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
