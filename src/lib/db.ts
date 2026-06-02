import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'splendid-crm.db');

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
}
