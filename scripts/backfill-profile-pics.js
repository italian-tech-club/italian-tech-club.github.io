/**
 * Fill in member profile photos at the best resolution actually obtainable.
 *
 * Sources, all requested at their maximum size:
 *  1. Gomry's stored contact photo — from the contact-update webhook payloads we
 *     already hold, plus an MCP sweep of the chapter list. Google account avatars
 *     (lh3.googleusercontent.com) arrive as `=s96-c` thumbnails and are rewritten
 *     to `=s1024-c`, which serves a genuine 1024x1024. Gomry's own uploads
 *     (storage.googleapis.com / firebasestorage) top out at 200-300px with no
 *     larger variant published.
 *  2. Gravatar by email hash, requested at s=1024.
 *
 * LinkedIn og:image is deliberately NOT a source: it serves a small
 * link-preview crop, throttles per IP with HTTP 999, and Giuseppe ruled it out.
 *
 * Every candidate is downloaded and measured, and the largest by pixel area wins
 * — so a 1024 Google avatar beats a 200px Gomry upload rather than whichever
 * happened to be tried first. Stored as base64 data URLs because the source
 * links are signed and expire.
 *
 * Two safety rules, both absolute:
 *  - a CLAIMED member's photo is never touched. They signed in; it's theirs.
 *  - a photo is only replaced by a STRICTLY LARGER one, so re-runs can't
 *    downgrade what a previous run found.
 *
 * Usage: MONGODB_URI + GOMRY_MCP_TOKEN set (or present in .env), then:
 *   npm run backfill:pics                 # fill profiles that have no photo
 *   npm run backfill:pics -- --upgrade    # also re-shoot unclaimed low-res photos
 *   npm run backfill:pics -- --dry        # report what it would do
 */
import 'dotenv/config';
import crypto from 'crypto';
import mongoose from 'mongoose';
import CommunityProfile from '../server/models/CommunityProfile.js';
import GomryWebhookEvent from '../server/models/GomryWebhookEvent.js';
import { listContactsWithImages } from '../server/utils/gomry.js';

const MAX_BYTES = 3_000_000; // a 1024x1024 JPEG lands ~270KB; this is only a sanity ceiling
const MIN_BYTES = 1000; // below this it's a placeholder pixel, not a face
const GRAVATAR_SIZE = 1024;
const GOOGLE_SIZE = 1024;

const flag = (name) => process.argv.includes(`--${name}`);

/**
 * Pixel dimensions from a JPEG or PNG buffer, without an image library.
 * Returns null when the format isn't recognised, which callers treat as
 * "unknown size" rather than an error.
 */
function dimensions(buffer) {
  // PNG: width/height are big-endian uint32 in the IHDR chunk.
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  // JPEG: walk the segment chain to a Start-Of-Frame marker.
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      // Any SOFn except the non-frame markers DHT (c4), DAC (cc) and RSTn (c8).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xcc && marker !== 0xc8) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }

  return null;
}

/** Ask Google for the full-size avatar instead of the thumbnail Gomry stored. */
function upgradeUrl(url) {
  if (!/googleusercontent\.com/.test(url)) return url;
  // Trailing size token looks like "=s96-c" or "=s96-c-k-no"; swap just the sNN.
  return /=s\d+/.test(url)
    ? url.replace(/=s\d+/, `=s${GOOGLE_SIZE}`)
    : `${url}=s${GOOGLE_SIZE}-c`;
}

/** Download one candidate and measure it. Returns null when unusable. */
async function fetchCandidate(url, label) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'follow' });
    if (!response.ok) return null;

    const type = (response.headers.get('content-type') || '').split(';')[0];
    if (!type.startsWith('image/')) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < MIN_BYTES || buffer.length > MAX_BYTES) return null;

    const size = dimensions(buffer);
    return {
      label,
      bytes: buffer.length,
      width: size?.width ?? 0,
      height: size?.height ?? 0,
      // Unknown dimensions fall back to byte count so such a candidate can still
      // rank, just never above one that measured.
      area: size ? size.width * size.height : buffer.length / 1000,
      dataUrl: `data:${type};base64,${buffer.toString('base64')}`,
    };
  } catch {
    return null;
  }
}

/** Measure an already-stored data URL so a replacement can be compared to it. */
function measureStored(profilePic) {
  if (typeof profilePic !== 'string') return null;
  const match = /^data:[^;]+;base64,(.*)$/.exec(profilePic);
  if (!match) return null;
  const buffer = Buffer.from(match[1], 'base64');
  const size = dimensions(buffer);
  return size ? { ...size, area: size.width * size.height } : null;
}

/**
 * Gomry photo URLs keyed by contact id and by email.
 *
 * Both are needed: the stored webhook payloads carry photos MCP's `get_contacts`
 * omits (a Google avatar showed up in a delivery while MCP reported null for the
 * same contact), and the MCP sweep covers contacts that never fired a webhook.
 */
async function gomryPhotoIndex() {
  const byContact = new Map();
  const byEmail = new Map();

  const deliveries = await GomryWebhookEvent.find({ channel: 'contact' }).select('payload').lean();
  for (const { payload } of deliveries) {
    if (!payload?.img) continue;
    if (payload.id) byContact.set(payload.id, payload.img);
    const email = (payload.userEmail || payload.email || '').toLowerCase();
    if (email) byEmail.set(email, payload.img);
  }
  console.log(`  ${byContact.size} photos from stored webhook deliveries`);

  try {
    const contacts = await listContactsWithImages();
    let added = 0;
    for (const contact of contacts) {
      if (contact.img && !byContact.has(contact.id)) { byContact.set(contact.id, contact.img); added += 1; }
    }
    console.log(`  ${added} more from the MCP chapter-list sweep`);
  } catch (error) {
    console.warn(`  ⚠ MCP sweep unavailable (${error.message}) — using deliveries only`);
  }

  return { byContact, byEmail };
}

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined');
    process.exit(1);
  }

  const upgrade = flag('upgrade');
  const dry = flag('dry');

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });

  console.log('Collecting Gomry photo URLs…');
  const photos = await gomryPhotoIndex();

  // A claimed member's photo is theirs; only ever consider the unclaimed.
  const query = upgrade
    ? { claimed: false }
    : { claimed: false, $or: [{ profilePic: null }, { profilePic: '' }] };

  const targets = await CommunityProfile.find(query)
    .select('firstName lastName email profilePic gomryContactId')
    .lean();

  console.log(`\n${targets.length} candidate profile(s) — ${upgrade ? 'filling empty + upgrading low-res' : 'filling empty only'}\n`);

  let filled = 0, upgraded = 0, kept = 0, none = 0;

  for (const profile of targets) {
    const name = `${profile.firstName} ${profile.lastName}`.trim();
    const existing = measureStored(profile.profilePic);
    const hasPhoto = Boolean(profile.profilePic);

    const sources = [];
    const gomryUrl = photos.byContact.get(profile.gomryContactId)
      || photos.byEmail.get((profile.email || '').toLowerCase());
    if (gomryUrl) sources.push([upgradeUrl(gomryUrl), /googleusercontent/.test(gomryUrl) ? 'google' : 'gomry']);
    const hash = crypto.createHash('sha256').update((profile.email || '').trim().toLowerCase()).digest('hex');
    sources.push([`https://gravatar.com/avatar/${hash}?d=404&s=${GRAVATAR_SIZE}`, 'gravatar']);

    const candidates = [];
    for (const [url, label] of sources) {
      const candidate = await fetchCandidate(url, label);
      if (candidate) candidates.push(candidate);
    }

    if (!candidates.length) {
      if (!hasPhoto) { none += 1; console.log(`  · ${name}: no photo available`); }
      else kept += 1;
      continue;
    }

    candidates.sort((a, b) => b.area - a.area);
    const best = candidates[0];
    const detail = `${best.label} ${best.width}x${best.height} (${Math.round(best.bytes / 1024)}KB)`;

    // Never downgrade: an existing photo is only replaced by a strictly larger one.
    if (existing && best.area <= existing.area) {
      kept += 1;
      console.log(`  = ${name}: kept ${existing.width}x${existing.height} (best offer ${detail})`);
      continue;
    }

    if (dry) {
      console.log(`  ${hasPhoto ? '↑' : '+'} ${name}: ${detail}${existing ? ` was ${existing.width}x${existing.height}` : ''}`);
      if (hasPhoto) upgraded += 1; else filled += 1;
      continue;
    }

    // Re-check claimed in the write: a member may have signed in and uploaded
    // while this run was working through the list.
    const result = await CommunityProfile.updateOne(
      { _id: profile._id, claimed: false },
      { $set: { profilePic: best.dataUrl } },
    );
    if (!result.modifiedCount) { kept += 1; continue; }

    if (hasPhoto) { upgraded += 1; console.log(`  ↑ ${name}: ${detail} was ${existing ? `${existing.width}x${existing.height}` : 'unmeasured'}`); }
    else { filled += 1; console.log(`  + ${name}: ${detail}`); }
  }

  console.log(`\n${dry ? '🔎 DRY RUN — no writes.' : '✅ Done.'}`);
  console.log(`  filled (was empty): ${filled}`);
  if (upgrade) console.log(`  upgraded to larger: ${upgraded}`);
  console.log(`  kept as-is:         ${kept}`);
  console.log(`  no source found:    ${none}`);

  await mongoose.disconnect();
}

run().catch((error) => {
  console.error('❌ Backfill failed:', error);
  process.exit(1);
});
