export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  senderEmail: string;
  fromName?: string;
}

export async function getAccessToken(config: GmailConfig): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to get Gmail access token: ${err}`);
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
}

function encodeBase64Url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export interface SendEmailParams {
  accessToken: string; // reused across a whole send batch, not fetched per-email
  config: GmailConfig;
  to: string;
  toName?: string;
  subject: string;
  htmlBody: string;
  replyTo?: string;
  messageId?: string; // for tracking unsubscribes
}

export async function sendEmail(params: SendEmailParams): Promise<string> {
  const from = params.config.fromName
    ? `${params.config.fromName} <${params.config.senderEmail}>`
    : params.config.senderEmail;
  const to = params.toName ? `${params.toName} <${params.to}>` : params.to;

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${params.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
  ];

  if (params.replyTo) headers.push(`Reply-To: ${params.replyTo}`);
  if (params.messageId) headers.push(`X-Campaign-Send-Id: ${params.messageId}`);

  const rawEmail = headers.join('\r\n') + '\r\n\r\n' + params.htmlBody;
  const encodedEmail = encodeBase64Url(rawEmail);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedEmail }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail send failed: ${err}`);
  }

  const result = await res.json() as { id: string };
  return result.id;
}

export function injectTracking(
  html: string,
  trackPixelUrl: string,
  sendId: string
): string {
  // Inject open-tracking pixel
  const pixel = `<img src="${trackPixelUrl}/t/open/${sendId}" width="1" height="1" style="display:none" alt="" />`;
  html = html.replace('</body>', `${pixel}</body>`);
  if (!html.includes('</body>')) html += pixel;

  // Inject click tracking on all links
  html = html.replace(/href="(https?:\/\/[^"]+)"/g, (_, url) => {
    if (url.startsWith(trackPixelUrl)) return `href="${url}"`;
    const tracked = `${trackPixelUrl}/t/click/${sendId}?url=${encodeURIComponent(url)}`;
    return `href="${tracked}"`;
  });

  return html;
}
