const db = require('better-sqlite3')('/home/sarapriyain/Projects/CRM/splendid_CRM/data/splendid-crm.db');

const rows = db.prepare("SELECT id, company_name FROM leads WHERE vertical = 'engineering'").all();

// Move accountants/non-engineering to digital
const accountKeywords = ['account', 'acca', 'chartered', 'bookkeep', 'tax', 'payroll', 'financial service'];
const toUpdate = rows.filter(r => {
  const name = (r.company_name || '').toLowerCase();
  return accountKeywords.some(kw => name.includes(kw));
});

console.log('Accountant leads to move to digital:', toUpdate.length);
toUpdate.forEach(r => console.log(' ', r.id, r.company_name));

if (toUpdate.length > 0) {
  const ids = toUpdate.map(r => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const result = db.prepare(`UPDATE leads SET vertical = 'digital' WHERE id IN (${placeholders})`).run(...ids);
  console.log('Updated rows:', result.changes);
}
