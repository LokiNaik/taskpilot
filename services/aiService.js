const Anthropic = require('@anthropic-ai/sdk');
const db        = require('../config/db');
const logger    = require('../config/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL  = 'claude-sonnet-4-20250514';

async function callClaude(system, userText) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: system,
    messages: [{ role: 'user', content: userText }],
  });
  const text = response.content[0].text.trim();
  return text.replace(/```json|```/g, '').trim();
}

async function parseNaturalLanguage(rawText) {
  const today = new Date().toISOString().split('T')[0];
  const system = `You are a work-log assistant. Parse the user's text into a task.
Return ONLY valid JSON — no explanation, no markdown, no backticks.
{
  "title": string,
  "description": string or null,
  "due_date": "YYYY-MM-DD" or null,
  "due_time": "HH:MM" or null,
  "priority": "critical" | "high" | "medium" | "low",
  "tags": string[],
  "reminder_offset_minutes": number or null
}
Today is ${today}. Default priority: medium.`;

  try {
    const text = await callClaude(system, rawText);
    return JSON.parse(text);
  } catch {
    return { title: rawText, description: null, due_date: null, due_time: null, priority: 'medium', tags: [], reminder_offset_minutes: null };
  }
}

async function computePriorityScore(task) {
  const daysUntilDue = task.due_date
    ? Math.ceil((new Date(task.due_date) - new Date()) / 86400000)
    : null;

  const prompt = `
Rate the urgency of this work task from 0 to 100 (100 = drop everything now).
Return ONLY valid JSON: { "score": number, "reason": "one line explanation" }

Task: ${task.title}
Priority: ${task.priority}
Status: ${task.status}
Days until due: ${daysUntilDue !== null ? daysUntilDue : 'no deadline'}
`;

  try {
    const text = await callClaude('You are a task prioritization assistant.', prompt);
    return JSON.parse(text);
  } catch {
    return { score: 50, reason: 'Default score' };
  }
}

async function reprioritizeForUser(userId) {
  const { rows: tasks } = await db.query(
    `SELECT id, title, priority, status, due_date FROM tasks
     WHERE user_id=$1 AND status NOT IN ('done','deferred')`,
    [userId]
  );
  for (const task of tasks) {
    try {
      const { score, reason } = await computePriorityScore(task);
      await db.query('UPDATE tasks SET ai_priority_score=$1, ai_notes=$2 WHERE id=$3', [score, reason, task.id]);
    } catch (err) {
      logger.error(`Score failed for ${task.id}: ${err.message}`);
    }
  }
  logger.info(`Reprioritized ${tasks.length} tasks for user ${userId}`);
}

async function reprioritizeForAllUsers() {
  const { rows } = await db.query('SELECT id FROM users');
  for (const user of rows) await reprioritizeForUser(user.id);
}

async function generateDailyDigest(userId, date) {
  const { rows: tasks } = await db.query(
    `SELECT title, status, priority, due_date, ai_priority_score FROM tasks
     WHERE user_id=$1 AND status NOT IN ('deferred')
     ORDER BY ai_priority_score DESC NULLS LAST
     LIMIT 20`,
    [userId]
  );

  logger.info(`Digest: found ${tasks.length} tasks for user ${userId}`);
  if (tasks.length === 0) return null;

  const taskList = tasks.map((t, i) =>
    `${i+1}. [${t.status}] ${t.title} | priority: ${t.priority} | due: ${t.due_date || 'none'}`
  ).join('\n');

  const system = `Generate a daily work digest. Return ONLY valid JSON — no markdown, no backticks:
{
  "summary": "2-3 sentence overview of the day",
  "focus_tasks": ["top 3 task titles to focus on"],
  "wins": ["completed task titles"],
  "warnings": ["overdue or blocked items"]
}`;

  try {
    const text = await callClaude(system, `Date: ${date}\nTasks:\n${taskList}`);
    logger.info(`Claude response: ${text}`);
    const digest = JSON.parse(text);
    const stats  = {
      total:    tasks.length,
      done:     tasks.filter(t => t.status === 'done').length,
      pending:  tasks.filter(t => t.status === 'todo').length,
      critical: tasks.filter(t => t.priority === 'critical').length,
    };
    return { digest, stats };
  } catch (err) {
    logger.error(`Digest parse failed: ${err.message}`);
    return null;
  }
}

module.exports = { parseNaturalLanguage, computePriorityScore, reprioritizeForUser, reprioritizeForAllUsers, generateDailyDigest };


// -------------------------------------------------------------
// this is for gemini integration
// ____________________________________________
// const { GoogleGenerativeAI } = require('@google/generative-ai');
// const db     = require('../config/db');
// const logger = require('../config/logger');

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// // const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
// // const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
// const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
// // const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });


// // ─────────────────────────────────────────────────────────────
// // helper — single call to Gemini
// // ─────────────────────────────────────────────────────────────
// async function callGemini(prompt) {
//   const result = await model.generateContent(prompt);
//   const text   = result.response.text().trim();
//   // strip markdown code fences if any
//   return text.replace(/```json|```/g, '').trim();
// }

// // ─────────────────────────────────────────────────────────────
// // 1. Parse natural language input
// // ─────────────────────────────────────────────────────────────
// async function parseNaturalLanguage(rawText) {
//   const today = new Date().toISOString().split('T')[0];

//   const prompt = `
// You are a work-log assistant. Parse the user's text into a task.
// Return ONLY valid JSON — no explanation, no markdown, no backticks.
// {
//   "title": string,
//   "description": string or null,
//   "due_date": "YYYY-MM-DD" or null,
//   "due_time": "HH:MM" or null,
//   "priority": "critical" | "high" | "medium" | "low",
//   "tags": string[],
//   "reminder_offset_minutes": number or null
// }
// Today is ${today}. Default priority: medium.

// User input: ${rawText}
// `;

//   try {
//     const text = await callGemini(prompt);
//     return JSON.parse(text);
//   } catch {
//     return {
//       title: rawText,
//       description: null,
//       due_date: null,
//       due_time: null,
//       priority: 'medium',
//       tags: [],
//       reminder_offset_minutes: null,
//     };
//   }
// }

// // ─────────────────────────────────────────────────────────────
// // 2. Score a task urgency (0-100)
// // ─────────────────────────────────────────────────────────────
// async function computePriorityScore(task) {
//   const daysUntilDue = task.due_date
//     ? Math.ceil((new Date(task.due_date) - new Date()) / 86400000)
//     : null;

//   const prompt = `
// Rate the urgency of this work task from 0 to 100 (100 = drop everything now).
// Return ONLY valid JSON: { "score": number, "reason": "one line explanation" }

// Task: ${task.title}
// Priority: ${task.priority}
// Status: ${task.status}
// Days until due: ${daysUntilDue !== null ? daysUntilDue : 'no deadline'}
// `;

//   try {
//     const text = await callGemini(prompt);
//     return JSON.parse(text);
//   } catch {
//     return { score: 50, reason: 'Default score' };
//   }
// }

// // ─────────────────────────────────────────────────────────────
// // 3. Re-score all active tasks for a user
// // ─────────────────────────────────────────────────────────────
// async function reprioritizeForUser(userId) {
//   const { rows: tasks } = await db.query(
//     `SELECT id, title, priority, status, due_date FROM tasks
//      WHERE user_id=$1 AND status NOT IN ('done','deferred')`,
//     [userId]
//   );

//   for (const task of tasks) {
//     try {
//       const { score, reason } = await computePriorityScore(task);
//       await db.query(
//         'UPDATE tasks SET ai_priority_score=$1, ai_notes=$2 WHERE id=$3',
//         [score, reason, task.id]
//       );
//     } catch (err) {
//       logger.error(`Score failed for ${task.id}: ${err.message}`);
//     }
//   }

//   logger.info(`Reprioritized ${tasks.length} tasks for user ${userId}`);
// }

// async function reprioritizeForAllUsers() {
//   const { rows } = await db.query('SELECT id FROM users');
//   for (const user of rows) await reprioritizeForUser(user.id);
// }

// // ─────────────────────────────────────────────────────────────
// // 4. Generate daily digest
// // ─────────────────────────────────────────────────────────────
// async function generateDailyDigest(userId, date) {
//   const { rows: tasks } = await db.query(
//     `SELECT title, status, priority, due_date, ai_priority_score FROM tasks
//      WHERE user_id=$1 AND status NOT IN ('deferred')
//      ORDER BY ai_priority_score DESC NULLS LAST
//      LIMIT 20`,
//     [userId]
//   );

//   logger.info(`Digest: found ${tasks.length} tasks for user ${userId}`);

//   if (tasks.length === 0) return null;

//   const taskList = tasks.map((t, i) =>
//     `${i+1}. [${t.status}] ${t.title} | priority: ${t.priority} | due: ${t.due_date || 'none'}`
//   ).join('\n');

//   const prompt = `
// Generate a daily work digest. Return ONLY valid JSON — no markdown, no backticks, no extra text:
// {
//   "summary": "2-3 sentence overview of the day",
//   "focus_tasks": ["top 3 task titles to focus on"],
//   "wins": ["completed task titles"],
//   "warnings": ["overdue or blocked items"]
// }

// Date: ${date}
// Tasks:
// ${taskList}
// `;

//   try {
//     const text = await callGemini(prompt);
//     logger.info(`Gemini raw response: ${text}`);

//     const digest = JSON.parse(text);
//     const stats  = {
//       total:    tasks.length,
//       done:     tasks.filter(t => t.status === 'done').length,
//       pending:  tasks.filter(t => t.status === 'todo').length,
//       critical: tasks.filter(t => t.priority === 'critical').length,
//     };
//     return { digest, stats };
//   } catch (err) {
//     logger.error(`Digest parse failed: ${err.message}`);
//     return null;
//   }
// }

// module.exports = {
//   parseNaturalLanguage,
//   computePriorityScore,
//   reprioritizeForUser,
//   reprioritizeForAllUsers,
//   generateDailyDigest,
// };




// // ─────────────────────────────────────────────────────────────
// // Github openAi
// // ─────────────────────────────────────────────────────────────

// const { OpenAI } = require('openai');
// const db     = require('../config/db');
// const logger = require('../config/logger');
 
// const client = new OpenAI({
//   endpoint:   'https://models.inference.ai.azure.com',
//   apiKey:     process.env.GITHUB_TOKEN,
//   // apiVersion: '2024-05-01-preview',
//   // deployment: process.env.GITHUB_AI_MODEL || 'gpt-4o',
// });
 
// async function callAI(system, userText) {
//   const response = await client.chat.completions.create({
//     model:    process.env.GITHUB_AI_MODEL || 'gpt-4o',
//     messages: [
//       { role: 'system', content: system },
//       { role: 'user',   content: userText }
//     ],
//     max_tokens: 1000,
//   });
//   const text = response.choices[0].message.content.trim();
//   return text.replace(/```json|```/g, '').trim();
// }
 
// async function parseNaturalLanguage(rawText) {
//   const today = new Date().toISOString().split('T')[0];
//   const system = `You are a work-log assistant. Parse the user's text into a task.
// Return ONLY valid JSON — no explanation, no markdown, no backticks.
// {
//   "title": string,
//   "description": string or null,
//   "due_date": "YYYY-MM-DD" or null,
//   "due_time": "HH:MM" or null,
//   "priority": "critical" | "high" | "medium" | "low",
//   "tags": string[],
//   "reminder_offset_minutes": number or null
// }
// Today is ${today}. Default priority: medium.`;
 
//   try {
//     const text = await callAI(system, rawText);
//     return JSON.parse(text);
//   } catch {
//     return {
//       title: rawText, description: null, due_date: null,
//       due_time: null, priority: 'medium', tags: [],
//       reminder_offset_minutes: null
//     };
//   }
// }
 
// async function computePriorityScore(task) {
//   const daysUntilDue = task.due_date
//     ? Math.ceil((new Date(task.due_date) - new Date()) / 86400000)
//     : null;
 
//   const prompt = `
// Rate the urgency of this work task from 0 to 100 (100 = drop everything now).
// Return ONLY valid JSON: { "score": number, "reason": "one line explanation" }
 
// Task: ${task.title}
// Priority: ${task.priority}
// Status: ${task.status}
// Days until due: ${daysUntilDue !== null ? daysUntilDue : 'no deadline'}
// `;
 
//   try {
//     const text = await callAI('You are a task prioritization assistant.', prompt);
//     return JSON.parse(text);
//   } catch {
//     return { score: 50, reason: 'Default score' };
//   }
// }
 
// async function reprioritizeForUser(userId) {
//   const { rows: tasks } = await db.query(
//     `SELECT id, title, priority, status, due_date FROM tasks
//      WHERE user_id=$1 AND status NOT IN ('done','deferred')`,
//     [userId]
//   );
//   for (const task of tasks) {
//     try {
//       const { score, reason } = await computePriorityScore(task);
//       await db.query(
//         'UPDATE tasks SET ai_priority_score=$1, ai_notes=$2 WHERE id=$3',
//         [score, reason, task.id]
//       );
//     } catch (err) {
//       logger.error(`Score failed for ${task.id}: ${err.message}`);
//     }
//   }
//   logger.info(`Reprioritized ${tasks.length} tasks for user ${userId}`);
// }
 
// async function reprioritizeForAllUsers() {
//   const { rows } = await db.query('SELECT id FROM users');
//   for (const user of rows) await reprioritizeForUser(user.id);
// }
 
// async function generateDailyDigest(userId, date) {
//   const { rows: tasks } = await db.query(
//     `SELECT title, status, priority, due_date, ai_priority_score FROM tasks
//      WHERE user_id=$1 AND status NOT IN ('deferred')
//      ORDER BY ai_priority_score DESC NULLS LAST
//      LIMIT 20`,
//     [userId]
//   );
 
//   logger.info(`Digest: found ${tasks.length} tasks for user ${userId}`);
//   if (tasks.length === 0) return null;
 
//   const taskList = tasks.map((t, i) =>
//     `${i+1}. [${t.status}] ${t.title} | priority: ${t.priority} | due: ${t.due_date || 'none'}`
//   ).join('\n');
 
//   const system = `Generate a daily work digest. Return ONLY valid JSON — no markdown, no backticks:
// {
//   "summary": "2-3 sentence overview of the day",
//   "focus_tasks": ["top 3 task titles to focus on"],
//   "wins": ["completed task titles"],
//   "warnings": ["overdue or blocked items"]
// }`;
 
//   try {
//     const text = await callAI(system, `Date: ${date}\nTasks:\n${taskList}`);
//     logger.info(`AI response: ${text}`);
//     const digest = JSON.parse(text);
//     const stats  = {
//       total:    tasks.length,
//       done:     tasks.filter(t => t.status === 'done').length,
//       pending:  tasks.filter(t => t.status === 'todo').length,
//       critical: tasks.filter(t => t.priority === 'critical').length,
//     };
//     return { digest, stats };
//   } catch (err) {
//     logger.error(`Digest parse failed: ${err}`);
//     logger.error(`Digest parse failed: ${err.message}`);
//     return null;
//   }
// }
 
// module.exports = {
//   parseNaturalLanguage,
//   computePriorityScore,
//   reprioritizeForUser,
//   reprioritizeForAllUsers,
//   generateDailyDigest
// };