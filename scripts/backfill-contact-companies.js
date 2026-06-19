/* eslint-disable no-console */
const path = require('path');
const Database = require('better-sqlite3');
const { Pool } = require('pg');

function normalize(value) {
  return String(value || '').trim();
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !/^postgres(ql)?:\/\//i.test(databaseUrl)) {
    throw new Error('Set DATABASE_URL to postgres:// or postgresql:// before running this script.');
  }

  const sqlitePath = path.join(process.cwd(), 'data', (process.env.CRM_DB_FILE || 'splendid-crm.db').trim());
  const sqlite = new Database(sqlitePath, { readonly: true });
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    const rows = sqlite
      .prepare(`
        SELECT c.name, c.email, c.phone,
               COALESCE(NULLIF(TRIM(c.company), ''), NULLIF(TRIM(l.company_name), '')) AS company_name
        FROM contacts c
        LEFT JOIN leads l ON l.id = c.lead_id
        WHERE COALESCE(NULLIF(TRIM(c.company), ''), NULLIF(TRIM(l.company_name), '')) IS NOT NULL
      `)
      .all();

    let matchedContact = 0;
    let companyCreated = 0;
    let companyLinked = 0;
    let skipped = 0;

    for (const row of rows) {
      const companyName = normalize(row.company_name);
      if (!companyName) continue;

      let contact = null;
      const email = normalize(row.email);
      const fullName = normalize(row.name);
      const phone = normalize(row.phone);

      if (email) {
        contact = await client
          .query('SELECT id, company_id FROM contacts WHERE lower(email) = lower($1) LIMIT 1', [email])
          .then((r) => r.rows[0]);
      }

      if (!contact && fullName) {
        contact = await client
          .query(
            `SELECT id, company_id
             FROM contacts
             WHERE lower(COALESCE(NULLIF(display_name, ''), TRIM(first_name || ' ' || COALESCE(last_name, '')))) = lower($1)
             LIMIT 1`,
            [fullName]
          )
          .then((r) => r.rows[0]);
      }

      if (!contact && phone) {
        contact = await client
          .query('SELECT id, company_id FROM contacts WHERE mobile = $1 OR phone = $1 LIMIT 1', [phone])
          .then((r) => r.rows[0]);
      }

      if (!contact) {
        skipped += 1;
        continue;
      }
      matchedContact += 1;

      let company = await client
        .query('SELECT id FROM companies WHERE lower(name) = lower($1) LIMIT 1', [companyName])
        .then((r) => r.rows[0]);

      if (!company) {
        company = await client
          .query("INSERT INTO companies (name, status) VALUES ($1, 'Prospect') RETURNING id", [companyName])
          .then((r) => r.rows[0]);
        companyCreated += 1;
      }

      if (!contact.company_id && company?.id) {
        await client.query('UPDATE contacts SET company_id = $1 WHERE id = $2', [company.id, contact.id]);
        companyLinked += 1;
      }
    }

    console.log(`Rows with company in sqlite: ${rows.length}`);
    console.log(`Matched contacts in postgres: ${matchedContact}`);
    console.log(`New companies created: ${companyCreated}`);
    console.log(`Contacts linked to company: ${companyLinked}`);
    console.log(`Skipped (no contact match): ${skipped}`);
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err.message || err);
  process.exit(1);
});
