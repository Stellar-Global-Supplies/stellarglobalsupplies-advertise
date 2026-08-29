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

// Tiny router — ctx threaded through so handlers can use waitUntil
type RouteHandler = (
  req: Request,
  env: Env,
  params: Record<string, string>,
  ctx: ExecutionContext
) => Promise<Response>;

const routes: Array<{ method: string; pattern: URLPattern; handler: RouteHandler }> = [];

function route(method: string, path: string, handler: RouteHandler) {
  routes.push({ method, pattern: new URLPattern({ pathname: path }), handler });
}

// ── Register routes ──────────────────────────────────────────────────────────

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
route('POST',   '/api/contact-lists/:id/emails',        R.addManualEmails);
route('GET',    '/api/contact-lists/:id/emails',        R.listManualEmails);
route('DELETE', '/api/contact-lists/:id/emails/:emailId', R.deleteManualEmail);

route('GET',    '/api/campaigns',                       R.listCampaigns);
route('POST',   '/api/campaigns',                       R.createCampaign);
route('GET',    '/api/campaigns/:id',                   R.getCampaign);
route('PUT',    '/api/campaigns/:id',                   R.updateCampaign);
route('DELETE', '/api/campaigns/:id',                   R.deleteCampaign);

route('GET',    '/api/analytics',                       R.getAnalyticsSummary);
route('GET',    '/api/analytics/:id',                   R.getCampaignAnalytics);

route('GET',    '/api/settings',                        R.getSettings);
route('PUT',    '/api/settings',                        R.updateSettings);

// ── Send campaign — uses ctx.waitUntil so the worker stays alive ─────────────
route('POST', '/api/campaigns/:id/send', async (req, env, params, ctx) => {
  await requireAuth(req, env).catch(r => { throw r; });

  const campaign = await env.DB.prepare(
    "SELECT * FROM campaigns WHERE id = ? AND org_id = 'default'"
  ).bind(params.id).first() as { status: string } | null;

  if (!campaign) {
    return new Response(JSON.stringify({ error: 'Campaign not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  if (campaign.status === 'sending' || campaign.status === 'sent') {
    return new Response(JSON.stringify({ error: 'Already sent or sending' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ctx.waitUntil keeps the worker alive until sendCampaign fully resolves —
  // without this the worker dies as soon as the 202 response is returned,
  // which is why campaigns were getting stuck in "sending" / falling back to draft.
  ctx.waitUntil(
    sendCampaign(params.id, env, ctx).catch(async (err) => {
      console.error('sendCampaign failed:', err);
      // Mark as failed so the UI shows the real state instead of hanging on "sending"
      await env.DB.prepare(
        "UPDATE campaigns SET status='failed', updated_at=datetime('now') WHERE id=?"
      ).bind(params.id).run().catch(() => {});
    })
  );

  return new Response(JSON.stringify({ message: 'Campaign sending started' }), {
    status: 202, headers: { 'Content-Type': 'application/json' },
  });
});

// ── Main fetch handler ───────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // ── Tracking endpoints (no auth, no secrets needed) ──────────────────────

    // Open pixel
    if (url.pathname.startsWith('/t/open/')) {
      const sendId = url.pathname.split('/t/open/')[1];
      if (sendId) {
        ctx.waitUntil(
          env.DB.prepare(`
            INSERT INTO email_events (id, campaign_id, send_id, recipient_email, event_type)
            SELECT ?, campaign_id, id, recipient_email, 'open' FROM campaign_sends WHERE id = ?
          `).bind(crypto.randomUUID(), sendId).run().catch(() => {})
        );
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
        ctx.waitUntil(
          env.DB.prepare(`
            INSERT INTO email_events (id, campaign_id, send_id, recipient_email, event_type, metadata)
            SELECT ?, campaign_id, id, recipient_email, 'click', ? FROM campaign_sends WHERE id = ?
          `).bind(crypto.randomUUID(), metadata, sendId).run().catch(() => {})
        );
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
          const unsubResult = await env.DB.prepare(`
            INSERT OR IGNORE INTO unsubscribes (id, user_id, org_id, email, campaign_id)
            VALUES (?, ?, 'default', ?, ?)
          `).bind(crypto.randomUUID(), send.user_id, send.recipient_email, send.campaign_id).run();

          // Only log an unsubscribe event the first time — INSERT OR IGNORE means
          // repeat visits to this link (reloads, link scanners, double-clicks)
          // won't inflate the unsubscribe count in analytics.
          if (unsubResult.meta.changes > 0) {
            await env.DB.prepare(`
              INSERT INTO email_events (id, campaign_id, send_id, recipient_email, event_type)
              VALUES (?, ?, ?, ?, 'unsubscribe')
            `).bind(crypto.randomUUID(), send.campaign_id, sendId, send.recipient_email).run();
          }
        }
      }

      return new Response(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:80px">
        <h2>You've been unsubscribed</h2>
        <p>You won't receive further emails from this sender.</p>
      </body></html>`, { headers: { 'Content-Type': 'text/html' } });
    }

    // ── API routes ────────────────────────────────────────────────────────────
    try {
      for (const { method, pattern, handler } of routes) {
        if (request.method !== method) continue;
        const match = pattern.exec(url);
        if (match) {
          const params = match.pathname.groups as Record<string, string>;
          const res = await handler(request, env, params, ctx);
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
      status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  },

  // Cron: send scheduled campaigns, and resume any mid-send campaign whose
  // last invocation got cut off (e.g. hit the Worker subrequest ceiling).
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const due = await env.DB.prepare(`
      SELECT id FROM campaigns
      WHERE status = 'scheduled' AND scheduled_at <= datetime('now')
    `).all();

    for (const row of due.results as { id: string }[]) {
      ctx.waitUntil(sendCampaign(row.id, env, ctx).catch(console.error));
    }

    // Resume in-progress campaigns one chunk at a time. Limited to a
    // handful per tick to keep each cron invocation's own resource usage low.
    // Only pick up campaigns whose last update is >20s old, so we don't grab
    // one that's still being actively worked by another invocation right now
    // (e.g. the manual "Send" click that's mid-chunk) and double-send.
    const inProgress = await env.DB.prepare(`
      SELECT id FROM campaigns
      WHERE status = 'sending' AND updated_at <= datetime('now', '-20 seconds')
      LIMIT 3
    `).all();

    for (const row of inProgress.results as { id: string }[]) {
      ctx.waitUntil(
        sendCampaign(row.id, env, ctx).catch(async (err) => {
          console.error('sendCampaign resume failed:', err);
          await env.DB.prepare(
            "UPDATE campaigns SET status='failed', updated_at=datetime('now') WHERE id=?"
          ).bind(row.id).run().catch(() => {});
        })
      );
    }

    // Resume in-progress campaigns one chunk at a time. Limited to a
    // handful per tick to keep each cron invocation's own resource usage low.
    // Only pick up campaigns whose last update is >20s old, so we don't grab
    // one that's still being actively worked by another invocation right now
    // (e.g. the manual "Send" click that's mid-chunk) and double-send.
    const inProgress = await env.DB.prepare(`
      SELECT id FROM campaigns
      WHERE status = 'sending' AND updated_at <= datetime('now', '-20 seconds')
      LIMIT 3
    `).all();

    for (const row of inProgress.results as { id: string }[]) {
      ctx.waitUntil(
        sendCampaign(row.id, env).catch(async (err) => {
          console.error('sendCampaign resume failed:', err);
          await env.DB.prepare(
            "UPDATE campaigns SET status='failed', updated_at=datetime('now') WHERE id=?"
          ).bind(row.id).run().catch(() => {});
        })
      );
    }
  },
} satisfies ExportedHandler<Env>;
