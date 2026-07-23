/**
 * Backfill missing profile photos for approved members from public sources:
 *  1. LinkedIn og:image — the public link-preview image LinkedIn serves
 *     anonymously for profiles with public visibility on. Throttled per IP
 *     (HTTP 999); profiles that throttle or authwall are skipped, so re-run
 *     after a few hours to pick up the rest.
 *  2. Gravatar by email hash — member-chosen public avatars.
 *
 * Images are downloaded and stored as base64 data URLs (licdn links are
 * signed and expire). Only fills EMPTY profilePic — never overwrites a photo
 * a member uploaded. Idempotent; safe to re-run any time.
 *
 * Usage: MONGODB_URI must be set (or present in .env), then:
 *   npm run backfill:pics
 */
import 'dotenv/config';
import crypto from 'crypto';
import mongoose from 'mongoose';
import CommunityProfile from '../server/models/CommunityProfile.js';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchImageAsDataUrl(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/')) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000 || buf.length > 2_000_000) return null; // not a placeholder pixel, not huge
  return `data:${type.split(';')[0]};base64,${buf.toString('base64')}`;
}

async function linkedInPhoto(profileUrl) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(profileUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
      if (res.status === 999) { await sleep(4000 * attempt); continue; } // throttled — brief backoff, else give up till next run
      if (res.status !== 200 || /authwall/i.test(res.url)) return { skip: res.status === 200 ? 'authwall' : `HTTP ${res.status}` };
      const html = await res.text();
      const m = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
        || html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i);
      const imgUrl = m && m[1].replace(/&amp;/g, '&');
      // og:image that isn't media.licdn.com is LinkedIn's generic banner, not a photo
      if (!imgUrl || !/media\.licdn\.com/.test(imgUrl)) return { skip: 'no public photo' };
      const dataUrl = await fetchImageAsDataUrl(imgUrl);
      return dataUrl ? { dataUrl } : { skip: 'image download failed' };
    } catch (e) {
      return { skip: `fetch failed: ${e.message}` };
    }
  }
  return { skip: 'throttled (HTTP 999) — re-run in a few hours' };
}

async function gravatarPhoto(email) {
  const hash = crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  return fetchImageAsDataUrl(`https://gravatar.com/avatar/${hash}?d=404&s=400`);
}

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });

  const targets = await CommunityProfile.find({
    status: 'approved',
    $or: [{ profilePic: null }, { profilePic: '' }],
  }).select('firstName lastName email linkedIn');

  console.log(`profiles missing a photo: ${targets.length}\n`);
  let viaLinkedIn = 0, viaGravatar = 0, throttled = 0, skipped = 0;

  for (const p of targets) {
    const name = `${p.firstName} ${p.lastName}`;
    let dataUrl = null;
    let source = '';

    if (p.linkedIn) {
      const r = await linkedInPhoto(p.linkedIn);
      if (r.dataUrl) { dataUrl = r.dataUrl; source = 'linkedin'; }
      else {
        if (/throttled/.test(r.skip)) throttled++;
        console.log(`  · ${name}: ${r.skip}`);
      }
      await sleep(2000); // stay polite — hammering just extends the throttle
    }

    if (!dataUrl) {
      dataUrl = await gravatarPhoto(p.email);
      if (dataUrl) source = 'gravatar';
    }

    if (dataUrl) {
      // Guard again in the update — someone may have uploaded meanwhile
      await CommunityProfile.updateOne(
        { _id: p._id, $or: [{ profilePic: null }, { profilePic: '' }] },
        { $set: { profilePic: dataUrl } },
      );
      if (source === 'linkedin') viaLinkedIn++; else viaGravatar++;
      console.log(`  ✓ ${name} ← ${source}`);
    } else if (!p.linkedIn) {
      skipped++;
    }
  }

  console.log(`\n✅ linkedin: ${viaLinkedIn} | gravatar: ${viaGravatar} | throttled (retry later): ${throttled} | no source: ${skipped}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});
