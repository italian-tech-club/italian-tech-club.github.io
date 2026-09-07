/**
 * Serve an event poster as a real image at a real URL.
 *
 * Posters are stored as base64 data URLs, which browsers render inline happily
 * and email clients do not render at all — Gmail and Outlook drop a data: src
 * on the floor. So marketing mail can only show a poster if there is an https
 * URL for it, and this is it: /e/<id>/poster.jpg (rewritten to the events API).
 *
 * Pure response writing, no mongoose — the Vercel function keeps its own copy
 * of the Event schema and passes the stored string in.
 */

const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i;

/**
 * Write the poster to `res`. A stored data URL is decoded and streamed; a repo
 * path or external URL is redirected to, since it is already fetchable.
 * Returns false when there is nothing to serve, leaving the response untouched.
 */
export function sendEventPoster(res, poster, siteUrl) {
  const value = String(poster || '').trim();
  if (!value) return false;

  const match = value.match(DATA_URL_RE);
  if (!match) {
    const target = value.startsWith('http') ? value : `${siteUrl}${value.startsWith('/') ? '' : '/'}${value}`;
    res.setHeader('Location', target);
    res.status(302).end();
    return true;
  }

  const [, contentType, base64] = match;
  const body = Buffer.from(base64, 'base64');
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', body.length);
  // Long shared-cache life: a poster is replaced by editing the event, which is
  // rare, and an email that renders it may sit in an inbox for weeks.
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=604800, stale-while-revalidate=604800');
  res.status(200).send(body);
  return true;
}
