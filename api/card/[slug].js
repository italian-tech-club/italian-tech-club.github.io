import mongoose from 'mongoose';

/**
 * GET /m/<slug>  (rewritten here in vercel.json)
 *
 * Serves the normal SPA document with this member's title, description and
 * Open Graph tags swapped in. It exists because the app is a client-rendered
 * Vite bundle and social crawlers do not run JavaScript — LinkedIn reads the
 * HTML it is handed and nothing else, so a shared card link would otherwise
 * preview as the generic club banner.
 *
 * Everyone (crawler or browser) gets the same document. The only difference
 * from a normal page load is the head.
 */

let cachedConnection = null;

async function connectDB() {
  if (cachedConnection) return cachedConnection;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not defined');
  cachedConnection = await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  return cachedConnection;
}

// Lean mirror of server/models/CommunityProfile.js — this function only ever
// reads the handful of fields that appear in a link preview.
const cardProfileSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  profession: String,
  company: String,
  cardSlug: String,
  memberNumber: Number,
  status: String,
}, { collection: 'community_profiles', strict: false });

const CommunityProfile = mongoose.models.CommunityProfile
  || mongoose.model('CommunityProfile', cardProfileSchema);

const SITE_URL = process.env.SITE_URL || 'https://italiantechclubnyc.com';

// The built index.html is immutable for the life of a deployment, so one fetch
// per cold start is enough.
let cachedShell = null;

async function loadShell(req) {
  if (cachedShell) return cachedShell;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const response = await fetch(`${proto}://${host}/index.html`);
  if (!response.ok) throw new Error(`Could not load app shell: ${response.status}`);
  cachedShell = await response.text();
  return cachedShell;
}

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Drop the site-wide social tags so the per-member ones are unambiguous —
// crawlers pick the first og:title they find, not the last.
function stripSiteMeta(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+property="og:[^>]*>\s*/gi, '')
    .replace(/<meta\s+property="twitter:[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '');
}

function memberMeta(profile) {
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  const number = String(profile.memberNumber ?? '').padStart(3, '0');
  const role = [profile.profession, profile.company].filter(Boolean).join(' · ');
  return {
    url: `${SITE_URL}/m/${profile.cardSlug}`,
    image: `${SITE_URL}/m/${profile.cardSlug}/card.jpg`,
    title: `${name} — Member ${number}, Italian Tech Club`,
    description: role
      ? `${role}. Member ${number} of the Italian Tech Club, New York chapter.`
      : `Member ${number} of the Italian Tech Club, New York chapter.`,
    alt: `Membership card for ${name}, member ${number} of the Italian Tech Club`,
  };
}

const FALLBACK_META = {
  url: `${SITE_URL}/community`,
  image: `${SITE_URL}/og-image.png`,
  title: 'Member record — Italian Tech Club',
  description: 'The community for Italian tech professionals, founders, and investors in New York City.',
  alt: 'Italian Tech Club NYC',
};

function headTags(meta) {
  return `
    <title>${escapeHtml(meta.title)}</title>
    <meta name="description" content="${escapeHtml(meta.description)}" />
    <link rel="canonical" href="${escapeHtml(meta.url)}" />
    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="Italian Tech Club NYC" />
    <meta property="og:url" content="${escapeHtml(meta.url)}" />
    <meta property="og:title" content="${escapeHtml(meta.title)}" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" />
    <meta property="og:image" content="${escapeHtml(meta.image)}" />
    <meta property="og:image:width" content="2400" />
    <meta property="og:image:height" content="1260" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:alt" content="${escapeHtml(meta.alt)}" />
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${escapeHtml(meta.url)}" />
    <meta property="twitter:title" content="${escapeHtml(meta.title)}" />
    <meta property="twitter:description" content="${escapeHtml(meta.description)}" />
    <meta property="twitter:image" content="${escapeHtml(meta.image)}" />
  `;
}

export default async function handler(req, res) {
  try {
    const slug = String(req.query.slug || '').trim().toLowerCase();
    const shell = await loadShell(req);

    let profile = null;
    if (slug) {
      await connectDB();
      profile = await CommunityProfile.findOne({ cardSlug: slug, status: 'approved' })
        .select('firstName lastName profession company cardSlug memberNumber')
        .lean();
    }

    const meta = profile ? memberMeta(profile) : FALLBACK_META;
    const html = stripSiteMeta(shell).replace('</head>', `${headTags(meta)}</head>`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
    return res.status(profile ? 200 : 404).send(html);
  } catch (error) {
    console.error('Card shell error:', error);
    // Never leave the visitor with a blank page: hand back the plain app and
    // let the client-side route render whatever it can.
    try {
      const shell = await loadShell(req);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(shell);
    } catch {
      return res.status(500).send('Something went wrong.');
    }
  }
}
