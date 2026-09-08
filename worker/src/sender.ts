import { Env } from './types';
import { getContactsFromNeon } from './neon';
import { sendEmail, injectTracking, getAccessToken } from './gmail';

const ORG_ID = 'default';

// Cloudflare Workers cap how many outbound calls (subrequests) a single
// invocation can make (as low as 50 external calls on the Free plan), and
// also cap CPU/wall time. A big recipient list can blow through either
// mid-loop — the isolate gets killed outright (not a catchable JS error),
// leaving the campaign permanently stuck at status='sending'.
//
// Fix: process a bounded CHUNK per invocation, record progress in
// campaign_sends, and if contacts remain, self-chain by firing an async
// HTTP request back to this same worker's /internal/campaigns/:id/continue
// route (see index.ts) instead of recursing in-process. That request spins
// up a brand-new Worker invocation with its own fresh subrequest/CPU budget,
// so each chunk is fully isolated no matter how long the recipient list is.
// No cron/scheduler is required — this is a self-relay, not a poll.
const CHUNK_SIZE = 20;

// How stale campaigns.updated_at must be before we consider a 'sending'
// campaign truly stalled (vs. just mid-chunk right now) and safe to resume
// manually via the /send endpoint. See index.ts.
export const STALL_THRESHOLD_SECONDS = 90;

interface CampaignRow {
  id: string; user_id: string; org_id: string; subject: string; html_content: string;
  contact_list_id: string; from_name: string; from_email: string; reply_to: string;
  status: string; total_recipients: number; product_name?: string; product_image_url?: string;
}

export async function sendCampaign(
  campaignId: string,
  env: Env,
  ctx?: ExecutionContext,
  selfBaseUrl?: string
): Promise<void> {
  const campaign = await env.DB.prepare('SELECT * FROM campaigns WHERE id = ?')
    .bind(campaignId).first() as CampaignRow | null;

  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status === 'sent' || campaign.status === 'failed') return;

  if (campaign.status !== 'sending') {
    await env.DB.prepare("UPDATE campaigns SET status='sending', updated_at=datetime('now') WHERE id=?")
      .bind(campaignId).run();
  }

  // ── Use shared org Gmail config (not per-user) ──
  const org = await env.DB.prepare('SELECT * FROM org_settings WHERE org_id = ?')
    .bind(ORG_ID).first() as {
      gmail_client_id: string; gmail_client_secret: string;
      gmail_refresh_token: string; gmail_sender_email: string;
    } | null;

  if (!org?.gmail_refresh_token) {
    await env.DB.prepare("UPDATE campaigns SET status='failed' WHERE id=?").bind(campaignId).run();
    throw new Error('Gmail not configured in org settings');
  }

  // Get contact list
  const list = await env.DB.prepare('SELECT * FROM contact_lists WHERE id = ?')
    .bind(campaign.contact_list_id).first() as {
      source_type: string; neon_table_name: string; neon_email_column: string; neon_name_column: string;
    } | null;

  if (!list) throw new Error('Contact list not found');

  // Get org-wide unsubscribes
  const unsubs = await env.DB.prepare('SELECT email FROM unsubscribes WHERE org_id = ?')
    .bind(ORG_ID).all();
  const excludeEmails = new Set((unsubs.results as { email: string }[]).map(r => r.email.toLowerCase()));

  const trackPixelBaseUrl = await env.TRACK_PIXEL_BASE_URL.get();

  let allContacts: { email: string; name?: string }[];
  if (list.source_type === 'manual') {
    const rows = await env.DB.prepare(
      'SELECT email FROM manual_contacts WHERE contact_list_id = ?'
    ).bind(campaign.contact_list_id).all();
    allContacts = (rows.results as { email: string }[])
      .filter(r => !excludeEmails.has(r.email.toLowerCase()))
      .map(r => ({ email: r.email }));
  } else {
    const neonDatabaseUrl = await env.NEON_DATABASE_URL.get();
    allContacts = await getContactsFromNeon(
      neonDatabaseUrl,
      list.neon_table_name,
      list.neon_email_column,
      list.neon_name_column,
      Array.from(excludeEmails)
    );
  }

  if (!campaign.total_recipients) {
    await env.DB.prepare("UPDATE campaigns SET total_recipients=?, updated_at=datetime('now') WHERE id=?")
      .bind(allContacts.length, campaignId).run();
  }

  // Figure out who's already been attempted (in a previous chunk/invocation)
  // so we only ever process each recipient once across the whole campaign.
  const attempted = await env.DB.prepare(
    'SELECT recipient_email FROM campaign_sends WHERE campaign_id = ?'
  ).bind(campaignId).all();
  const attemptedSet = new Set((attempted.results as { recipient_email: string }[])
    .map(r => r.recipient_email.toLowerCase()));

  const remaining = allContacts.filter(c => !attemptedSet.has(c.email.toLowerCase()));

  if (remaining.length === 0) {
    // Every recipient has been attempted (across however many chunks it took).
    // Finalize the campaign now.
    const counts = await env.DB.prepare(`
      SELECT
        SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed
      FROM campaign_sends WHERE campaign_id = ?
    `).bind(campaignId).first() as { sent: number; failed: number };

    await env.DB.prepare(`
      UPDATE campaigns SET status='sent', sent_at=datetime('now'),
        sent_count=?, failed_count=?, updated_at=datetime('now') WHERE id=?
    `).bind(counts.sent || 0, counts.failed || 0, campaignId).run();
    return;
  }

  const gmailConfig = {
    clientId: org.gmail_client_id,
    clientSecret: org.gmail_client_secret,
    refreshToken: org.gmail_refresh_token,
    senderEmail: campaign.from_email || org.gmail_sender_email,
    fromName: campaign.from_name || undefined,
  };

  // Fetch ONE access token for this whole chunk instead of one per email —
  // this alone roughly halves the external subrequests a chunk uses.
  let accessToken = await getAccessToken(gmailConfig);

  const chunk = remaining.slice(0, CHUNK_SIZE);

  for (const contact of chunk) {
    const sendId = crypto.randomUUID();

    const unsubUrl = `${trackPixelBaseUrl}/t/unsub/${sendId}`;
    let html = campaign.html_content
      .replace(/\{\{name\}\}/gi, contact.name || 'there')
      .replace(/\{\{email\}\}/gi, contact.email)
      .replace(/\{\{product_name\}\}/gi, campaign.product_name || '')
      .replace(/\{\{product_image_url\}\}/gi, campaign.product_image_url || '');

    if (!html.includes('Unsubscribe')) {
      html += `<p style="font-size:11px;color:#999;text-align:center;margin-top:32px">
        <a href="${unsubUrl}" style="color:#999">Unsubscribe</a>
      </p>`;
    }
    html = injectTracking(html, trackPixelBaseUrl, sendId);

    await env.DB.prepare(`
      INSERT INTO campaign_sends (id, campaign_id, recipient_email, recipient_name, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).bind(sendId, campaignId, contact.email, contact.name || null).run();

    try {
      let messageId: string;
      try {
        messageId = await sendEmail({
          accessToken,
          config: gmailConfig,
          to: contact.email,
          toName: contact.name,
          subject: campaign.subject,
          htmlBody: html,
          replyTo: campaign.reply_to || undefined,
          messageId: sendId,
        });
      } catch (e) {
        // Token may have expired mid-chunk — refresh once and retry this email.
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('401') || msg.toLowerCase().includes('invalid_grant') || msg.toLowerCase().includes('unauthorized')) {
          accessToken = await getAccessToken(gmailConfig);
          messageId = await sendEmail({
            accessToken,
            config: gmailConfig,
            to: contact.email,
            toName: contact.name,
            subject: campaign.subject,
            htmlBody: html,
            replyTo: campaign.reply_to || undefined,
            messageId: sendId,
          });
        } else {
          throw e;
        }
      }

      await env.DB.prepare(`
        UPDATE campaign_sends SET status='sent', message_id=?, sent_at=datetime('now') WHERE id=?
      `).bind(messageId, sendId).run();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await env.DB.prepare(`
        UPDATE campaign_sends SET status='failed', error_message=? WHERE id=?
      `).bind(msg, sendId).run();
    }
  }

  // Touch updated_at so we can tell this invocation made progress (used by
  // both ops/debugging and the stall-detection in index.ts's /send route).
  await env.DB.prepare("UPDATE campaigns SET updated_at=datetime('now') WHERE id=?").bind(campaignId).run();

  // If more contacts remain after this chunk, leave status='sending' and
  // self-chain: fire an async request back to this same worker to process
  // the next chunk in a fresh invocation. We deliberately do NOT recurse
  // in-process here — that was the bug. A fresh HTTP-triggered invocation
  // gets its own subrequest/CPU budget, so this scales to any list size.
  if (remaining.length > chunk.length) {
    if (selfBaseUrl) {
      const continueUrl = `${selfBaseUrl}/internal/campaigns/${campaignId}/continue`;
      const secret = await env.INTERNAL_CHAIN_SECRET.get();
      const doContinue = async () => {
        // A couple of retries here because this fetch call itself counts
        // against *this* invocation's subrequest budget, and we'd rather
        // retry a flaky self-call than silently drop the chain.
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res = await fetch(continueUrl, {
              method: 'POST',
              headers: { 'X-Internal-Secret': secret },
            });
            if (res.ok) return;
          } catch {
            // fall through to retry
          }
        }
        // All retries failed — leave status='sending'. It's not permanently
        // stuck: the /send endpoint's stall-detection (index.ts) lets it be
        // manually resumed once updated_at goes stale, and the UI surfaces
        // a "Resume sending" action in that case.
      };
      if (ctx) {
        ctx.waitUntil(doContinue());
      } else {
        await doContinue();
      }
    }
    // Whether or not we could self-chain, this invocation is done — return
    // now instead of looping in-process.
    return;
  }

  // This was the last chunk — finalize immediately.
  const counts = await env.DB.prepare(`
    SELECT
      SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed
    FROM campaign_sends WHERE campaign_id = ?
  `).bind(campaignId).first() as { sent: number; failed: number };

  await env.DB.prepare(`
    UPDATE campaigns SET status='sent', sent_at=datetime('now'),
      sent_count=?, failed_count=?, updated_at=datetime('now') WHERE id=?
  `).bind(counts.sent || 0, counts.failed || 0, campaignId).run();
}
