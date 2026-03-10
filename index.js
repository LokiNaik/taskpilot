require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const cron     = require('node-cron');
const logger   = require('./config/logger');
const db       = require('./config/db');

const taskRoutes    = require('./routes/tasks');
const aiRoutes      = require('./routes/ai');
const digestRoutes  = require('./routes/digest');
const userRoutes    = require('./routes/users');

const reminderService = require('./services/reminderService');
const digestService   = require('./services/digestService');
const aiService       = require('./services/aiService');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ── Routes ───────────────────────────────────────────────────
app.use('/api/tasks',  taskRoutes);
app.use('/api/ai',     aiRoutes);
app.use('/api/digest', digestRoutes);
app.use('/api/users',  userRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// ── Cron Jobs ────────────────────────────────────────────────
// Every 5 min → check and fire reminders
cron.schedule('*/5 * * * *', () => {
  logger.info('Cron: checking reminders...');
  reminderService.sendDueReminders();
});

// 8:00 AM IST (2:30 UTC) → generate daily digest
cron.schedule('30 2 * * *', () => {
  logger.info('Cron: generating daily digests...');
  digestService.generateForAllUsers();
});

// 7:00 AM IST (1:30 UTC) → AI re-prioritize all tasks
cron.schedule('30 1 * * *', () => {
  logger.info('Cron: re-prioritizing tasks...');
  aiService.reprioritizeForAllUsers();
});

// ── Start Server ─────────────────────────────────────────────
async function start() {
  try {
    await db.query('SELECT 1'); // test DB connection
    logger.info('Database connected ✓');
    app.listen(PORT, () => {
      logger.info(`WorkLog AI running → http://localhost:${PORT}`);
      logger.info(`Health check     → http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    logger.error('Database connection failed: ' + err.message);
    logger.error('Make sure PostgreSQL is running and .env is configured correctly');
    process.exit(1);
  }
}

start();
