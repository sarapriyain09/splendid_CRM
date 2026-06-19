/* eslint-disable no-console */
const path = require('path');
const Database = require('better-sqlite3');
const { Pool } = require('pg');

function norm(v) {
  return String(v || '').trim();
}

async function ensureCompany(client, name) {
  const existing = await client
    .query('SELECT id FROM companies WHERE lower(name) = lower($1) LIMIT 1', [name])
    .then((r) => r.rows[0]);
  if (existing?.id) return existing.id;

  const created = await client
    .query("INSERT INTO companies (name, status) VALUES ($1, 'Prospect') RETURNING id", [name])
    .then((r) => r.rows[0]);
  return created?.id;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !/^postgres(ql)?:\/\//i.test(databaseUrl)) {
    throw new Error('Set DATABASE_URL to postgres:// or postgresql:// before running this script.');
  }

  const sqlitePath = path.join(process.cwd(), 'data', (process.env.CRM_DB_FILE || 'splendid-crm.db').trim());
  const sqlite = new Database(sqlitePath, { readonly: true });

  const sqliteRows = sqlite.prepare(`
    SELECT c.name, c.email, c.phone,
           COALESCE(NULLIF(TRIM(c.company), ''), NULLIF(TRIM(l.company_name), '')) AS company_name
    FROM contacts c
    LEFT JOIN leads l ON l.id = c.lead_id
    WHERE COALESCE(NULLIF(TRIM(c.company), ''), NULLIF(TRIM(l.company_name), '')) IS NOT NULL
  `).all();

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  let linked = 0;
  let createdCompanies = 0;
  let alreadyLinked = 0;
  let noMatch = 0;

  try {
    for (const row of sqliteRows) {
      const companyName = norm(row.company_name);
      if (!companyName) continue;

      const email = norm(row.email);
      const phone = norm(row.phone);
      const fullName = norm(row.name);

      let contact = null;
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
        noMatch += 1;
        continue;
      }

      const beforeId = await client
        .query('SELECT id FROM companies WHERE id = $1 LIMIT 1', [contact.company_id])
        .then((r) => r.rows[0]?.id);

      const companyId = await ensureCompany(client, companyName);
      const existedByName = await client
        .query('SELECT id FROM companies WHERE lower(name) = lower($1) LIMIT 1', [companyName])
        .then((r) => r.rows[0]?.id);
      if (!beforeId && existedByName === companyId) {
        // We cannot reliably know whether it was newly created from this run after ensureCompany call.
      }

      if (!contact.company_id) {
        await client.query('UPDATE contacts SET company_id = $1 WHERE id = $2', [companyId, contact.id]);
        linked += 1;
      } else {
        alreadyLinked += 1;
      }
    }

    const unlinked = await client
      .query('SELECT COUNT(*)::int AS c FROM contacts WHERE company_id IS NULL')
      .then((r) => r.rows[0]?.c ?? 0);

    const totalCompanies = await client
      .query('SELECT COUNT(*)::int AS c FROM companies')
      .then((r) => r.rows[0]?.c ?? 0);

    console.log(`Source contact rows with company candidate: ${sqliteRows.length}`);
    console.log(`Contacts linked this run: ${linked}`);
    console.log(`Contacts already linked: ${alreadyLinked}`);
    console.log(`Contacts with no match in postgres: ${noMatch}`);
    console.log(`Total companies now: ${totalCompanies}`);
    console.log(`Contacts still unlinked: ${unlinked}`);
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

main().catch((err) => {
  console.error('Sync failed:', err.message || err);
  process.exit(1);
});
