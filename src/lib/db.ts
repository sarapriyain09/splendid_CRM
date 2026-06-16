import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = (process.env.CRM_DB_FILE || 'splendid-crm.db').trim();
const DB_PATH = path.join(DB_DIR, DB_FILE);

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      email       TEXT    NOT NULL UNIQUE,
      password    TEXT    NOT NULL,
      role        TEXT    NOT NULL DEFAULT 'user',
      demo_verified INTEGER NOT NULL DEFAULT 1,
      demo_verify_token TEXT,
      demo_verify_expires TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leads (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name    TEXT    NOT NULL,
      company_number  TEXT,
      sic_code        TEXT,
      sic_label       TEXT,
      website         TEXT,
      phone           TEXT,
      email           TEXT,
      source          TEXT    NOT NULL DEFAULT 'companies_house',
      lead_score      INTEGER NOT NULL DEFAULT 0,
      status          TEXT    NOT NULL DEFAULT 'new',
      stage           TEXT    NOT NULL DEFAULT 'lead',
      location        TEXT,
      postcode        TEXT,
      incorporated    TEXT,
      notes           TEXT,
      assigned_to     INTEGER REFERENCES users(id),
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      name       TEXT    NOT NULL,
      role       TEXT,
      email      TEXT,
      phone      TEXT,
      linkedin   TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      user_id    INTEGER REFERENCES users(id),
      content    TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id    INTEGER REFERENCES leads(id) ON DELETE CASCADE,
      user_id    INTEGER REFERENCES users(id),
      title      TEXT    NOT NULL,
      due_date   TEXT,
      done       INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id      INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      quote_number TEXT    NOT NULL UNIQUE,
      status       TEXT    NOT NULL DEFAULT 'draft',
      customer     TEXT    NOT NULL,
      address      TEXT,
      email        TEXT,
      subtotal     REAL    NOT NULL DEFAULT 0,
      vat_rate     REAL    NOT NULL DEFAULT 20,
      vat_amount   REAL    NOT NULL DEFAULT 0,
      total        REAL    NOT NULL DEFAULT 0,
      terms        TEXT    DEFAULT '30 days',
      notes        TEXT,
      expiry_date  TEXT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quote_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id    INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      description TEXT    NOT NULL,
      quantity    REAL    NOT NULL DEFAULT 1,
      unit_price  REAL    NOT NULL DEFAULT 0,
      amount      REAL    NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS linkedin_tokens (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      access_token  TEXT    NOT NULL,
      expires_at    TEXT    NOT NULL,
      scope         TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS linkedin_imported (
      form_response_id TEXT PRIMARY KEY,
      lead_id          INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      imported_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_actions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id      TEXT,
      lead_id       INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      call_id       TEXT,
      summary       TEXT,
      action_type   TEXT    NOT NULL,
      action_title  TEXT    NOT NULL,
      payload_json  TEXT,
      status        TEXT    NOT NULL DEFAULT 'pending_review',
      source        TEXT    NOT NULL DEFAULT 'callcrm',
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      reviewed_at   TEXT,
      executed_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS demo_registrations (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT    NOT NULL,
      email          TEXT    NOT NULL,
      company        TEXT,
      phone          TEXT,
      verification_sent INTEGER NOT NULL DEFAULT 0,
      source_host    TEXT,
      ip_address     TEXT,
      user_agent     TEXT,
      created_user   INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS outreach_templates (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      channel     TEXT    NOT NULL,
      vertical    TEXT    NOT NULL,
      subject     TEXT,
      message     TEXT    NOT NULL,
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(channel, vertical)
    );
  `);

  // Migrations — safe to run on existing DBs
  const cols = db.prepare(`PRAGMA table_info(leads)`).all() as { name: string }[];
  const colNames = cols.map(c => c.name);
  if (!colNames.includes('contacted_at')) {
    db.exec(`ALTER TABLE leads ADD COLUMN contacted_at TEXT`);
  }
  if (!colNames.includes('outreach_email')) {
    db.exec(`ALTER TABLE leads ADD COLUMN outreach_email TEXT`);
  }
  if (!colNames.includes('sms_sent_at')) {
    db.exec(`ALTER TABLE leads ADD COLUMN sms_sent_at TEXT`);
  }
  if (!colNames.includes('sms_message')) {
    db.exec(`ALTER TABLE leads ADD COLUMN sms_message TEXT`);
  }
  if (!colNames.includes('created_by')) {
    db.exec(`ALTER TABLE leads ADD COLUMN created_by INTEGER REFERENCES users(id)`);
  }
  if (!colNames.includes('tps_status')) {
    db.exec(`ALTER TABLE leads ADD COLUMN tps_status TEXT`);
  }
  if (!colNames.includes('tps_checked_at')) {
    db.exec(`ALTER TABLE leads ADD COLUMN tps_checked_at TEXT`);
  }
  if (!colNames.includes('vertical')) {
    db.exec(`ALTER TABLE leads ADD COLUMN vertical TEXT NOT NULL DEFAULT 'software'`);
  }
  // Engineering scoring columns
  if (!colNames.includes('contact_name')) {
    db.exec(`ALTER TABLE leads ADD COLUMN contact_name TEXT`);
  }
  if (!colNames.includes('employee_count')) {
    db.exec(`ALTER TABLE leads ADD COLUMN employee_count INTEGER`);
  }
  if (!colNames.includes('linkedin_url')) {
    db.exec(`ALTER TABLE leads ADD COLUMN linkedin_url TEXT`);
  }
  if (!colNames.includes('eng_sector')) {
    db.exec(`ALTER TABLE leads ADD COLUMN eng_sector TEXT`);
  }
  if (!colNames.includes('linkedin_hiring')) {
    db.exec(`ALTER TABLE leads ADD COLUMN linkedin_hiring TEXT`);
  }
  if (!colNames.includes('decision_maker_role')) {
    db.exec(`ALTER TABLE leads ADD COLUMN decision_maker_role TEXT`);
  }
  if (!colNames.includes('growth_signal')) {
    db.exec(`ALTER TABLE leads ADD COLUMN growth_signal TEXT`);
  }
  if (!colNames.includes('linkedin_engagement')) {
    db.exec(`ALTER TABLE leads ADD COLUMN linkedin_engagement TEXT`);
  }
  if (!colNames.includes('eng_score')) {
    db.exec(`ALTER TABLE leads ADD COLUMN eng_score INTEGER DEFAULT 0`);
  }
  if (!colNames.includes('eng_grade')) {
    db.exec(`ALTER TABLE leads ADD COLUMN eng_grade TEXT DEFAULT 'D'`);
  }
  if (!colNames.includes('next_followup_date')) {
    db.exec(`ALTER TABLE leads ADD COLUMN next_followup_date TEXT`);
  }
  if (!colNames.includes('opportunity_value')) {
    db.exec(`ALTER TABLE leads ADD COLUMN opportunity_value REAL`);
  }
  if (!colNames.includes('interest_level')) {
    db.exec(`ALTER TABLE leads ADD COLUMN interest_level TEXT`);
  }
  if (!colNames.includes('upwork_client_name')) {
    db.exec(`ALTER TABLE leads ADD COLUMN upwork_client_name TEXT`);
  }
  if (!colNames.includes('upwork_company')) {
    db.exec(`ALTER TABLE leads ADD COLUMN upwork_company TEXT`);
  }
  if (!colNames.includes('upwork_project_title')) {
    db.exec(`ALTER TABLE leads ADD COLUMN upwork_project_title TEXT`);
  }
  if (!colNames.includes('upwork_project_url')) {
    db.exec(`ALTER TABLE leads ADD COLUMN upwork_project_url TEXT`);
  }
  if (!colNames.includes('upwork_budget')) {
    db.exec(`ALTER TABLE leads ADD COLUMN upwork_budget TEXT`);
  }
  if (!colNames.includes('upwork_proposal_date')) {
    db.exec(`ALTER TABLE leads ADD COLUMN upwork_proposal_date TEXT`);
  }
  if (!colNames.includes('upwork_proposal_status')) {
    db.exec(`ALTER TABLE leads ADD COLUMN upwork_proposal_status TEXT`);
  }

  // ── Vertical normalisation migration ─────────────────────────────────────
  // legacy values → current 4-vertical taxonomy
  db.exec(`UPDATE leads SET vertical = 'iot' WHERE vertical = 'industry_4_0'`);
  db.exec(`UPDATE leads SET vertical = 'ai_automation' WHERE vertical = 'automation'`);
  db.exec(`UPDATE leads SET vertical = 'software' WHERE vertical IN ('crm','digital','general') OR vertical IS NULL`);
  db.exec(`UPDATE leads SET vertical = 'software' WHERE vertical NOT IN ('engineering','iot','ai_automation','software')`);
  // Finder V1 backfill: older V1 prospects were saved as engineering by default.
  // Keep V2/V3 engineering records intact by excluding V2's sector marker.
  db.exec(`UPDATE leads
    SET vertical = 'software'
    WHERE source = 'other'
      AND vertical = 'engineering'
      AND (notes IS NULL OR notes NOT LIKE '%sector (+20)%')`);
  // ─────────────────────────────────────────────────────────────────────────
  const userCols = db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[];
  const userColNames = userCols.map(c => c.name);
  if (!userColNames.includes('phone')) {
    db.exec(`ALTER TABLE users ADD COLUMN phone TEXT`);
  }
  if (!userColNames.includes('demo_verified')) {
    db.exec(`ALTER TABLE users ADD COLUMN demo_verified INTEGER NOT NULL DEFAULT 1`);
  }
  if (!userColNames.includes('demo_verify_token')) {
    db.exec(`ALTER TABLE users ADD COLUMN demo_verify_token TEXT`);
  }
  if (!userColNames.includes('demo_verify_expires')) {
    db.exec(`ALTER TABLE users ADD COLUMN demo_verify_expires TEXT`);
  }

  const demoRegCols = db.prepare(`PRAGMA table_info(demo_registrations)`).all() as { name: string }[];
  const demoRegColNames = demoRegCols.map(c => c.name);
  if (demoRegCols.length > 0 && !demoRegColNames.includes('verification_sent')) {
    db.exec(`ALTER TABLE demo_registrations ADD COLUMN verification_sent INTEGER NOT NULL DEFAULT 0`);
  }

  // Seed default outreach templates per vertical/channel
  const DEFAULT_VERTICALS = ['engineering', 'iot', 'ai_automation', 'software'] as const;
  const DEFAULT_EMAIL_BY_VERTICAL: Record<(typeof DEFAULT_VERTICALS)[number], { subject: string; message: string }> = {
    engineering: {
      subject: 'Engineering Services Support for {{company_name}}',
      message: 'Hi {{company_name}},\n\nI am reaching out from Splendid Technology. We help UK businesses in four pillars:\n1) Engineering Services\n2) Industry 4.0\n3) Digital Twin AI\n4) Software Platforms\n\nFor your team, the most relevant area is Engineering Services, where we provide flexible CAD/CAE support and extra delivery capacity when needed.\n\nWould you be available for a 15-minute call this week to explore fit?\n\nKind regards,\nRaja\nSplendid Technology',
    },
    iot: {
      subject: 'Industry 4.0 Support for {{company_name}}',
      message: 'Hi {{company_name}},\n\nI am reaching out from Splendid Technology. We help UK businesses in four pillars:\n1) Engineering Services\n2) Industry 4.0\n3) Digital Twin AI\n4) Software Platforms\n\nFor your team, the most relevant area is Industry 4.0, including connected monitoring, systems integration, and operational visibility.\n\nWould you be available for a 15-minute call this week to explore fit?\n\nKind regards,\nRaja\nSplendid Technology',
    },
    ai_automation: {
      subject: 'Digital Twin AI Support for {{company_name}}',
      message: 'Hi {{company_name}},\n\nI am reaching out from Splendid Technology. We help UK businesses in four pillars:\n1) Engineering Services\n2) Industry 4.0\n3) Digital Twin AI\n4) Software Platforms\n\nFor your team, the most relevant area is Digital Twin AI, helping reduce manual work, improve forecasting, and speed decision-making.\n\nWould you be available for a 15-minute call this week to explore fit?\n\nKind regards,\nRaja\nSplendid Technology',
    },
    software: {
      subject: 'Software Platforms Support for {{company_name}}',
      message: 'Hi {{company_name}},\n\nI am reaching out from Splendid Technology. We help UK businesses in four pillars:\n1) Engineering Services\n2) Industry 4.0\n3) Digital Twin AI\n4) Software Platforms\n\nFor your team, the most relevant area is Software Platforms, including integrations, faster delivery, and quality improvements.\n\nWould you be available for a 15-minute call this week to explore fit?\n\nKind regards,\nRaja\nSplendid Technology',
    },
  };
  const DEFAULT_SMS_BY_VERTICAL: Record<(typeof DEFAULT_VERTICALS)[number], string> = {
    engineering: 'Hi {{company_name}}, we support Engineering Services, Industry 4.0, Digital Twin AI, and Software Platforms. Open to a quick 15-min call this week? - Splendid Technology',
    iot: 'Hi {{company_name}}, we support Engineering Services, Industry 4.0, Digital Twin AI, and Software Platforms. Open to a quick 15-min call this week? - Splendid Technology',
    ai_automation: 'Hi {{company_name}}, we support Engineering Services, Industry 4.0, Digital Twin AI, and Software Platforms. Open to a quick 15-min call this week? - Splendid Technology',
    software: 'Hi {{company_name}}, we support Engineering Services, Industry 4.0, Digital Twin AI, and Software Platforms. Open to a quick 15-min call this week? - Splendid Technology',
  };
  const hasTemplate = db.prepare(`SELECT 1 FROM outreach_templates WHERE channel = ? AND vertical = ?`);
  const upsertTemplate = db.prepare(`
    INSERT INTO outreach_templates (channel, vertical, subject, message, updated_at)
    VALUES (@channel, @vertical, @subject, @message, datetime('now'))
    ON CONFLICT(channel, vertical)
    DO UPDATE SET subject = excluded.subject, message = excluded.message, updated_at = datetime('now')
  `);

  // Keep existing DB templates aligned with the four-pillar AI assistant email copy.
  const alignEmailTemplatesTx = db.transaction(() => {
    for (const vertical of DEFAULT_VERTICALS) {
      const email = DEFAULT_EMAIL_BY_VERTICAL[vertical];
      upsertTemplate.run({ channel: 'email', vertical, subject: email.subject, message: email.message });
    }
  });
  alignEmailTemplatesTx();

  for (const vertical of DEFAULT_VERTICALS) {
    const existsEmail = hasTemplate.get('email', vertical);
    if (!existsEmail) {
      const subject = DEFAULT_EMAIL_BY_VERTICAL[vertical].subject;
      const message = DEFAULT_EMAIL_BY_VERTICAL[vertical].message;
      upsertTemplate.run({ channel: 'email', vertical, subject, message });
    }

    const existsSms = hasTemplate.get('sms', vertical);
    if (!existsSms) {
      const message = DEFAULT_SMS_BY_VERTICAL[vertical];
      upsertTemplate.run({ channel: 'sms', vertical, subject: null, message });
    }
  }
}
