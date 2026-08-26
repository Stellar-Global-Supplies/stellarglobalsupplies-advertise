// Free, in-Worker email validation: format check + MX record lookup.
// No SMTP mailbox probing here — Cloudflare Workers cannot make outbound
// connections on port 25, so we can't verify a specific mailbox exists.
// This gives us a solid "is this a real, receivable domain" check for free.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export function isValidEmailFormat(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function extractDomain(email: string): string {
  return email.slice(email.lastIndexOf('@') + 1).toLowerCase();
}

interface DnsAnswer {
  name: string;
  type: number;
  data: string;
}
interface DnsResponse {
  Status: number;
  Answer?: DnsAnswer[];
}

// Cloudflare DNS-over-HTTPS — free, no API key, works from a Worker via fetch().
async function domainHasMx(domain: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
      { headers: { Accept: 'application/dns-json' } }
    );
    if (!res.ok) return false;
    const data = await res.json() as DnsResponse;
    if (data.Status !== 0) return false;
    if (data.Answer && data.Answer.some(a => a.type === 15)) return true;

    // Some domains (rare, but valid) accept mail directly on the A/AAAA record
    // with no MX record. Fall back to an A-record check before rejecting.
    const aRes = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`,
      { headers: { Accept: 'application/dns-json' } }
    );
    if (!aRes.ok) return false;
    const aData = await aRes.json() as DnsResponse;
    return aData.Status === 0 && !!aData.Answer && aData.Answer.length > 0;
  } catch {
    // DNS lookup failed/timed out — don't silently treat this as "invalid",
    // caller decides the fallback behavior.
    return false;
  }
}

export interface ValidationSummary {
  valid: string[];          // passed format + MX check, deduped, lowercased
  invalid_format: number;
  no_mail_server: number;
  duplicates_in_batch: number;
}

// Validates a raw list of candidate email strings (already split from
// pasted text or a CSV column). Runs MX checks with a small per-domain
// cache so a batch of 1000 emails across 50 domains only does 50 lookups.
export async function validateEmailBatch(rawEmails: string[]): Promise<ValidationSummary> {
  const summary: ValidationSummary = {
    valid: [], invalid_format: 0, no_mail_server: 0, duplicates_in_batch: 0,
  };

  const seen = new Set<string>();
  const mxCache = new Map<string, boolean>();

  // Dedupe + format check first, so we only do MX lookups for unique,
  // well-formed domains.
  const candidates: string[] = [];
  for (const raw of rawEmails) {
    const email = raw.trim().toLowerCase();
    if (!email) continue;
    if (!isValidEmailFormat(email)) { summary.invalid_format++; continue; }
    if (seen.has(email)) { summary.duplicates_in_batch++; continue; }
    seen.add(email);
    candidates.push(email);
  }

  for (const email of candidates) {
    const domain = extractDomain(email);
    let hasMx = mxCache.get(domain);
    if (hasMx === undefined) {
      hasMx = await domainHasMx(domain);
      mxCache.set(domain, hasMx);
    }
    if (hasMx) {
      summary.valid.push(email);
    } else {
      summary.no_mail_server++;
    }
  }

  return summary;
}

// Splits raw pasted text or CSV content into candidate email strings.
// Handles newline-separated, comma-separated, and a CSV with an "email" column.
export function extractEmailsFromText(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Looks like CSV with a header row — find the "email" column.
  const lines = trimmed.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length > 0 && /email/i.test(lines[0]) && lines[0].includes(',')) {
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const emailIdx = headers.indexOf('email');
    if (emailIdx !== -1) {
      return lines.slice(1).map(line => (line.split(',')[emailIdx] || '').trim());
    }
  }

  // Otherwise treat as free-form: split on newlines and commas.
  return trimmed.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
}