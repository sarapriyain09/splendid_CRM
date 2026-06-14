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
- Outreach templates: `/api/outreach/templates`
- Prospecting: `/api/ch/*`, `/api/prospect-finder/*`
- Outreach execution: `/api/prospects/send-email`, `/api/prospects/send-sms`, `/api/prospects/bulk-outreach`
- LinkedIn: `/api/linkedin/*`
- Upwork: `/api/upwork/import`, `/api/upwork/leads`

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
