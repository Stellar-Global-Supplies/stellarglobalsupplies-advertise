import { Env } from './types';
import { requireAuth } from './auth';
import { countContacts } from './neon';

type Handler = (request: Request, env: Env, params?: Record<string, string>) => Promise<Response>;

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
// TEMPLATES
// ──────────────────────────────────────────────

export const listTemplates: Handler = async (req, env) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  const rows = await env.DB.prepare(
    'SELECT * FROM templates WHERE user_id = ? ORDER BY updated_at DESC'
  ).bind(user.id).all();
  return json(rows.results);
};

export const createTemplate: Handler = async (req, env) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  const body = await req.json() as { name: string; subject: string; html_content: string; preview_text?: string };
  if (!body.name || !body.html_content) return err('name and html_content required');

  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO templates (id, user_id, name, subject, html_content, preview_text)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, user.id, body.name, body.subject || '', body.html_content, body.preview_text || null).run();

  const row = await env.DB.prepare('SELECT * FROM templates WHERE id = ?').bind(id).first();
  return json(row, 201);
};

export const updateTemplate: Handler = async (req, env, params) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  const body = await req.json() as Record<string, string>;
  const id = params?.id;

  const existing = await env.DB.prepare('SELECT id FROM templates WHERE id = ? AND user_id = ?')
    .bind(id, user.id).first();
  if (!existing) return err('Template not found', 404);

  await env.DB.prepare(`
    UPDATE templates SET name=?, subject=?, html_content=?, preview_text=?, updated_at=datetime('now')
    WHERE id = ? AND user_id = ?
  `).bind(body.name, body.subject, body.html_content, body.preview_text || null, id, user.id).run();

  return json(await env.DB.prepare('SELECT * FROM templates WHERE id = ?').bind(id).first());
};

export const deleteTemplate: Handler = async (req, env, params) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  await env.DB.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?')
    .bind(params?.id, user.id).run();
  return json({ success: true });
};

// ──────────────────────────────────────────────
// IMAGES
// ──────────────────────────────────────────────

export const listImages: Handler = async (req, env) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  const rows = await env.DB.prepare(
    'SELECT * FROM images WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(user.id).all();
  return json(rows.results);
};

export const saveImage: Handler = async (req, env) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  const body = await req.json() as { name: string; url: string; size_bytes?: number; mime_type?: string };
  if (!body.url) return err('url required');

  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO images (id, user_id, name, url, size_bytes, mime_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, user.id, body.name || 'image', body.url, body.size_bytes || null, body.mime_type || null).run();

  return json(await env.DB.prepare('SELECT * FROM images WHERE id = ?').bind(id).first(), 201);
};

export const deleteImage: Handler = async (req, env, params) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  const img = await env.DB.prepare('SELECT * FROM images WHERE id = ? AND user_id = ?')
    .bind(params?.id, user.id).first() as { url: string } | null;
  if (!img) return err('Image not found', 404);

  // Resolve secrets needed for Supabase Storage delete
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

  await env.DB.prepare('DELETE FROM images WHERE id = ? AND user_id = ?').bind(params?.id, user.id).run();
  return json({ success: true });
};

// ──────────────────────────────────────────────
// CONTACT LISTS
// ──────────────────────────────────────────────

export const listContactLists: Handler = async (req, env) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  const rows = await env.DB.prepare(
    'SELECT * FROM contact_lists WHERE user_id = ? ORDER BY name'
  ).bind(user.id).all();
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
    INSERT INTO contact_lists (id, user_id, name, neon_table_name, neon_email_column, neon_name_column, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, user.id, body.name, body.neon_table_name,
    body.neon_email_column || 'email', body.neon_name_column || 'name',
    body.description || null).run();

  return json(await env.DB.prepare('SELECT * FROM contact_lists WHERE id = ?').bind(id).first(), 201);
};

export const syncContactList: Handler = async (req, env, params) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  const list = await env.DB.prepare('SELECT * FROM contact_lists WHERE id = ? AND user_id = ?')
    .bind(params?.id, user.id).first() as { neon_table_name: string; neon_email_column: string } | null;
  if (!list) return err('List not found', 404);

  // Resolve NeonDB URL from Secrets Store
  const neonDatabaseUrl = await env.NEON_DATABASE_URL.get();

  const count = await countContacts(neonDatabaseUrl, list.neon_table_name, list.neon_email_column);
  await env.DB.prepare(`
    UPDATE contact_lists SET subscriber_count = ?, last_synced_at = datetime('now') WHERE id = ?
  `).bind(count, params?.id).run();

  return json({ subscriber_count: count });
};

export const deleteContactList: Handler = async (req, env, params) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  await env.DB.prepare('DELETE FROM contact_lists WHERE id = ? AND user_id = ?')
    .bind(params?.id, user.id).run();
  return json({ success: true });
};

// ──────────────────────────────────────────────
// CAMPAIGNS
// ──────────────────────────────────────────────

export const listCampaigns: Handler = async (req, env) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  const rows = await env.DB.prepare(`
    SELECT c.*, cl.name as list_name
    FROM campaigns c
    LEFT JOIN contact_lists cl ON cl.id = c.contact_list_id
    WHERE c.user_id = ? ORDER BY c.created_at DESC
  `).bind(user.id).all();
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
    INSERT INTO campaigns (id, user_id, name, subject, html_content, contact_list_id, template_id,
      from_name, from_email, reply_to, scheduled_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, user.id, body.name, body.subject || '', body.html_content,
    body.contact_list_id, body.template_id || null,
    body.from_name || null, body.from_email || null, body.reply_to || null,
    body.scheduled_at || null,
    body.scheduled_at ? 'scheduled' : 'draft').run();

  return json(await env.DB.prepare('SELECT * FROM campaigns WHERE id = ?').bind(id).first(), 201);
};

export const getCampaign: Handler = async (req, env, params) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  const row = await env.DB.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?')
    .bind(params?.id, user.id).first();
  if (!row) return err('Campaign not found', 404);
  return json(row);
};

export const updateCampaign: Handler = async (req, env, params) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  const body = await req.json() as Record<string, string>;
  const c = await env.DB.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?')
    .bind(params?.id, user.id).first() as { status: string } | null;
  if (!c) return err('Campaign not found', 404);
  if (c.status === 'sending' || c.status === 'sent') return err('Cannot edit a sent campaign');

  await env.DB.prepare(`
    UPDATE campaigns SET name=?, subject=?, html_content=?, from_name=?, from_email=?,
    reply_to=?, scheduled_at=?, updated_at=datetime('now')
    WHERE id = ? AND user_id = ?
  `).bind(body.name, body.subject, body.html_content, body.from_name || null,
    body.from_email || null, body.reply_to || null, body.scheduled_at || null,
    params?.id, user.id).run();

  return json(await env.DB.prepare('SELECT * FROM campaigns WHERE id = ?').bind(params?.id).first());
};

export const deleteCampaign: Handler = async (req, env, params) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  await env.DB.prepare('DELETE FROM campaigns WHERE id = ? AND user_id = ?')
    .bind(params?.id, user.id).run();
  return json({ success: true });
};

// ──────────────────────────────────────────────
// ANALYTICS
// ──────────────────────────────────────────────

export const getAnalyticsSummary: Handler = async (req, env) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });

  const campaigns = await env.DB.prepare(`
    SELECT c.id, c.name, c.sent_at, c.total_recipients, c.sent_count, c.failed_count,
      COUNT(DISTINCT CASE WHEN e.event_type='open' THEN e.recipient_email END) as open_count,
      COUNT(DISTINCT CASE WHEN e.event_type='click' THEN e.recipient_email END) as click_count,
      COUNT(DISTINCT CASE WHEN e.event_type='unsubscribe' THEN e.recipient_email END) as unsub_count
    FROM campaigns c
    LEFT JOIN email_events e ON e.campaign_id = c.id
    WHERE c.user_id = ? AND c.status = 'sent'
    GROUP BY c.id ORDER BY c.sent_at DESC LIMIT 20
  `).bind(user.id).all();

  const overall = await env.DB.prepare(`
    SELECT
      COUNT(DISTINCT c.id) as total_campaigns,
      SUM(c.sent_count) as total_sent,
      COUNT(DISTINCT CASE WHEN e.event_type='open' THEN e.id END) as total_opens,
      COUNT(DISTINCT CASE WHEN e.event_type='click' THEN e.id END) as total_clicks,
      COUNT(DISTINCT CASE WHEN e.event_type='unsubscribe' THEN e.id END) as total_unsubs
    FROM campaigns c
    LEFT JOIN email_events e ON e.campaign_id = c.id
    WHERE c.user_id = ? AND c.status = 'sent'
  `).bind(user.id).first();

  const timeline = await env.DB.prepare(`
    SELECT date(e.created_at) as date,
      COUNT(CASE WHEN e.event_type='open' THEN 1 END) as opens,
      COUNT(CASE WHEN e.event_type='click' THEN 1 END) as clicks,
      COUNT(CASE WHEN e.event_type='unsubscribe' THEN 1 END) as unsubs
    FROM email_events e
    JOIN campaigns c ON c.id = e.campaign_id
    WHERE c.user_id = ? AND e.created_at >= datetime('now', '-30 days')
    GROUP BY date(e.created_at)
    ORDER BY date
  `).bind(user.id).all();

  const topLinks = await env.DB.prepare(`
    SELECT json_extract(e.metadata, '$.url') as url, COUNT(*) as clicks
    FROM email_events e
    JOIN campaigns c ON c.id = e.campaign_id
    WHERE c.user_id = ? AND e.event_type = 'click' AND e.metadata IS NOT NULL
    GROUP BY url ORDER BY clicks DESC LIMIT 10
  `).bind(user.id).all();

  return json({ overall, campaigns: campaigns.results, timeline: timeline.results, topLinks: topLinks.results });
};

export const getCampaignAnalytics: Handler = async (req, env, params) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  const campaign = await env.DB.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?')
    .bind(params?.id, user.id).first();
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
// USER SETTINGS
// ──────────────────────────────────────────────

export const getSettings: Handler = async (req, env) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  return json(row);
};

export const updateSettings: Handler = async (req, env) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  const body = await req.json() as {
    name?: string; gmail_client_id?: string; gmail_client_secret?: string;
    gmail_refresh_token?: string; gmail_sender_email?: string;
  };
  await env.DB.prepare(`
    UPDATE users SET name=COALESCE(?,name), gmail_client_id=COALESCE(?,gmail_client_id),
    gmail_client_secret=COALESCE(?,gmail_client_secret),
    gmail_refresh_token=COALESCE(?,gmail_refresh_token),
    gmail_sender_email=COALESCE(?,gmail_sender_email), updated_at=datetime('now')
    WHERE id=?
  `).bind(body.name||null, body.gmail_client_id||null, body.gmail_client_secret||null,
    body.gmail_refresh_token||null, body.gmail_sender_email||null, user.id).run();

  return json(await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first());
};

// ──────────────────────────────────────────────
// SUPABASE STORAGE SIGNED UPLOAD URL
// ──────────────────────────────────────────────

export const getUploadUrl: Handler = async (req, env) => {
  const user = await requireAuth(req, env).catch(r => { throw r; });
  const body = await req.json() as { filename: string; mime_type: string };
  const path = `${user.id}/${Date.now()}-${body.filename}`;

  // Resolve service key from Secrets Store
  const supabaseServiceKey = await env.SUPABASE_SERVICE_KEY.get();

  const res = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/upload/sign/ad-images/${path}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 300 }),
    }
  );

  if (!res.ok) return err('Failed to generate upload URL', 500);
  const data = await res.json() as { signedURL: string; token: string; path: string };

  const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/ad-images/${path}`;
  return json({ signed_url: `${env.SUPABASE_URL}/storage/v1${data.signedURL}`, public_url: publicUrl, path });
};