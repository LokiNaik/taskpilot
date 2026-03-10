const db     = require('../config/db');
const logger = require('../config/logger');

async function sendDueReminders() {
  const now = new Date();

  const { rows } = await db.query(
    `SELECT t.id, t.title, t.due_date, t.due_time, u.email, u.name
     FROM tasks t
     JOIN users u ON u.id = t.user_id
     WHERE t.reminder_at <= $1
       AND t.reminder_sent = FALSE
       AND t.status NOT IN ('done', 'deferred')`,
    [now]
  );

  for (const task of rows) {
    // Log the reminder (replace this with email/WhatsApp later)
    logger.info(`⏰ REMINDER for ${task.name}: "${task.title}" is due ${task.due_date}`);

    // Mark as sent
    await db.query(
      `UPDATE tasks SET reminder_sent = TRUE WHERE id = $1`,
      [task.id]
    );
  }

  if (rows.length > 0) {
    logger.info(`Sent ${rows.length} reminder(s)`);
  }
}

module.exports = { sendDueReminders };
