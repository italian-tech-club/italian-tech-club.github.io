export const SITE_URL = process.env.SITE_URL || 'http://localhost:5173';
export const FROM_EMAIL = process.env.SPONSOR_FROM_EMAIL || 'ITC Website <onboarding@resend.dev>';

/**
 * Send an email via the Resend REST API. Returns false (without throwing)
 * when RESEND_API_KEY is missing or the API call fails.
 */
export async function sendEmail({ to, subject, html, replyTo }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY not set — email not sent:', subject);
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!response.ok) {
    console.error('Resend API error:', response.status, await response.text());
    return false;
  }
  return true;
}

export function magicLinkHtml({ heading, intro, link, buttonLabel }) {
  return `
    <h2>${heading}</h2>
    <p>${intro}</p>
    <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#ffffff;border-radius:9999px;text-decoration:none;font-weight:bold;">${buttonLabel}</a></p>
    <p style="color:#64748b;font-size:12px;">If the button doesn't work, copy this URL: ${link}</p>
    <p style="color:#64748b;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
  `;
}

/**
 * Substitute the campaign placeholders in a subject/body string.
 * Supported: {{firstName}}, {{lastName}}, {{link}}.
 */
export function fillTemplate(str, { firstName = '', lastName = '', link = '' } = {}) {
  return String(str ?? '')
    .split('{{firstName}}').join(firstName)
    .split('{{lastName}}').join(lastName)
    .split('{{link}}').join(link);
}

/**
 * Wrap an admin-authored campaign body (plain text with newlines) in the email
 * chrome and always append a prominent claim/sign-in button, so a working link
 * reaches the recipient regardless of what the admin typed.
 */
export function campaignHtml({ bodyHtml, link, buttonLabel }) {
  const body = String(bodyHtml ?? '').replace(/\n/g, '<br/>');
  return `
    <div style="font-size:15px;line-height:1.6;">${body}</div>
    <p style="margin-top:24px;"><a href="${link}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#ffffff;border-radius:9999px;text-decoration:none;font-weight:bold;">${buttonLabel}</a></p>
    <p style="color:#64748b;font-size:12px;">If the button doesn't work, copy this URL: ${link}</p>
  `;
}

/**
 * Send many distinct emails in one Resend batch call (up to 100 per request —
 * chunk before calling if you have more). Never throws; returns per-recipient
 * ok flags so callers can record which sends succeeded.
 */
export async function sendEmailBatch(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: true, results: [] };
  }
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY not set — batch not sent:', messages.length, 'messages');
    return { ok: false, results: messages.map((m) => ({ to: m.to, ok: false })) };
  }

  const payload = messages.map((m) => ({
    from: FROM_EMAIL,
    to: [m.to],
    subject: m.subject,
    html: m.html,
    ...(m.replyTo ? { reply_to: m.replyTo } : {}),
  }));

  try {
    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Resend batch API error:', response.status, await response.text());
      return { ok: false, results: messages.map((m) => ({ to: m.to, ok: false })) };
    }
    return { ok: true, results: messages.map((m) => ({ to: m.to, ok: true })) };
  } catch (error) {
    console.error('Resend batch exception:', error);
    return { ok: false, results: messages.map((m) => ({ to: m.to, ok: false })) };
  }
}
