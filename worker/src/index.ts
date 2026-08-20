import { Env } from './types';
import { requireAuth } from './auth';
import { sendCampaign } from './sender';
import * as R from './routes';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function withCors(res: Response): Response {
  const r = new Response(res.body, res);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => r.headers.set(k, v));
  return r;
}

// Tiny router
type RouteHandler = (req: Request, env: Env, params: Record<string, string>) => Promise<Response>;
const routes: Array<{ method: string; pattern: URLPattern; handler: RouteHandler }> = [];

function route(method: string, path: string, handler: RouteHandler) {
  routes.push({ method, pattern: new URLPattern({ pathname: path }), handler });
}

// Register routes
route('GET',    '/api/templates',                       R.listTemplates);
route('POST',   '/api/templates',                       R.createTemplate);
route('PUT',    '/api/templates/:id',                   R.updateTemplate);
route('DELETE', '/api/templates/:id',                   R.deleteTemplate);

route('GET',    '/api/images',                          R.listImages);
route('POST',   '/api/images',                          R.saveImage);
route('DELETE', '/api/images/:id',                      R.deleteImage);
route('POST',   '/api/images/upload',                   R.uploadImage);

route('GET',    '/api/contact-lists',                   R.listContactLists);
route('POST',   '/api/contact-lists',                   R.createContactList);
route('POST',   '/api/contact-lists/:id/sync',          R.syncContactList);
route('DELETE', '/api/contact-lists/:id',               R.deleteContactList);

route('GET',    '/api/campaigns',                       R.listCampaigns);
route('POST',   '/api/campaigns',                       R.createCampaign);
route('GET',    '/api/campaigns/:id',                   R.getCampaign);
route('PUT',    '/api/campaigns/:id',                   R.updateCampaign);
route('DELETE', '/api/campaigns/:id',                   R.deleteCampaign);

route('GET',    '/api/analytics',                       R.getAnalyticsSummary);
route('GET',    '/api/analytics/:id',                   R.getCampaignAnalytics);

route('GET',    '/api/settings',                        R.getSettings);
route('PUT',    '/api/settings',                        R.updateSettings);

// Send campaign endpoint
route('POST', '/api/campaigns/:id/send', async (req, env, params) => {
  await requireAuth(req, env).catch(r => { throw r; });
  const campaign = await env.DB.prepare("SELECT * FROM campaigns WHERE id = ? AND org_id = 'default'")
    .bind(params.id).first() as { status: string } | null;
  if (!campaign) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  if (campaign.status === 'sending' || campaign.status === 'sent') {
    return new Response(JSON.stringify({ error: 'Already sent or sending' }), { status: 400 });
  }

  // Fire and forget
  sendCampaign(params.id, env).catch(console.error);
  return new Response(JSON.stringify({ message: 'Campaign sending started' }), {
    status: 202, headers: { 'Content-Type': 'application/json' }
  });
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // ── Tracking endpoints (no auth, no secrets needed) ────────────────────────

    // Open pixel
    if (url.pathname.startsWith('/t/open/')) {
      const sendId = url.pathname.split('/t/open/')[1];
      if (sendId) {
        await env.DB.prepare(`
          INSERT INTO email_events (id, campaign_id, send_id, recipient_email, event_type)
          SELECT ?, campaign_id, id, recipient_email, 'open' FROM campaign_sends WHERE id = ?
        `).bind(crypto.randomUUID(), sendId).run().catch(() => {});
      }
      const gif = new Uint8Array([71,73,70,56,57,97,1,0,1,0,0,0,0,33,249,4,0,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,0,59]);
      return new Response(gif, { headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-cache' } });
    }

    // Click tracking
    if (url.pathname.startsWith('/t/click/')) {
      const sendId = url.pathname.split('/t/click/')[1];
      const targetUrl = url.searchParams.get('url') || '/';
      if (sendId) {
        const metadata = JSON.stringify({ url: targetUrl, user_agent: request.headers.get('user-agent') });
        await env.DB.prepare(`
          INSERT INTO email_events (id, campaign_id, send_id, recipient_email, event_type, metadata)
          SELECT ?, campaign_id, id, recipient_email, 'click', ? FROM campaign_sends WHERE id = ?
        `).bind(crypto.randomUUID(), metadata, sendId).run().catch(() => {});
      }
      return Response.redirect(targetUrl, 302);
    }

    // Unsubscribe
    if (url.pathname.startsWith('/t/unsub/')) {
      const sendId = url.pathname.split('/t/unsub/')[1];
      if (sendId) {
        const send = await env.DB.prepare(
          'SELECT cs.*, c.user_id FROM campaign_sends cs JOIN campaigns c ON c.id = cs.campaign_id WHERE cs.id = ?'
        ).bind(sendId).first() as { recipient_email: string; campaign_id: string; user_id: string } | null;

        if (send) {
          await env.DB.prepare(`
            INSERT OR IGNORE INTO unsubscribes (id, user_id, org_id, email, campaign_id)
            VALUES (?, ?, 'default', ?, ?)
          `).bind(crypto.randomUUID(), send.user_id, send.recipient_email, send.campaign_id).run();

          await env.DB.prepare(`
            INSERT INTO email_events (id, campaign_id, send_id, recipient_email, event_type)
            VALUES (?, ?, ?, ?, 'unsubscribe')
          `).bind(crypto.randomUUID(), send.campaign_id, sendId, send.recipient_email).run();
        }
      }

      return new Response(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:80px">
        <h2>You've been unsubscribed</h2>
        <p>You won't receive further emails from this sender.</p>
      </body></html>`, { headers: { 'Content-Type': 'text/html' } });
    }

    // ── API routes ──────────────────────────────────────────────
    try {
      for (const { method, pattern, handler } of routes) {
        if (request.method !== method) continue;
        const match = pattern.exec(url);
        if (match) {
          const params = match.pathname.groups as Record<string, string>;
          const res = await handler(request, env, params);
          return withCors(res);
        }
      }
    } catch (thrown) {
      if (thrown instanceof Response) return withCors(thrown);
      console.error(thrown);
      return withCors(new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      }));
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  },

  // Cron: send scheduled campaigns
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const due = await env.DB.prepare(`
      SELECT id FROM campaigns
      WHERE status = 'scheduled' AND scheduled_at <= datetime('now')
    `).all();

    for (const row of due.results as { id: string }[]) {
      ctx.waitUntil(sendCampaign(row.id, env).catch(console.error));
    }
  },
} satisfies ExportedHandler<Env>;