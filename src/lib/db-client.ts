import { Pool } from 'pg';
import { getDb } from '@/lib/db';

type DbFlavor = 'sqlite' | 'postgres';

type SqlParam = string | number | boolean | null;

type RunResult = {
  rowCount: number;
  lastInsertId?: number | string;
  rows?: Array<Record<string, unknown>>;
};

let _pool: Pool | null = null;

function getDbFlavor(): DbFlavor {
  const url = (process.env.DATABASE_URL ?? '').trim().toLowerCase();
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return 'postgres';
  }
  return 'sqlite';
}

function getPool(): Pool {
  if (_pool) return _pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for PostgreSQL mode');
  }

  _pool = new Pool({ connectionString });
  return _pool;
}

function convertSqlitePlaceholdersToPg(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

function normalizeSqlForPostgres(sql: string): string {
  return sql
    .replace(/datetime\('now'\)/g, 'CURRENT_TIMESTAMP')
    .replace(/\bAUTOINCREMENT\b/g, '');
}

function toPgSql(sql: string): string {
  return convertSqlitePlaceholdersToPg(normalizeSqlForPostgres(sql));
}

export function isPostgresDb(): boolean {
  return getDbFlavor() === 'postgres';
}

export async function queryAll<T = Record<string, unknown>>(sql: string, params: SqlParam[] = []): Promise<T[]> {
  if (getDbFlavor() === 'sqlite') {
    return getDb().prepare(sql).all(...params) as T[];
  }

  const res = await getPool().query(toPgSql(sql), params);
  return res.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(sql: string, params: SqlParam[] = []): Promise<T | undefined> {
  const rows = await queryAll<T>(sql, params);
  return rows[0];
}

export async function runStatement(sql: string, params: SqlParam[] = []): Promise<RunResult> {
  if (getDbFlavor() === 'sqlite') {
    const result = getDb().prepare(sql).run(...params);
    return {
      rowCount: result.changes,
      lastInsertId: typeof result.lastInsertRowid === 'bigint' ? Number(result.lastInsertRowid) : result.lastInsertRowid,
    };
  }

  const res = await getPool().query(toPgSql(sql), params);
  const firstRow = res.rows[0] as { id?: number | string } | undefined;
  return {
    rowCount: res.rowCount ?? 0,
    rows: res.rows as Array<Record<string, unknown>>,
    lastInsertId: firstRow?.id,
  };
}

export async function hasTable(tableName: string): Promise<boolean> {
  if (getDbFlavor() === 'sqlite') {
    const row = await queryOne<{ name?: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      [tableName]
    );
    return !!row?.name;
  }

  const row = await queryOne<{ table_name?: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?`,
    [tableName]
  );

  return !!row?.table_name;
}
