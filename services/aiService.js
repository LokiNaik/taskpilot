const Anthropic = require('@anthropic-ai/sdk');
const db        = require('../config/db');
const logger    = require('../config/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL  = 'claude-sonnet-4-20250514';

// ─────────────────────────────────────────────────────────────
// 1. Parse natural language input into a structured task
// ─────────────────────────────────────────────────────────────
async function parseNaturalLanguage(rawText) {
  const today = new Date().toISOString().split('T')[0];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: `You are a work-log assistant. Parse the user's text into a task.
Return ONLY valid JSON — no explanation, no markdown, no backticks.
{
  "title":                    string,
  "description":              string or null,
  "due_date":                 "YYYY-MM-DD" or null,
  "due_time":                 "HH:MM" or null,
  "priority":                 "critical" | "high" | "medium" | "low",
  "tags":                     string[],
  "reminder_offset_minutes":  number or null
}
Today is ${today}. If user says "tomorrow", compute the date correctly. Default priority: medium.`,
    messages: [{ role: 'user', content: rawText }],
  });

  const text = response.content[0].text.trim();
  try {
    return JSON.parse(text);
  } catch {
    // Fallback if Claude returns unexpected format
    return {
      title: rawText,
      description: null,
      due_date: null,
      due_time: null,
      priority: 'medium',
      tags: [],
      reminder_offset_minutes: null,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// 2. Score a task's urgency (0–100)
// ─────────────────────────────────────────────────────────────
async function computePriorityScore(task) {
  const daysUntilDue = task.due_date
    ? Math.ceil((new Date(task.due_date) - new Date()) / 86400000)
    : null;

  const prompt = `
Rate the urgency of this work task from 0 to 100 (100 = drop everything now).
Return ONLY valid JSON: { "score": number, "reason": "one line explanation" }

Task title:       ${task.title}
User priority:    ${task.priority}
Status:           ${task.status}
Days until due:   ${daysUntilDue !== null ? daysUntilDue : 'no deadline'}
`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  });

  try {
    return JSON.parse(response.content[0].text.trim());
  } catch {
    return { score: 50, reason: 'Default score' };
  }
}

// ─────────────────────────────────────────────────────────────
// 3. Re-score all active tasks for a user
// ─────────────────────────────────────────────────────────────
async function reprioritizeForUser(userId) {
  const { rows: tasks } = await db.query(
    `SELECT id, title, priority, status, due_date
     FROM tasks
     WHERE user_id = $1 AND status NOT IN ('done', 'deferred')`,
    [userId]
  );

  for (const task of tasks) {
    try {
      const { score, reason } = await computePriorityScore(task);
      await db.query(
        `UPDATE tasks SET ai_priority_score = $1, ai_notes = $2 WHERE id = $3`,
        [score, reason, task.id]
      );
    } catch (err) {
      logger.error(`Failed to score task ${task.id}: ${err.message}`);
    }
  }

  logger.info(`Reprioritized ${tasks.length} tasks for user ${userId}`);
}

async function reprioritizeForAllUsers() {
  const { rows } = await db.query('SELECT id FROM users');
  for (const user of rows) {
    await reprioritizeForUser(user.id);
  }
}

// ─────────────────────────────────────────────────────────────
// 4. Generate daily digest summary for a user
// ─────────────────────────────────────────────────────────────
async function generateDailyDigest(userId, date) {
  const { rows: tasks } = await db.query(
    `SELECT title, status, priority, due_date, ai_priority_score
     FROM tasks
     WHERE user_id = $1
       AND (log_date = $2 OR due_date = $2 OR status = 'in_progress')
     ORDER BY ai_priority_score DESC NULLS LAST`,
    [userId, date]
  );

  if (tasks.length === 0) return null;

  const taskList = tasks
    .map((t, i) =>
      `${i + 1}. [${t.status}] ${t.title} | priority: ${t.priority} | due: ${t.due_date || 'none'}`
    )
    .join('\n');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: `You are a personal work assistant generating a daily work digest.
Be concise and motivating. Return ONLY valid JSON:
{
  "summary":     "2-3 sentence overview of the day",
  "focus_tasks": ["top task 1", "top task 2", "top task 3"],
  "wins":        ["completed task titles"],
  "warnings":    ["overdue or blocked items"]
}`,
    messages: [{
      role: 'user',
      content: `Date: ${date}\nMy tasks:\n${taskList}`,
    }],
  });

  try {
    const digest = JSON.parse(response.content[0].text.trim());
    const stats = {
      total:    tasks.length,
      done:     tasks.filter(t => t.status === 'done').length,
      pending:  tasks.filter(t => t.status === 'todo').length,
      critical: tasks.filter(t => t.priority === 'critical').length,
    };
    return { digest, stats };
  } catch {
    return null;
  }
}

module.exports = {
  parseNaturalLanguage,
  computePriorityScore,
  reprioritizeForUser,
  reprioritizeForAllUsers,
  generateDailyDigest,
};
