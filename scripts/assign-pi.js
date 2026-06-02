const Database = require('better-sqlite3');
const db = new Database('/home/sarapriyain/Projects/CRM/splendid_CRM/data/splendid-crm.db');

const users = db.prepare('SELECT id, name FROM users').all();
console.log('Users:', JSON.stringify(users));

const admin = users.find(u => u.name.toLowerCase() === 'admin');
const arun  = users.find(u => u.name.toLowerCase() === 'arun');
console.log('Admin id:', admin.id, '| Arun id:', arun.id);

// Leads with 'account' anywhere in company name -> Admin
const r1 = db.prepare("UPDATE leads SET assigned_to = ?, updated_at = datetime('now') WHERE LOWER(company_name) LIKE '%account%'").run(admin.id);
// All remaining -> Arun
const r2 = db.prepare("UPDATE leads SET assigned_to = ?, updated_at = datetime('now') WHERE assigned_to != ? OR assigned_to IS NULL").run(arun.id, admin.id);

console.log('Assigned to Admin (contains account):', r1.changes);
console.log('Assigned to Arun (rest):', r2.changes);

// Show sample
const sample = db.prepare("SELECT company_name, assigned_to FROM leads ORDER BY assigned_to").all();
sample.forEach(l => console.log(l.assigned_to === admin.id ? '[Admin]' : '[Arun] ', l.company_name));
