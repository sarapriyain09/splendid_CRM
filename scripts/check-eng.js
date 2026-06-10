const db = require('better-sqlite3')('/home/sarapriyain/Projects/CRM/splendid_CRM/data/splendid-crm.db');
const rows = db.prepare("SELECT id, company_name, sic_label, sic_code FROM leads WHERE vertical = 'engineering' ORDER BY sic_label, company_name LIMIT 60").all();
console.log('Total engineering leads:', rows.length);
rows.forEach(r => console.log([r.id, r.sic_code || '', r.sic_label || '(none)', r.company_name].join(' | ')));
