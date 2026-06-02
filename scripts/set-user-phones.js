const Database = require('better-sqlite3');
const db = new Database('/home/sarapriyain/Projects/CRM/splendid_CRM/data/splendid-crm.db');

// Add phone column if missing
const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
if (!cols.includes('phone')) {
  db.prepare('ALTER TABLE users ADD COLUMN phone TEXT').run();
  console.log('Added phone column');
} else {
  console.log('Phone column already exists');
}

// Set phones
db.prepare("UPDATE users SET phone = ? WHERE id = ?").run('+447721952967', 1);
db.prepare("UPDATE users SET phone = ? WHERE id = ?").run('+447810823317', 2);

const users = db.prepare('SELECT id, name, email, phone FROM users').all();
console.log('Users:', JSON.stringify(users, null, 2));
db.close();
