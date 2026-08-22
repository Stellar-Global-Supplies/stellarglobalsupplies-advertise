import { Env } from './types';
import { requireAuth } from './auth';
import { countContacts } from './neon';

const ORG_ID = 'default';

type Handler = (request: Request, env: Env, params?: Record<string, string>, ctx?: ExecutionContext) => Promise<Response>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function err(msg: string, status = 400) {
  return json({ error: msg }, status);
}

// ──────────────────────────────────────────────
// TEMPLATES  (shared across all users)
// ──────────────────────────────────────────────

export const listTemplates: Handler = async (req, env) => {
  await requireAuth(req, env).catch(r => { throw r; });
  const rows = await env.DB.prepare(
    'SELECT * FROM templates WHERE org_id = ? ORDER BY updated_at DESC'
  ).bind(ORG_ID).all();
  return json(rows.results);
};

export const createTemplate: Handler = async (req, env) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  const body = await req.json() as { name: string; subject: string; html_content: string; preview_text?: string; product_name?: string; product_image_url?: string };
  if (!body.name || !body.html_content) return err('name and html_content required');

  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO templates (id, user_id, org_id, name, subject, html_content, preview_text, product_name, product_image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, user.id, ORG_ID, body.name, body.subject || '', body.html_content, body.preview_text || null, body.product_name || null, body.product_image_url || null).run();

  return json(await env.DB.prepare('SELECT * FROM templates WHERE id = ?').bind(id).first(), 201);
};

export const updateTemplate: Handler = async (req, env, params) => {
  await requireAuth(req, env).catch(r => { throw r; });
  const body = await req.json() as Record<string, string>;
  const id = params?.id;

  const existing = await env.DB.prepare('SELECT id FROM templates WHERE id = ? AND org_id = ?')
    .bind(id, ORG_ID).first();
  if (!existing) return err('Template not found', 404);

  await env.DB.prepare(`
    UPDATE templates SET name=?, subject=?, html_content=?, preview_text=?, product_name=?, product_image_url=?, updated_at=datetime('now')
    WHERE id = ? AND org_id = ?
  `).bind(body.name, body.subject, body.html_content, body.preview_text || null, body.product_name || null, body.product_image_url || null, id, ORG_ID).run();

  return json(await env.DB.prepare('SELECT * FROM templates WHERE id = ?').bind(id).first());
};

export const deleteTemplate: Handler = async (req, env, params) => {
  await requireAuth(req, env).catch(r => { throw r; });
  await env.DB.prepare('DELETE FROM templates WHERE id = ? AND org_id = ?')
    .bind(params?.id, ORG_ID).run();
  return json({ success: true });
};

// ──────────────────────────────────────────────
// IMAGES  (shared across all users)
// ──────────────────────────────────────────────

export const listImages: Handler = async (req, env) => {
  await requireAuth(req, env).catch(r => { throw r; });
  const rows = await env.DB.prepare(
    'SELECT * FROM images WHERE org_id = ? ORDER BY created_at DESC'
  ).bind(ORG_ID).all();
  return json(rows.results);
};

export const saveImage: Handler = async (req, env) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  const body = await req.json() as { name: string; url: string; size_bytes?: number; mime_type?: string };
  if (!body.url) return err('url required');

  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO images (id, user_id, org_id, name, url, size_bytes, mime_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, user.id, ORG_ID, body.name || 'image', body.url, body.size_bytes || null, body.mime_type || null).run();

  return json(await env.DB.prepare('SELECT * FROM images WHERE id = ?').bind(id).first(), 201);
};

export const deleteImage: Handler = async (req, env, params) => {
  await requireAuth(req, env).catch(r => { throw r; });
  const img = await env.DB.prepare('SELECT * FROM images WHERE id = ? AND org_id = ?')
    .bind(params?.id, ORG_ID).first() as { url: string } | null;
  if (!img) return err('Image not found', 404);

  const supabaseServiceKey = await env.SUPABASE_SERVICE_KEY.get();
  const path = img.url.split('/storage/v1/object/public/')[1];
  if (path) {
    const bucket = path.split('/')[0];
    const filePath = path.slice(bucket.length + 1);
    await fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
      },
    });
  }

  await env.DB.prepare('DELETE FROM images WHERE id = ? AND org_id = ?').bind(params?.id, ORG_ID).run();
  return json({ success: true });
};

// ──────────────────────────────────────────────
// CONTACT LISTS  (shared across all users)
// ──────────────────────────────────────────────

export const listContactLists: Handler = async (req, env) => {
  await requireAuth(req, env).catch(r => { throw r; });
  const rows = await env.DB.prepare(
    'SELECT * FROM contact_lists WHERE org_id = ? ORDER BY name'
  ).bind(ORG_ID).all();
  return json(rows.results);
};

export const createContactList: Handler = async (req, env) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  const body = await req.json() as {
    name: string; neon_table_name: string;
    neon_email_column?: string; neon_name_column?: string; description?: string;
  };
  if (!body.name || !body.neon_table_name) return err('name and neon_table_name required');

  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO contact_lists (id, user_id, org_id, name, neon_table_name, neon_email_column, neon_name_column, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, user.id, ORG_ID, body.name, body.neon_table_name,
    body.neon_email_column || 'email', body.neon_name_column || 'name',
    body.description || null).run();

  return json(await env.DB.prepare('SELECT * FROM contact_lists WHERE id = ?').bind(id).first(), 201);
};

export const syncContactList: Handler = async (req, env, params) => {
  await requireAuth(req, env).catch(r => { throw r; });
  const list = await env.DB.prepare('SELECT * FROM contact_lists WHERE id = ? AND org_id = ?')
    .bind(params?.id, ORG_ID).first() as { neon_table_name: string; neon_email_column: string } | null;
  if (!list) return err('List not found', 404);

  const neonDatabaseUrl = await env.NEON_DATABASE_URL.get();
  const count = await countContacts(neonDatabaseUrl, list.neon_table_name, list.neon_email_column);
  await env.DB.prepare(`
    UPDATE contact_lists SET subscriber_count = ?, last_synced_at = datetime('now') WHERE id = ?
  `).bind(count, params?.id).run();

  return json({ subscriber_count: count });
};

export const deleteContactList: Handler = async (req, env, params) => {
  await requireAuth(req, env).catch(r => { throw r; });
  await env.DB.prepare('DELETE FROM contact_lists WHERE id = ? AND org_id = ?')
    .bind(params?.id, ORG_ID).run();
  return json({ success: true });
};

// ──────────────────────────────────────────────
// CAMPAIGNS  (shared across all users)
// ──────────────────────────────────────────────

export const listCampaigns: Handler = async (req, env) => {
  await requireAuth(req, env).catch(r => { throw r; });
  const rows = await env.DB.prepare(`
    SELECT c.*, cl.name as list_name
    FROM campaigns c
    LEFT JOIN contact_lists cl ON cl.id = c.contact_list_id
    WHERE c.org_id = ? ORDER BY c.created_at DESC
  `).bind(ORG_ID).all();
  return json(rows.results);
};

export const createCampaign: Handler = async (req, env) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  const body = await req.json() as {
    name: string; subject: string; html_content: string;
    contact_list_id: string; template_id?: string;
    from_name?: string; from_email?: string; reply_to?: string;
    scheduled_at?: string;
  };
  if (!body.name || !body.html_content || !body.contact_list_id) {
    return err('name, html_content, contact_list_id required');
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO campaigns (id, user_id, org_id, name, subject, html_content, contact_list_id, template_id,
      from_name, from_email, reply_to, scheduled_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, user.id, ORG_ID, body.name, body.subject || '', body.html_content,
    body.contact_list_id, body.template_id || null,
    body.from_name || null, body.from_email || null, body.reply_to || null,
    body.scheduled_at || null,
    body.scheduled_at ? 'scheduled' : 'draft').run();

  return json(await env.DB.prepare('SELECT * FROM campaigns WHERE id = ?').bind(id).first(), 201);
};

export const getCampaign: Handler = async (req, env, params) => {
  await requireAuth(req, env).catch(r => { throw r; });
  const row = await env.DB.prepare('SELECT * FROM campaigns WHERE id = ? AND org_id = ?')
    .bind(params?.id, ORG_ID).first();
  if (!row) return err('Campaign not found', 404);
  return json(row);
};

export const updateCampaign: Handler = async (req, env, params) => {
  await requireAuth(req, env).catch(r => { throw r; });
  const body = await req.json() as Record<string, string>;
  const c = await env.DB.prepare('SELECT * FROM campaigns WHERE id = ? AND org_id = ?')
    .bind(params?.id, ORG_ID).first() as { status: string } | null;
  if (!c) return err('Campaign not found', 404);
  if (c.status === 'sending' || c.status === 'sent') return err('Cannot edit a sent campaign');

  await env.DB.prepare(`
    UPDATE campaigns SET name=?, subject=?, html_content=?, from_name=?, from_email=?,
    reply_to=?, scheduled_at=?, updated_at=datetime('now')
    WHERE id = ? AND org_id = ?
  `).bind(body.name, body.subject, body.html_content, body.from_name || null,
    body.from_email || null, body.reply_to || null, body.scheduled_at || null,
    params?.id, ORG_ID).run();

  return json(await env.DB.prepare('SELECT * FROM campaigns WHERE id = ?').bind(params?.id).first());
};

export const deleteCampaign: Handler = async (req, env, params) => {
  await requireAuth(req, env).catch(r => { throw r; });
  await env.DB.prepare('DELETE FROM campaigns WHERE id = ? AND org_id = ?')
    .bind(params?.id, ORG_ID).run();
  return json({ success: true });
};

// ──────────────────────────────────────────────
// ANALYTICS  (org-wide)
// ──────────────────────────────────────────────

export const getAnalyticsSummary: Handler = async (req, env) => {
  await requireAuth(req, env).catch(r => { throw r; });

  const campaigns = await env.DB.prepare(`
    SELECT c.id, c.name, c.sent_at, c.total_recipients, c.sent_count, c.failed_count,
      COUNT(DISTINCT CASE WHEN e.event_type='open' THEN e.recipient_email END) as open_count,
      COUNT(DISTINCT CASE WHEN e.event_type='click' THEN e.recipient_email END) as click_count,
      COUNT(DISTINCT CASE WHEN e.event_type='unsubscribe' THEN e.recipient_email END) as unsub_count
    FROM campaigns c
    LEFT JOIN email_events e ON e.campaign_id = c.id
    WHERE c.org_id = ? AND c.status = 'sent'
    GROUP BY c.id ORDER BY c.sent_at DESC LIMIT 20
  `).bind(ORG_ID).all();

  const overall = await env.DB.prepare(`
    SELECT
      COUNT(*) as total_campaigns,
      COALESCE(SUM(sent_count), 0) as total_sent
    FROM campaigns
    WHERE org_id = ? AND status = 'sent'
  `).bind(ORG_ID).first() as { total_campaigns: number; total_sent: number };

  const eventTotals = await env.DB.prepare(`
    SELECT
      COUNT(DISTINCT CASE WHEN e.event_type='open' THEN e.id END) as total_opens,
      COUNT(DISTINCT CASE WHEN e.event_type='click' THEN e.id END) as total_clicks,
      COUNT(DISTINCT CASE WHEN e.event_type='unsubscribe' THEN e.id END) as total_unsubs
    FROM email_events e
    JOIN campaigns c ON c.id = e.campaign_id
    WHERE c.org_id = ? AND c.status = 'sent'
  `).bind(ORG_ID).first();

  const timeline = await env.DB.prepare(`
    SELECT date(e.created_at) as date,
      COUNT(CASE WHEN e.event_type='open' THEN 1 END) as opens,
      COUNT(CASE WHEN e.event_type='click' THEN 1 END) as clicks,
      COUNT(CASE WHEN e.event_type='unsubscribe' THEN 1 END) as unsubs
    FROM email_events e
    JOIN campaigns c ON c.id = e.campaign_id
    WHERE c.org_id = ? AND e.created_at >= datetime('now', '-30 days')
    GROUP BY date(e.created_at)
    ORDER BY date
  `).bind(ORG_ID).all();

  const topLinks = await env.DB.prepare(`
    SELECT json_extract(e.metadata, '$.url') as url, COUNT(*) as clicks
    FROM email_events e
    JOIN campaigns c ON c.id = e.campaign_id
    WHERE c.org_id = ? AND e.event_type = 'click' AND e.metadata IS NOT NULL
    GROUP BY url ORDER BY clicks DESC LIMIT 10
  `).bind(ORG_ID).all();

  return json({
    overall: { ...overall, ...eventTotals },
    campaigns: campaigns.results,
    timeline: timeline.results,
    topLinks: topLinks.results,
  });
};

export const getCampaignAnalytics: Handler = async (req, env, params) => {
  await requireAuth(req, env).catch(r => { throw r; });
  const campaign = await env.DB.prepare('SELECT * FROM campaigns WHERE id = ? AND org_id = ?')
    .bind(params?.id, ORG_ID).first();
  if (!campaign) return err('Campaign not found', 404);

  const events = await env.DB.prepare(`
    SELECT event_type, COUNT(*) as count, COUNT(DISTINCT recipient_email) as unique_count
    FROM email_events WHERE campaign_id = ? GROUP BY event_type
  `).bind(params?.id).all();

  const sends = await env.DB.prepare(`
    SELECT status, COUNT(*) as count FROM campaign_sends WHERE campaign_id = ? GROUP BY status
  `).bind(params?.id).all();

  const hourly = await env.DB.prepare(`
    SELECT strftime('%H', created_at) as hour, event_type, COUNT(*) as count
    FROM email_events WHERE campaign_id = ?
    GROUP BY hour, event_type ORDER BY hour
  `).bind(params?.id).all();

  const topLinks = await env.DB.prepare(`
    SELECT json_extract(metadata, '$.url') as url, COUNT(*) as clicks
    FROM email_events WHERE campaign_id = ? AND event_type = 'click'
    GROUP BY url ORDER BY clicks DESC LIMIT 10
  `).bind(params?.id).all();

  return json({ campaign, events: events.results, sends: sends.results, hourly: hourly.results, topLinks: topLinks.results });
};

// ──────────────────────────────────────────────
// ORG SETTINGS  (replaces per-user settings)
// All users read/write the same Gmail config
// ──────────────────────────────────────────────

export const getSettings: Handler = async (req, env) => {
  await requireAuth(req, env).catch(r => { throw r; });
  const row = await env.DB.prepare('SELECT * FROM org_settings WHERE org_id = ?').bind(ORG_ID).first();
  return json(row);
};

export const updateSettings: Handler = async (req, env) => {
  await requireAuth(req, env).catch(r => { throw r; });
  const body = await req.json() as {
    name?: string; gmail_client_id?: string; gmail_client_secret?: string;
    gmail_refresh_token?: string; gmail_sender_email?: string;
  };
  await env.DB.prepare(`
    INSERT INTO org_settings (org_id, name, gmail_client_id, gmail_client_secret, gmail_refresh_token, gmail_sender_email)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(org_id) DO UPDATE SET
      name                = COALESCE(excluded.name, name),
      gmail_client_id     = COALESCE(excluded.gmail_client_id, gmail_client_id),
      gmail_client_secret = COALESCE(excluded.gmail_client_secret, gmail_client_secret),
      gmail_refresh_token = COALESCE(excluded.gmail_refresh_token, gmail_refresh_token),
      gmail_sender_email  = COALESCE(excluded.gmail_sender_email, gmail_sender_email),
      updated_at          = datetime('now')
  `).bind(ORG_ID, body.name || null, body.gmail_client_id || null,
    body.gmail_client_secret || null, body.gmail_refresh_token || null,
    body.gmail_sender_email || null).run();

  return json(await env.DB.prepare('SELECT * FROM org_settings WHERE org_id = ?').bind(ORG_ID).first());
};

// ──────────────────────────────────────────────
// SUPABASE STORAGE UPLOAD (proxied through worker)
// ──────────────────────────────────────────────

export const uploadImage: Handler = async (req, env) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return err('file is required');

  const name = (form.get('name') as string) || file.name;
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${user.id}/${Date.now()}-${safeName}`;

  const supabaseServiceKey = await env.SUPABASE_SERVICE_KEY.get();

  const res = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/ad-images/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'false',
      },
      body: file,
    }
  );

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    console.error('Supabase upload failed:', res.status, bodyText);
    return err(`Failed to upload to storage (${res.status})`, 500);
  }

  const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/ad-images/${path}`;
  const id = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO images (id, user_id, org_id, name, url, size_bytes, mime_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, user.id, ORG_ID, name, publicUrl, file.size, file.type || null).run();

  return json(await env.DB.prepare('SELECT * FROM images WHERE id = ?').bind(id).first(), 201);
};