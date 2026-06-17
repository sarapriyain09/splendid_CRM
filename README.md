# Splendid CRM

Splendid CRM is a full-stack B2B sales CRM for Splendid Technology.

It is optimized for prospecting, qualification, outreach, pipeline management, and quote operations, with AI-assisted workflows and UK-focused lead sources.

## Project Scope

This project covers the complete sales workflow:

- Prospect generation and scoring (Companies House and website analysis)
- Lead management and stage progression
- Multi-channel outreach (email and SMS)
- Template-driven messaging by vertical
- AI-assisted drafting, insights, and bulk actions
- Quote generation and tracking
- Task/follow-up management
- LinkedIn lead form integration
- Upwork lead import and proposal pipeline tracking

## Core Business Features

### 1) Prospect and Lead Operations

- Prospect Generator and Prospect Finder flows
- Lead detail pages with notes, contacts, tasks, and quote linkage
- Pipeline board with drag-and-drop stage movement
- Vertical classification support:
	- CRM
	- Digital
	- Software
	- AI Automation
	- Engineering
	- IoT

### 2) Outreach and Messaging

- Single send email and SMS actions
- Bulk outreach actions from AI popup
- Vertical-specific templates stored in DB
- AI template regeneration from user guidance
- Save template per vertical or apply template to all verticals
- Outreach template admin page at `/settings/templates`

### 3) AI Assistant

In-app assistant supports:

- CRM Q&A
- Lead summary
- Follow-up email drafting
- Pipeline insights
- AI actions for mass operations and outreach template refinement

### 4) Upwork Lead Workflow

- Dedicated page at `/upwork`
- Import selected Upwork projects into CRM
- Store Upwork metadata on lead records:
	- client/company
	- project title and URL
	- budget
	- proposal date
	- proposal status
- Auto-create follow-up task on import
- Track status progression:
	- Upwork Prospect
	- Proposal Sent
	- Interview
	- Opportunity
	- Won/Lost

### 5) Quotes and Tasks

- Quote create/edit/view flow with totals and statuses
- Task tracking and completion workflow
- Follow-up scheduling from lead and import actions

## Technical Stack

- Framework: Next.js 16 (App Router)
- Language: TypeScript
- UI: React 19 + Tailwind CSS 4
- Auth: next-auth
- Database: better-sqlite3 (SQLite)
- Drag and drop: dnd-kit
- Email transport: nodemailer
- SMS transport: Twilio
- PDF output: jsPDF + jspdf-autotable
- Linting: ESLint (Next config)

## Development Tools Used

- VS Code
- Git + GitHub
- npm scripts (`dev`, `build`, `start`, `lint`)
- PM2 for process management on Raspberry Pi
- OpenAI API for AI assistant and template regeneration
- Cloudflare tunnel for public routing to Raspberry Pi services

## Local Development

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install
```

### Run in development

```bash
npm run dev
```

Open `http://localhost:3000`.

### Production build test

```bash
npm run build
npm run start
```

## Environment Variables

Create `.env.local` for local runtime secrets and integration keys.

### AI

```bash
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
```

### Email (SMTP)

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@example.com
SMTP_PASS=app_or_provider_password
SMTP_FROM_NAME=Splendid Technology
SMTP_REPLY_TO=info@splendidtechnology.co.uk
```

### SMS (Twilio)

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+44xxxxxxxxxx
```

### LinkedIn Lead Gen

```bash
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
LINKEDIN_REDIRECT_URI=https://your-domain/api/linkedin/callback
```

### Demo mode (example)

```bash
DEMO_MODE=1
NEXT_PUBLIC_DEMO_MODE=1
CRM_DB_FILE=splendid-crm-demo.db
```

### Automation Scheduler

```bash
AUTOMATION_API_KEY=your_strong_random_secret
MORNING_BRIEF_TO=you@example.com,ops@example.com
```

## Data Model Notes

Main entities:

- `leads`
- `contacts`
- `notes`
- `tasks`
- `quotes` and `quote_items`
- `outreach_templates`

Schema migrations are applied in app startup through `src/lib/db.ts`.

## API Surface (high-level)

- Core CRM: `/api/leads`, `/api/tasks`, `/api/quotes`, `/api/stats`
- AI: `/api/ai`, `/api/ai/actions`
- Marketing Automation MVP:
	- `/api/automation/weekly-playbook` (secured scheduler endpoint for weekly playbook creation)
	- `/api/automation/morning-brief-email` (secured scheduler endpoint for daily email brief)
	- `/api/contacts` (contact records with campaign/status metadata)
	- `/api/companies` (company-level source and enrichment records)
	- `/api/campaigns` (campaign create/list + conversion counters)
	- `/api/activities` (LinkedIn and outreach activity timeline)
	- `/api/content-posts` (AI content draft/schedule queue)
	- `/api/analytics` (acceptance/reply/meeting conversion metrics)
	- `/api/morning-brief` (daily BD summary and priority follow-ups)
	- `/api/ai/bd-generate` (AI email sequence, LinkedIn posts, proposal draft)
	- `/api/campaigns/playbook` (FW24 daily/weekly campaign activities + one-click weekly task generation)
- Outreach templates: `/api/outreach/templates`
- Prospecting: `/api/ch/*`, `/api/prospect-finder/*`
- Outreach execution: `/api/prospects/send-email`, `/api/prospects/send-sms`, `/api/prospects/bulk-outreach`
- LinkedIn: `/api/linkedin/*`
- Upwork: `/api/upwork/import`, `/api/upwork/leads`

## Autonomous Scheduler (Cron or n8n)

The weekly campaign playbook can run independently of dashboard visits via a secured automation endpoint.

### Option A: Cron on Raspberry Pi

Use the helper script:

```bash
scripts/trigger-weekly-playbook.sh
```

Example cron (every Monday at 07:00):

```bash
0 7 * * 1 APP_URL=http://127.0.0.1:3002 AUTOMATION_API_KEY=your_strong_random_secret /home/sarapriyain/Projects/CRM/splendid_CRM_git/scripts/trigger-weekly-playbook.sh >> /home/sarapriyain/weekly-playbook.log 2>&1
```

Morning brief email (Mon-Fri at 07:15):

```bash
15 7 * * 1-5 APP_URL=http://127.0.0.1:3002 AUTOMATION_API_KEY=your_strong_random_secret /home/sarapriyain/Projects/CRM/splendid_CRM_git/scripts/trigger-morning-brief-email.sh >> /home/sarapriyain/morning-brief-email.log 2>&1
```

### Option B: n8n

1. Add a Cron node (weekly, Monday, 07:00).
2. Add HTTP Request node:
	- Method: POST
	- URL: `https://your-domain/api/automation/weekly-playbook`
	- Header: `x-automation-key: <AUTOMATION_API_KEY>`
	- Body JSON: `{ "force": false }`

The endpoint is idempotent per week, so repeated triggers will not duplicate weekly tasks.

## Deployment

Primary deployment target is Raspberry Pi 5 with PM2.

The full CRM software is implemented and running on Raspberry Pi 5 infrastructure, and Cloudflare is used to route public web traffic to the CRM services.

- Live CRM process: `splendid-crm`
- Demo CRM process: `splendid-crm-demo`

Current active runtime paths can differ between environments. Validate with:

```bash
pm2 describe splendid-crm
pm2 describe splendid-crm-demo
```

Typical operations:

```bash
git pull origin main
npm run build
pm2 restart splendid-crm
pm2 restart splendid-crm-demo
pm2 status
```

## Security and Compliance Notes

- Keep credentials only in environment files, never in source.
- Use selective import for external lead sources (LinkedIn/Upwork).
- Avoid scraping approaches that violate platform terms.

## Roadmap Candidates

- Upwork one-click proposal drafting from job URL context
- Communication timeline unification across channels
- Template version history and rollback
- Enhanced conversion analytics by source/vertical/stage
