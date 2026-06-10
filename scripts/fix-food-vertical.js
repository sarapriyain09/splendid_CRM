const db = require('better-sqlite3')('/home/sarapriyain/Projects/CRM/splendid_CRM/data/splendid-crm.db');

// Food company IDs identified from the engineering list
const foodKeywords = ['food', 'foods', 'chilled', 'sausage', 'fast food', 'egg', 'saladwork', 'packaging'];

// Get all engineering leads without sic_label
const rows = db.prepare("SELECT id, company_name FROM leads WHERE vertical = 'engineering'").all();

const toUpdate = rows.filter(r => {
  const name = (r.company_name || '').toLowerCase();
  return foodKeywords.some(kw => name.includes(kw));
});

console.log('Food leads to move to digital:', toUpdate.length);
toUpdate.forEach(r => console.log(' ', r.id, r.company_name));

if (toUpdate.length > 0) {
  const ids = toUpdate.map(r => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const result = db.prepare(`UPDATE leads SET vertical = 'digital' WHERE id IN (${placeholders})`).run(...ids);
  console.log('Updated rows:', result.changes);
}
