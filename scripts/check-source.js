const Database = require('better-sqlite3');
const db = new Database('/home/sarapriyain/Projects/CRM/splendid_CRM/data/splendid-crm.db');
const rows = db.prepare("SELECT source, count(*) as c FROM leads WHERE stage='prospect' GROUP BY source").all();
console.log(JSON.stringify(rows));
