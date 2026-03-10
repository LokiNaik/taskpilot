# 🧠 WorkLog AI

> Your intelligent daily work-log agent. Just type naturally — AI handles the rest.

![Node.js](https://img.shields.io/badge/Node.js-20+-green) ![Angular](https://img.shields.io/badge/Angular-17-red) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue) ![Claude AI](https://img.shields.io/badge/AI-Claude%20Sonnet-orange)

---

## What is this?

WorkLog AI is a smart task management system built for professionals who are in back-to-back meetings and need to quickly log todos, status updates, and work items without the friction of traditional tools.

Instead of manually filling forms or updating spreadsheets daily, you just **type naturally** like:

> *"Call Ravi about Q2 budget tomorrow 3pm, high priority"*

The AI agent parses it, sets the due date, assigns priority, scores urgency, and adds it to your daily log — automatically.

---

## Features

| Feature | Description |
|---|---|
| **Natural Language Input** | Type tasks in plain English — AI extracts title, date, time, priority, tags |
| **AI Priority Scoring** | Every task gets an urgency score (0–100) powered by Claude AI |
| **Smart Reminders** | Cron job checks every 5 minutes and fires reminders before due time |
| **Daily Digest** | AI generates a morning briefing — what to focus on, wins, warnings |
| **Status Tracking** | Todo → In Progress → Blocked → Done → Deferred |
| **Day-wise Sorting** | All tasks organized by date, sorted by AI priority score |
| **Task History** | Every status change is logged with timestamps |

---

## Tech Stack

```
Frontend   →  Angular 17 (Standalone Components)
Backend    →  Node.js 20 + Express.js
Database   →  PostgreSQL 16
AI Engine  →  Anthropic Claude (claude-sonnet-4-20250514)
Scheduler  →  node-cron
Styling    →  SCSS with CSS Variables
```

---

## Project Structure

```
worklog-ai/
│
├── backend/
│   ├── config/
│   │   ├── db.js                 ← PostgreSQL connection pool
│   │   └── logger.js             ← Winston logger
│   ├── routes/
│   │   ├── tasks.js              ← CRUD for tasks
│   │   ├── ai.js                 ← NL parse + reprioritize endpoints
│   │   ├── digest.js             ← Daily digest endpoints
│   │   └── users.js              ← User management
│   ├── services/
│   │   ├── aiService.js          ← Claude AI integration (NL, scoring, digest)
│   │   ├── reminderService.js    ← Cron-based reminder firing
│   │   └── digestService.js      ← Digest generation + DB save
│   ├── logs/                     ← Auto-generated log files
│   ├── index.js                  ← App entry point + cron jobs
│   ├── schema.sql                ← PostgreSQL schema (run once)
│   ├── package.json
│   └── .env                      ← Environment variables
│
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── components/
    │   │   │   ├── header/       ← Top navigation bar
    │   │   │   ├── sidebar/      ← Left nav (Today, Upcoming, All Tasks)
    │   │   │   ├── nl-input/     ← Natural language task input bar
    │   │   │   ├── task-card/    ← Individual task card with actions
    │   │   │   └── digest-panel/ ← Slide-in daily digest panel
    │   │   ├── pages/
    │   │   │   ├── today/        ← Today's task board (main view)
    │   │   │   ├── upcoming/     ← Tasks grouped by due date
    │   │   │   └── all-tasks/    ← All tasks with search
    │   │   ├── services/
    │   │   │   ├── task.service.ts   ← All API calls
    │   │   │   └── user.service.ts   ← Current user state
    │   │   ├── models/
    │   │   │   └── task.model.ts     ← TypeScript interfaces
    │   │   ├── app.component.ts
    │   │   ├── app.config.ts
    │   │   └── app.routes.ts
    │   ├── environments/
    │   │   └── environment.ts
    │   ├── styles.scss           ← Global styles + CSS variables
    │   └── index.html
    ├── angular.json
    ├── proxy.conf.json           ← Proxy /api → localhost:3000
    ├── tsconfig.json
    └── package.json
```

---

## Prerequisites

Make sure these are installed before starting:

| Tool | Version | Download |
|---|---|---|
| Node.js | 20+ | https://nodejs.org |
| PostgreSQL | 16+ | https://postgresql.org/download |
| pgAdmin | Any | https://pgadmin.org (usually comes with PostgreSQL) |
| Angular CLI | 17+ | `npm install -g @angular/cli` |

---

## Setup & Installation

### Step 1 — Clone the repo

```bash
git clone https://github.com/yourusername/worklog-ai.git
cd worklog-ai
```

---

### Step 2 — Database Setup

1. Open **pgAdmin**
2. Right click **Databases** → **Create** → **Database**
3. Name it: `worklog_ai`
4. Select the new database → **Tools** → **Query Tool**
5. Open `backend/schema.sql`, paste the entire content, press **F5**

You should see these tables created:
- `users`
- `tasks`
- `meetings`
- `daily_digests`
- `task_history`

---

### Step 3 — Backend Setup

```bash
cd backend
npm install
```

Edit `.env` file:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=worklog_ai
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Get your Anthropic API key from → https://console.anthropic.com

Start the backend:

```bash
npm start
```

Expected output:
```
[INFO]: Database connected ✓
[INFO]: WorkLog AI running → http://localhost:3000
[INFO]: Health check     → http://localhost:3000/api/health
```

---

### Step 4 — Create your user

Hit this in Postman or your browser (POST request):

```
POST http://localhost:3000/api/users
Content-Type: application/json

{
  "name": "Your Name",
  "email": "you@example.com"
}
```

Save the `id` from the response — that is your `userId`.

---

### Step 5 — Frontend Setup

```bash
cd frontend
npm install
npm start
```

Open browser → `http://localhost:4200`

---

## API Reference

### Users

| Method | Endpoint | Body | Description |
|---|---|---|---|
| GET | `/api/users` | — | Get all users |
| GET | `/api/users/:id` | — | Get single user |
| POST | `/api/users` | `{ name, email, timezone }` | Create user |
| PATCH | `/api/users/:id` | `{ name?, email?, timezone? }` | Update user |
| DELETE | `/api/users/:id` | — | Delete user |

---

### Tasks

| Method | Endpoint | Body / Params | Description |
|---|---|---|---|
| GET | `/api/tasks` | `?userId=&date=&status=` | Get tasks (filtered by date/status) |
| GET | `/api/tasks/:id` | — | Get single task |
| POST | `/api/tasks` | `{ userId, title, priority, due_date, ... }` | Create task manually |
| PATCH | `/api/tasks/:id` | `{ status?, priority?, title?, ... }` | Update task |
| DELETE | `/api/tasks/:id` | — | Delete task |

---

### AI

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/api/ai/parse` | `{ text }` | Parse NL text → preview (no save) |
| POST | `/api/ai/add` | `{ text, userId }` | Parse NL text + save task to DB |
| POST | `/api/ai/reprioritize` | `{ userId }` | Re-score all tasks for a user |

---

### Digest

| Method | Endpoint | Body / Params | Description |
|---|---|---|---|
| GET | `/api/digest` | `?userId=&date=` | Get digest (generates if not exists) |
| POST | `/api/digest/generate` | `{ userId, date? }` | Force regenerate digest |
| GET | `/api/digest/history` | `?userId=` | Last 30 daily digests |

---

## Database Schema

```sql
users          → id, name, email, timezone, created_at
tasks          → id, user_id, title, description, status, priority, source,
                 due_date, due_time, reminder_at, tags, ai_priority_score,
                 ai_notes, log_date, created_at, updated_at
meetings       → id, user_id, title, meeting_at, attendees, raw_notes
daily_digests  → id, user_id, digest_date, summary_text, stats, top_tasks
task_history   → id, task_id, old_status, new_status, changed_at
```

**Task Status values:** `todo` | `in_progress` | `blocked` | `done` | `deferred`

**Task Priority values:** `critical` | `high` | `medium` | `low`

---

## Cron Jobs

Three background jobs run automatically when the backend starts:

| Job | Schedule | What it does |
|---|---|---|
| Reminder check | Every 5 minutes | Finds tasks with `reminder_at <= now` and fires alerts |
| Daily digest | 8:00 AM IST (2:30 UTC) | AI generates digest for all users |
| Re-prioritize | 7:00 AM IST (1:30 UTC) | AI re-scores all active tasks |

---

## AI Features Deep Dive

### Natural Language Parsing

Input:
```
"Call Ravi about Q2 budget tomorrow 3pm, high priority"
```

Claude extracts:
```json
{
  "title": "Call Ravi about Q2 budget",
  "due_date": "2026-03-11",
  "due_time": "15:00",
  "priority": "high",
  "tags": ["ravi", "budget", "q2"],
  "reminder_offset_minutes": 30
}
```

---

### AI Priority Scoring

Every task gets scored 0–100 based on:
- User-set priority (critical/high/medium/low)
- Days until due date
- Current status
- Context from title

Score ranges:
- **80–100** → 🔴 Drop everything
- **60–79**  → 🟡 Do today
- **40–59**  → 🔵 Schedule it
- **0–39**   → ⚪ Low urgency

---

### Daily Digest

Generated every morning (or on demand), contains:
- **Summary** — 2-3 sentence narrative of your day
- **Focus tasks** — Top 3 things to do today
- **Wins** — Completed tasks to celebrate
- **Warnings** — Overdue or blocked items

---

## Cost Estimate (Claude API)

| Action | Approx Cost |
|---|---|
| 1 task NL parse | ~$0.001 |
| 1 task AI scoring | ~$0.0006 |
| 1 daily digest | ~$0.002 |
| **20 tasks/day + digest** | **~$0.025/day (~₹2)** |

**$5 credits lasts approximately 200 days** of regular use.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Backend port (default: 3000) |
| `DB_HOST` | Yes | PostgreSQL host |
| `DB_PORT` | No | PostgreSQL port (default: 5432) |
| `DB_NAME` | Yes | Database name |
| `DB_USER` | Yes | Database user |
| `DB_PASSWORD` | Yes | Database password |
| `ANTHROPIC_API_KEY` | Yes | Claude API key from console.anthropic.com |

---

## Switching AI Provider

The AI is pluggable. To switch from Claude to another provider, only `backend/services/aiService.js` needs to be updated.

**Supported providers:**
- Anthropic Claude ✅ (default)
- OpenAI GPT-4o → `npm install openai`
- Google Gemini → `npm install @google/generative-ai`
- Azure OpenAI → `npm install @azure/openai`

---

## Roadmap

- [ ] Email reminders via Nodemailer
- [ ] WhatsApp reminders via Twilio
- [ ] Browser push notifications
- [ ] Multi-user login with JWT auth
- [ ] Meeting notes → auto task extraction
- [ ] OneDrive / Google Drive sync
- [ ] Mobile responsive UI
- [ ] Spring Boot backend (Java alternative)
- [ ] Docker Compose setup

---

## Contributing

1. Fork the repo
2. Create your branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m "Add your feature"`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

MIT License — free to use, modify, and distribute.

---

## Author

Built with ❤️ using Claude AI, Angular, Node.js, and PostgreSQL.
```
