export interface Env {
  DB: D1Database;

  // Plain vars (wrangler.toml [vars])
  SUPABASE_URL: string;
  FRONTEND_URL: string;

  // Secrets Store bindings — accessed via .get() which returns Promise<string>
  SUPABASE_SERVICE_KEY: SecretsStoreSecret;
  SUPABASE_ANON_KEY:    SecretsStoreSecret;
  NEON_DATABASE_URL:    SecretsStoreSecret;
  TRACK_PIXEL_BASE_URL: SecretsStoreSecret;
}

// Cloudflare Secrets Store secret shape
export interface SecretsStoreSecret {
  get(): Promise<string>;
}

// ── Convenience helper ────────────────────────────────────────────────────────
// Call this at the top of any handler that needs multiple secrets at once.
// Returns a plain object so the rest of the codebase uses normal string access.
export interface ResolvedSecrets {
  supabaseServiceKey: string;
  supabaseAnonKey:    string;
  neonDatabaseUrl:    string;
  trackPixelBaseUrl:  string;
}

export async function resolveSecrets(env: Env): Promise<ResolvedSecrets> {
  const [supabaseServiceKey, supabaseAnonKey, neonDatabaseUrl, trackPixelBaseUrl] =
    await Promise.all([
      env.SUPABASE_SERVICE_KEY.get(),
      env.SUPABASE_ANON_KEY.get(),
      env.NEON_DATABASE_URL.get(),
      env.TRACK_PIXEL_BASE_URL.get(),
    ]);
  return { supabaseServiceKey, supabaseAnonKey, neonDatabaseUrl, trackPixelBaseUrl };
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  gmail_client_id?: string;
  gmail_client_secret?: string;
  gmail_refresh_token?: string;
  gmail_sender_email?: string;
  created_at: string;
}

export interface Template {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  html_content: string;
  preview_text?: string;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ContactList {
  id: string;
  user_id: string;
  name: string;
  neon_table_name: string;
  neon_email_column: string;
  neon_name_column: string;
  description?: string;
  subscriber_count: number;
  last_synced_at?: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  template_id?: string;
  contact_list_id: string;
  html_content: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  scheduled_at?: string;
  sent_at?: string;
  from_name?: string;
  from_email?: string;
  reply_to?: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignSend {
  id: string;
  campaign_id: string;
  recipient_email: string;
  recipient_name?: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  error_message?: string;
  sent_at?: string;
  message_id?: string;
}

export interface AnalyticsSummary {
  campaign_id: string;
  campaign_name: string;
  sent_at: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  open_count: number;
  click_count: number;
  unsubscribe_count: number;
  open_rate: number;
  click_rate: number;
}