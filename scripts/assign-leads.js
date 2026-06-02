const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const db = new Database('data/splendid-crm.db');

const arun  = db.prepare("SELECT id FROM users WHERE name = 'arun' OR name = 'Arun'").get();
const admin = db.prepare("SELECT id FROM users WHERE name = 'Admin'").get();
console.log('Admin id:', admin.id, '| Arun id:', arun.id);

// Leads starting with 'Account' -> Admin
const r1 = db.prepare("UPDATE leads SET assigned_to = ?, updated_at = datetime('now') WHERE company_name LIKE 'Account%'").run(admin.id);

// All remaining leads -> Arun
const r2 = db.prepare("UPDATE leads SET assigned_to = ?, updated_at = datetime('now') WHERE (assigned_to IS NULL OR assigned_to != ?)").run(arun.id, admin.id);

console.log('Assigned to Admin (Account*): ' + r1.changes);
console.log('Assigned to Arun (rest):      ' + r2.changes);
