/**
 * The layout for admin-authored marketing email (the Marketing tab in /admin).
 *
 * Kept apart from utils/email.js on purpose. That module is the plumbing —
 * transactional chrome plus a Resend client — and everything it sends carries a
 * sign-in token to one person who asked for it. This is broadcast: it goes to
 * the whole contact list, so it is the one place that has to carry an
 * unsubscribe, and the one place worth designing.
 *
 * Pure rendering, no mongoose: the Vercel function registers its own copy of
 * every schema, so anything it imports must not touch models.
 */

// The frame. Poster art on these campaigns is high-contrast black/red/green, so
// the chrome stays out of its way: near-black header, warm off-white paper.
const INK = '#0A0C0F';
const PAPER = '#F1F2F1';
const CARD = '#FFFFFF';
const GREEN = '#009246';
const RED = '#CE2B37';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/**
 * The small formatting vocabulary an admin gets in the body field: **bold**,
 * _italic_, and [label](https://…). Everything else is escaped, so a stray
 * angle bracket in the copy can't break the layout.
 */
function inlineMarkup(text) {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, `<a href="$2" style="color:${GREEN};font-weight:600;">$1</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_([^_]+)_/g, '$1<em>$2</em>')
    .replace(/\n/g, '<br/>');
}

/** Blank-line-separated plain text → paragraphs, in the body type style. */
function paragraphs(body) {
  return String(body ?? '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#1F2937;">${inlineMarkup(block)}</p>`)
    .join('');
}

/** Substitute the recipient placeholders shared with the claim campaign. */
export function fillMarketingTemplate(str, { firstName = '', lastName = '' } = {}) {
  return String(str ?? '')
    .split('{{firstName}}').join(firstName)
    .split('{{lastName}}').join(lastName);
}

/** "2026-09-23" → "Mercoledì 23 settembre 2026" (UTC, so the day never slips). */
export function italianDate(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ''))) return '';
  const label = new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * The event block's facts, from an event document. Split out so the admin
 * preview and the real send agree on what a linked event contributes.
 */
export function eventFacts(event, siteUrl) {
  if (!event) return null;
  return {
    posterUrl: event.poster ? `${siteUrl}/e/${event._id}/poster.jpg` : '',
    title: event.title || '',
    dateLabel: italianDate(event.date),
    timeLabel: event.time || '',
    location: event.location || '',
    link: event.link || '',
  };
}

// One "📅 …" row of the facts table. Emoji rather than icon images: an inlined
// icon set is another thing to host, and every client already has these.
const factRow = (icon, text) => (text ? `
  <tr>
    <td style="padding:0 0 10px;font-size:15px;line-height:1.5;color:#1F2937;">
      <span style="display:inline-block;width:24px;">${icon}</span>${escapeHtml(text)}
    </td>
  </tr>` : '');

function posterBlock(facts) {
  if (!facts?.posterUrl) return '';
  const alt = escapeHtml(facts.title || 'Locandina evento');
  const inner = `<img src="${escapeHtml(facts.posterUrl)}" width="600" alt="${alt}" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />`;
  return `
    <tr>
      <td style="padding:0;background:${INK};">
        ${facts.link ? `<a href="${escapeHtml(facts.link)}" style="display:block;">${inner}</a>` : inner}
      </td>
    </tr>`;
}

function factsBlock(facts) {
  if (!facts) return '';
  const rows = factRow('📅', facts.dateLabel) + factRow('🕕', facts.timeLabel) + factRow('📍', facts.location);
  if (!rows) return '';
  return `
    <tr>
      <td style="padding:4px 32px 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
               style="border-left:3px solid ${GREEN};border-collapse:separate;">
          <tr>
            <td style="padding:2px 0 0 16px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">${rows}</table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/**
 * The members-only offer. A dashed frame around a monospace code, because the
 * one thing the recipient has to carry out of this email is a string they can
 * copy — everything else is a click.
 */
function promoBlock({ promoTitle, promoCode, promoNote }) {
  if (!promoCode) return '';
  return `
    <tr>
      <td style="padding:12px 32px 4px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
               style="border:2px dashed ${GREEN};border-radius:14px;background:#F3FAF6;">
          <tr>
            <td align="center" style="padding:20px 20px 18px;">
              ${promoTitle ? `<div style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${GREEN};padding-bottom:10px;">${escapeHtml(promoTitle)}</div>` : ''}
              <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:24px;font-weight:700;letter-spacing:2px;color:${INK};">${escapeHtml(promoCode)}</div>
              ${promoNote ? `<div style="font-size:13px;line-height:1.5;color:${MUTED};padding-top:10px;">${escapeHtml(promoNote)}</div>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function ctaBlock({ ctaLabel, ctaUrl }) {
  if (!ctaUrl || !ctaLabel) return '';
  const url = escapeHtml(ctaUrl);
  return `
    <tr>
      <td align="center" style="padding:26px 32px 6px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" bgcolor="${GREEN}" style="border-radius:9999px;">
              <a href="${url}" style="display:inline-block;padding:15px 38px;font-family:${FONT};font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:9999px;">${escapeHtml(ctaLabel)}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:12px 32px 0;font-size:12px;line-height:1.5;color:${MUTED};">
        Se il bottone non funziona, copia questo link:<br/>
        <a href="${url}" style="color:${MUTED};">${url}</a>
      </td>
    </tr>`;
}

/**
 * One recipient's copy of a campaign.
 *
 * `unsubscribeUrl` is required and unconditional — this mail is marketing, and
 * an opt-out the recipient cannot find is the whole reason a list gets marked
 * as spam. It is returned in the List-Unsubscribe headers too, so a Gmail or
 * Apple Mail reader can unsubscribe without opening the body.
 */
export function renderMarketingEmail({ campaign, facts, recipient = {}, unsubscribeUrl, siteUrl }) {
  const context = { firstName: recipient.firstName || '', lastName: recipient.lastName || '' };
  const fill = (value) => fillMarketingTemplate(value, context);

  const subject = fill(campaign.subject || '');
  const preheader = fill(campaign.preheader || '');
  const eyebrow = fill(campaign.eyebrow || '');
  const headline = fill(campaign.headline || '');
  const unsub = escapeHtml(unsubscribeUrl);

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeHtml(preheader)}&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:28px 12px 40px;font-family:${FONT};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
               style="width:100%;max-width:600px;background:${CARD};border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(10,12,15,0.10);">

          <!-- tricolore rule -->
          <tr>
            <td style="padding:0;font-size:0;line-height:0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr style="height:5px;">
                  <td width="33.33%" bgcolor="${GREEN}" style="height:5px;font-size:0;line-height:0;">&nbsp;</td>
                  <td width="33.33%" bgcolor="${PAPER}" style="height:5px;font-size:0;line-height:0;">&nbsp;</td>
                  <td width="33.34%" bgcolor="${RED}" style="height:5px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- masthead -->
          <tr>
            <td align="center" bgcolor="${INK}" style="padding:18px 24px;">
              <a href="${escapeHtml(siteUrl)}" style="font-size:13px;font-weight:700;letter-spacing:2.6px;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">Italian Tech Club</a>
              <div style="font-size:11px;letter-spacing:2.6px;text-transform:uppercase;color:#8A93A0;padding-top:4px;">New York Chapter</div>
            </td>
          </tr>

          ${posterBlock(facts)}

          <!-- copy -->
          <tr>
            <td style="padding:30px 32px 4px;">
              ${eyebrow ? `<div style="font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${RED};padding-bottom:10px;">${escapeHtml(eyebrow)}</div>` : ''}
              ${headline ? `<h1 style="margin:0 0 18px;font-size:27px;line-height:1.2;font-weight:800;color:${INK};letter-spacing:-0.5px;">${escapeHtml(headline)}</h1>` : ''}
              ${paragraphs(fill(campaign.body || ''))}
            </td>
          </tr>

          ${factsBlock(facts)}
          ${promoBlock(campaign)}
          ${ctaBlock(campaign)}

          ${campaign.signoff ? `
          <tr>
            <td style="padding:26px 32px 4px;font-size:16px;line-height:1.65;color:#1F2937;">${inlineMarkup(fill(campaign.signoff))}</td>
          </tr>` : ''}

          <!-- footer -->
          <tr>
            <td style="padding:28px 32px 30px;">
              <div style="border-top:1px solid ${BORDER};padding-top:18px;font-size:12px;line-height:1.7;color:${MUTED};">
                Ricevi questa email perché fai parte della community dell'Italian Tech Club di New York.<br/>
                <a href="${unsub}" style="color:${MUTED};text-decoration:underline;">Non voglio più ricevere email di marketing</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(siteUrl)}/community" style="color:${MUTED};text-decoration:underline;">La community</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(siteUrl)}/privacy" style="color:${MUTED};text-decoration:underline;">Privacy</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject,
    html,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}
