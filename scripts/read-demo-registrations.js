const Database = require('/home/sarapriyain/Projects/CRM/splendid_CRM/node_modules/better-sqlite3');

const dbPath = '/home/sarapriyain/Projects/CRM/splendid_CRM/data/splendid-crm-demo.db';
const db = new Database(dbPath);

const rows = db
  .prepare('SELECT id, name, email, company, created_user, created_at FROM demo_registrations ORDER BY id DESC LIMIT 5')
  .all();

console.log(JSON.stringify(rows, null, 2));
