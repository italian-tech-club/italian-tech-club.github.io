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
