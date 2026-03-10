const express   = require('express');
const router    = express.Router();
const db        = require('../config/db');
const aiService = require('../services/aiService');

// ── POST /api/ai/parse ───────────────────────────────────────
// Just parse NL text → preview the task (no save)
router.post('/parse', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const parsed = await aiService.parseNaturalLanguage(text);
    res.json({ parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai/add ─────────────────────────────────────────
// Parse NL text AND save the task to DB
router.post('/add', async (req, res) => {
  try {
    const { text, userId } = req.body;
    if (!text || !userId) return res.status(400).json({ error: 'text and userId are required' });

    // Step 1: AI parses the text
    const parsed = await aiService.parseNaturalLanguage(text);

    // Step 2: Compute reminder time if offset given
    let reminderAt = null;
    if (parsed.due_date && parsed.reminder_offset_minutes) {
      const dueDateTime = new Date(`${parsed.due_date}T${parsed.due_time || '09:00'}:00`);
      reminderAt = new Date(dueDateTime.getTime() - parsed.reminder_offset_minutes * 60 * 1000);
    }

    // Step 3: Save task
    const { rows } = await db.query(
      `INSERT INTO tasks
         (user_id, title, description, due_date, due_time, priority, tags, reminder_at, raw_input, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'natural_language')
       RETURNING *`,
      [
        userId,
        parsed.title,
        parsed.description,
        parsed.due_date,
        parsed.due_time,
        parsed.priority || 'medium',
        parsed.tags || [],
        reminderAt,
        text,
      ]
    );

    const task = rows[0];

    // Step 4: AI score in background
    aiService.computePriorityScore(task)
      .then(({ score, reason }) =>
        db.query('UPDATE tasks SET ai_priority_score=$1, ai_notes=$2 WHERE id=$3', [score, reason, task.id])
      )
      .catch(() => {});

    res.status(201).json({ task, parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai/reprioritize ─────────────────────────────────
// Re-score all tasks for a user
router.post('/reprioritize', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    await aiService.reprioritizeForUser(userId);
    res.json({ message: 'Done — all tasks re-scored' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
