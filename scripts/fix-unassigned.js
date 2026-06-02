const Database = require('better-sqlite3');
const db = new Database('/home/sarapriyain/Projects/CRM/splendid_CRM/data/splendid-crm.db');
const r = db.prepare("UPDATE leads SET assigned_to=1, created_by=1 WHERE assigned_to IS NULL AND stage='prospect'").run();
console.log('Updated:', r.changes, 'prospects → Admin');
