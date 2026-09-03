/**
 * Turning whatever an admin has in hand into a member's profile photo.
 *
 * The photo problem this solves: Gomry's stored contact avatar is a 200-300px
 * upload or a Google thumbnail, and plenty of members arrive with nothing at
 * all. The fix has always been the real photo on their LinkedIn page — but
 * LinkedIn cannot be read from a server (www.linkedin.com answers a scraper with
 * HTTP 999, and its og:image is a small link-preview crop that Giuseppe ruled
 * out as a source), so a human has to be the one looking at the page. That is
 * what `scripts/collect-linkedin-pics.js` automates with a real Chrome window.
 *
 * This module is the same idea reduced to one paste. The admin is already
 * looking at the profile; they copy the image (or drag it out of the tab, which
 * hands over its `media.licdn.com` URL) and the bytes arrive here — either
 * inline as a data URL the browser already compressed, or as a URL this fetches.
 * media.licdn.com serves those renders without a LinkedIn session, which is why
 * the URL path works where reading the profile page does not.
 *
 * Deliberately free of mongoose so both the express route and the Vercel
 * function can import it.
 */

// Comfortably under Vercel's 4.5MB request-body cap, and far above what the
// browser's own 800px JPEG re-encode produces (~100-250KB).
const MAX_PHOTO_BYTES = 3_000_000;
const MIN_PHOTO_BYTES = 500; // below this it's a tracking pixel, not a face
const FETCH_TIMEOUT_MS = 20000;

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

// Hosts that would make an admin-supplied URL a way to read this server's own
// network. The panel is admin-only, so this guards against a mis-paste rather
// than an attacker, and a hostname check is the right weight for that.
const BLOCKED_HOST = /^(localhost$|.*\.local$|\[?::1\]?$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i;

/** Bump a LinkedIn displayphoto URL to the largest standard render (800px). */
const maxRes = (url) => url.replace(/displayphoto-(shrink|scale)_\d+_\d+/g, 'displayphoto-shrink_800_800');

/**
 * Validate a client-supplied `data:` URL. The browser has already downscaled and
 * re-encoded the image, so this only has to agree that it is one.
 */
function fromDataUrl(value) {
  const match = /^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(value.trim());
  if (!match) throw new Error('That does not look like an image.');

  const [, type, base64] = match;
  if (!ALLOWED_TYPES.has(type)) throw new Error(`Unsupported image type (${type}).`);

  // 4 base64 characters carry 3 bytes; close enough to size the payload without
  // decoding megabytes just to measure them.
  const bytes = Math.floor((base64.length * 3) / 4);
  if (bytes < MIN_PHOTO_BYTES) throw new Error('That image is too small to be a photo.');
  if (bytes > MAX_PHOTO_BYTES) throw new Error('That image is too large — under 3MB, please.');

  return `data:${type};base64,${base64}`;
}

/**
 * Download an image URL and store it as a data URL.
 *
 * Stored inline rather than hotlinked because these links are signed and expire
 * — a member card pointing at a LinkedIn CDN URL is a broken image in a month.
 */
async function fromImageUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error('That is not a valid URL.');
  }

  if (url.protocol !== 'https:') throw new Error('Image URLs must be https.');
  if (BLOCKED_HOST.test(url.hostname)) throw new Error('That host is not allowed.');

  if (/media\.licdn\.com/.test(url.hostname) && /displayphoto-/.test(url.pathname)) {
    url = new URL(maxRes(url.toString()));
  }

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: 'follow' });
  } catch {
    throw new Error('Could not download that image — copy the image itself and paste it instead.');
  }

  // LinkedIn answers a scraped *page* with 999; the CDN does not, but say
  // something useful if the distinction ever stops holding.
  if (!response.ok) {
    throw new Error(`The image host refused (HTTP ${response.status}) — copy the image itself and paste it instead.`);
  }

  const type = (response.headers.get('content-type') || '').split(';')[0].trim();
  if (!ALLOWED_TYPES.has(type)) {
    throw new Error(`That link is not an image (${type || 'unknown type'}) — right-click the photo and copy the image.`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < MIN_PHOTO_BYTES) throw new Error('That image is too small to be a photo.');
  if (buffer.length > MAX_PHOTO_BYTES) throw new Error('That image is too large — under 3MB, please.');

  return `data:${type};base64,${buffer.toString('base64')}`;
}

/**
 * Resolve whichever photo field a request carried into a storable data URL, or
 * null when it carried none.
 *
 * Throws with a message written for the admin looking at the panel, so callers
 * can hand `error.message` straight back as a 400.
 */
export async function resolveProfilePhoto({ profilePic, profilePicUrl } = {}) {
  if (typeof profilePic === 'string' && profilePic.trim()) return fromDataUrl(profilePic);
  if (typeof profilePicUrl === 'string' && profilePicUrl.trim()) return fromImageUrl(profilePicUrl);
  return null;
}

/**
 * The fields to write alongside a replaced photo.
 *
 * `cardImage` is a pre-rendered JPEG of the member's shareable card with the old
 * photo baked in, and social crawlers don't run JS, so leaving it in place would
 * keep serving the wrong face. Clearing both it and its key drops /m/<slug> back
 * to the generic preview until the member's next visit re-renders the card.
 */
export const photoUpdate = (dataUrl) => ({
  profilePic: dataUrl,
  cardImage: null,
  cardImageKey: null,
});
