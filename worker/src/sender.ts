import { Env } from './types';
import { getContactsFromNeon } from './neon';
import { sendEmail, injectTracking } from './gmail';

export async function sendCampaign(campaignId: string, env: Env): Promise<void> {
  // Lock campaign to 'sending'
  const campaign = await env.DB.prepare('SELECT * FROM campaigns WHERE id = ?')
    .bind(campaignId).first() as {
      id: string; user_id: string; subject: string; html_content: string;
      contact_list_id: string; from_name: string; from_email: string; reply_to: string;
      status: string;
    } | null;

  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status === 'sent' || campaign.status === 'sending') return;

  await env.DB.prepare("UPDATE campaigns SET status='sending', updated_at=datetime('now') WHERE id=?")
    .bind(campaignId).run();

  // Get user's Gmail config
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(campaign.user_id).first() as {
    gmail_client_id: string; gmail_client_secret: string;
    gmail_refresh_token: string; gmail_sender_email: string;
  } | null;

  if (!user?.gmail_refresh_token) {
    await env.DB.prepare("UPDATE campaigns SET status='failed' WHERE id=?").bind(campaignId).run();
    throw new Error('Gmail not configured');
  }

  // Get contact list
  const list = await env.DB.prepare('SELECT * FROM contact_lists WHERE id = ?')
    .bind(campaign.contact_list_id).first() as {
      neon_table_name: string; neon_email_column: string; neon_name_column: string;
    } | null;

  if (!list) throw new Error('Contact list not found');

  // Get unsubscribes to exclude
  const unsubs = await env.DB.prepare('SELECT email FROM unsubscribes WHERE user_id = ?')
    .bind(campaign.user_id).all();
  const excludeEmails = (unsubs.results as { email: string }[]).map(r => r.email);

  // Resolve secrets from Secrets Store
  const [neonDatabaseUrl, trackPixelBaseUrl] = await Promise.all([
    env.NEON_DATABASE_URL.get(),
    env.TRACK_PIXEL_BASE_URL.get(),
  ]);

  // Fetch contacts from NeonDB
  const contacts = await getContactsFromNeon(
    neonDatabaseUrl,
    list.neon_table_name,
    list.neon_email_column,
    list.neon_name_column,
    excludeEmails
  );

  await env.DB.prepare('UPDATE campaigns SET total_recipients = ? WHERE id = ?')
    .bind(contacts.length, campaignId).run();

  const gmailConfig = {
    clientId: user.gmail_client_id,
    clientSecret: user.gmail_client_secret,
    refreshToken: user.gmail_refresh_token,
    senderEmail: campaign.from_email || user.gmail_sender_email,
    fromName: campaign.from_name || undefined,
  };

  let sentCount = 0;
  let failedCount = 0;
  const BATCH_SIZE = 5; // Rate limit: stay under Gmail's 500/day for regular accounts

  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (contact) => {
        const sendId = crypto.randomUUID();

        // Add unsubscribe link to HTML
        const unsubUrl = `${trackPixelBaseUrl}/t/unsub/${sendId}`;
        let html = campaign.html_content
          .replace(/\{\{name\}\}/gi, contact.name || 'there')
          .replace(/\{\{email\}\}/gi, contact.email);

        // Inject tracking + unsubscribe
        if (!html.includes('Unsubscribe')) {
          html += `<p style="font-size:11px;color:#999;text-align:center;margin-top:32px">
            <a href="${unsubUrl}" style="color:#999">Unsubscribe</a>
          </p>`;
        }
        html = injectTracking(html, trackPixelBaseUrl, sendId);

        // Pre-insert send record
        await env.DB.prepare(`
          INSERT INTO campaign_sends (id, campaign_id, recipient_email, recipient_name, status)
          VALUES (?, ?, ?, ?, 'pending')
        `).bind(sendId, campaignId, contact.email, contact.name || null).run();

        try {
          const messageId = await sendEmail({
            config: gmailConfig,
            to: contact.email,
            toName: contact.name,
            subject: campaign.subject,
            htmlBody: html,
            replyTo: campaign.reply_to || undefined,
            messageId: sendId,
          });

          await env.DB.prepare(`
            UPDATE campaign_sends SET status='sent', sent_at=datetime('now'), message_id=? WHERE id=?
          `).bind(messageId, sendId).run();
          sentCount++;
        } catch (e) {
          await env.DB.prepare(`
            UPDATE campaign_sends SET status='failed', error_message=? WHERE id=?
          `).bind(String(e), sendId).run();
          failedCount++;
        }
      })
    );

    // Small delay between batches
    if (i + BATCH_SIZE < contacts.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  await env.DB.prepare(`
    UPDATE campaigns SET status='sent', sent_at=datetime('now'),
    sent_count=?, failed_count=?, updated_at=datetime('now') WHERE id=?
  `).bind(sentCount, failedCount, campaignId).run();
}