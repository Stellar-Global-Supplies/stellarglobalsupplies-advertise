import { neon } from '@neondatabase/serverless';

export interface Contact {
  email: string;
  name?: string;
}

export async function getContactsFromNeon(
  neonUrl: string,
  tableName: string,
  emailColumn: string,
  nameColumn: string,
  excludeEmails: string[] = []
): Promise<Contact[]> {
  const sql = neon(neonUrl);

  // Safe identifier quoting (double-quote for PG)
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;

  let query = `SELECT ${q(emailColumn)} as email, ${q(nameColumn)} as name FROM ${q(tableName)} WHERE ${q(emailColumn)} IS NOT NULL AND ${q(emailColumn)} != ''`;

  const rows = await sql(query) as { email: string; name: string }[];

  const excludeSet = new Set(excludeEmails.map(e => e.toLowerCase()));
  return rows
    .filter(r => r.email && !excludeSet.has(r.email.toLowerCase()))
    .map(r => ({ email: r.email, name: r.name || undefined }));
}

export async function countContacts(
  neonUrl: string,
  tableName: string,
  emailColumn: string
): Promise<number> {
  const sql = neon(neonUrl);
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = await sql(`SELECT COUNT(*) as cnt FROM ${q(tableName)} WHERE ${q(emailColumn)} IS NOT NULL AND ${q(emailColumn)} != ''`) as { cnt: string }[];
  return parseInt(rows[0]?.cnt ?? '0');
}
