const db        = require('../config/db');
const logger    = require('../config/logger');
const aiService = require('./aiService');

async function generateForUser(userId, date) {
  const dateStr = date || new Date().toISOString().split('T')[0];
  const result  = await aiService.generateDailyDigest(userId, dateStr);
  if (!result) return null;

  const { digest, stats } = result;
  await db.query(
    `INSERT INTO daily_digests (user_id, digest_date, summary_text, stats, top_tasks)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, digest_date)
     DO UPDATE SET summary_text=$3, stats=$4, top_tasks=$5, generated_at=NOW()`,
    [userId, dateStr, digest.summary, JSON.stringify(stats), JSON.stringify(digest.focus_tasks || [])]
  );
  logger.info(`Digest generated for ${userId} on ${dateStr}`);
  return { digest, stats };
}

async function generateForAllUsers() {
  const { rows } = await db.query('SELECT id FROM users');
  for (const user of rows) {
    await generateForUser(user.id);
  }
}

module.exports = { generateForUser, generateForAllUsers };
