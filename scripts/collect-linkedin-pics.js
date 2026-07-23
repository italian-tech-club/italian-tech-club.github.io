/**
 * Semi-automated, human-in-the-loop LinkedIn profile-photo collector.
 *
 * Opens a REAL Chrome window you drive. You log in once (session persists in a
 * gitignored dir). The script walks every approved member missing a photo who
 * has a LinkedIn URL, navigating to each profile and auto-detecting the profile
 * photo. You confirm with Enter (or click a different image to override), and
 * it downloads the full-resolution original and saves it.
 *
 * You are the one browsing; the script only handles navigation + download.
 *
 * Per profile:
 *   Enter → accept the detected photo, save, next
 *   (click any image in the browser) → use that one instead
 *   s → skip this person
 *   o → reopen the current profile (if it didn't load)
 *   q → quit (progress saved as you go)
 *
 * Flags:
 *   --dry        list who would be processed, then exit (no browser)
 *   --all        every approved member with a LinkedIn URL (re-collect)
 *   --upgrade    members whose stored photo is below --min px (or an external
 *                hotlink), i.e. replace low-res pics with the 800px original
 *   --min=NNN    resolution threshold for --upgrade (default 800)
 *   --search     members with NO LinkedIn URL: opens a people-search so you
 *                find + verify them by hand and click their photo (also saves
 *                the profile URL when you land on their page)
 *   --custom     a hand-picked list via --names="A;B;C". The escape hatch for
 *                stubborn profiles: accept a click, OR a pasted image URL, OR a
 *                pasted local file path (screenshot → path). Backfills the URL
 *                if it learns one.
 *   --auto       accept the auto-detected photo without waiting for Enter —
 *                hands-free bulk upgrade (ignored in --search/--custom)
 *
 * Usage:  npm run collect:pics                 # fill missing photos (have URL)
 *         npm run collect:pics -- --upgrade --auto   # replace all low-res
 *         npm run collect:pics -- --search           # find the no-URL members
 *         npm run collect:pics -- --custom --names="Luigi Pepe;Harjeet Harpal"
 */
import 'dotenv/config';
import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { chromium } from 'playwright-core';
import CommunityProfile from '../server/models/CommunityProfile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = path.resolve(__dirname, '..', '.linkedin-session');
const DRY = process.argv.includes('--dry');
const INCLUDE_ALL = process.argv.includes('--all');
const UPGRADE = process.argv.includes('--upgrade');
const SEARCH = process.argv.includes('--search');
const CUSTOM = process.argv.includes('--custom');
const NAMES = (process.argv.find((a) => a.startsWith('--names=')) || '--names=').slice('--names='.length);
const AUTO = process.argv.includes('--auto');
const MIN_PX = Number((process.argv.find((a) => a.startsWith('--min=')) || '--min=800').split('=')[1]) || 800;
const MAX_BYTES = 8_000_000;
const MAX_TRIES = 4; // failed grabs on one person before auto-skip

// Bump a LinkedIn displayphoto URL to the largest standard render (800px).
const maxRes = (url) => url.replace(/displayphoto-(shrink|scale)_\d+_\d+/g, 'displayphoto-shrink_800_800');

// Width/height of a stored base64 image (PNG IHDR / JPEG SOF). Returns 0×0 for
// external URLs or unknown formats, so those count as "needs upgrade".
function storedDims(profilePic) {
  const m = (profilePic || '').match(/^data:[^;]+;base64,(.+)$/);
  if (!m) return { w: 0, h: 0 };
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let o = 2;
    while (o < buf.length) {
      if (buf[o] !== 0xFF) { o++; continue; }
      const mk = buf[o + 1];
      if (mk >= 0xC0 && mk <= 0xCF && mk !== 0xC4 && mk !== 0xC8 && mk !== 0xCC) return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7) };
      o += 2 + buf.readUInt16BE(o + 2);
    }
  }
  return { w: 0, h: 0 };
}

// Turn a grabbed src into raw image bytes. Handles data: URLs directly and
// http(s) via the browser's authenticated request context. Rejects anything
// that isn't actually an image (bad clicks, blob:, tracking pixels).
async function toImage(context, src) {
  if (src.startsWith('data:')) {
    const m = src.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!m) return { error: 'not an image data URL' };
    return { type: m[1], buf: Buffer.from(m[2], 'base64') };
  }
  if (!/^https?:\/\//.test(src)) return { error: `can't fetch ${src.slice(0, 24)}… (click the photo itself)` };
  const url = /media\.licdn\.com/.test(src) && /displayphoto-/.test(src) ? maxRes(src) : src;
  const resp = await context.request.get(url, { timeout: 20000 });
  const type = (resp.headers()['content-type'] || '').split(';')[0];
  if (!type.startsWith('image/')) return { error: `that wasn't an image (${type || 'unknown'})` };
  const buf = await resp.body();
  if (buf.length > MAX_BYTES) return { error: 'image too large' };
  return { type, buf };
}

// Read a local image file (for the --custom escape hatch: screenshot a photo,
// paste its path). Detects format from magic bytes.
function fileToImage(p) {
  let abs = p.trim().replace(/^['"]|['"]$/g, ''); // strip quotes from drag-drop
  if (abs.startsWith('~')) abs = path.join(os.homedir(), abs.slice(1));
  abs = path.resolve(abs);
  if (!fs.existsSync(abs)) return { error: `no file at ${abs}` };
  const buf = fs.readFileSync(abs);
  let type = null;
  if (buf[0] === 0x89 && buf[1] === 0x50) type = 'image/png';
  else if (buf[0] === 0xFF && buf[1] === 0xD8) type = 'image/jpeg';
  else if (buf.length > 12 && buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') type = 'image/webp';
  else if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) type = 'image/gif';
  if (!type) return { error: 'not a recognized image (png/jpg/webp/gif)' };
  if (buf.length > MAX_BYTES) return { error: 'image too large' };
  return { type, buf };
}

// Resolve typed input in --custom mode to image bytes: URL, data URL, or path.
async function inputToImage(context, raw) {
  if (/^https?:\/\//.test(raw) || raw.startsWith('data:')) return toImage(context, raw);
  return fileToImage(raw);
}

async function main() {
  if (!process.env.MONGODB_URI) { console.error('❌ MONGODB_URI is not defined'); process.exit(1); }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  let targets;
  let mode;
  if (CUSTOM) {
    // A hand-picked list (--names="A;B;C"). Escape hatch for the stubborn ones:
    // click, paste an image URL, or paste a local file path.
    // Split on ; , or newline; collapse internal whitespace so a name pasted
    // across a wrapped line ("Giuseppe\nGabriele") still matches.
    const norm = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase();
    const wanted = NAMES.split(/[;,\n]/).map(norm).filter(Boolean);
    if (!wanted.length) { console.error('❌ --custom needs --names="Name One;Name Two"'); await mongoose.disconnect(); process.exit(1); }
    mode = `--custom: ${wanted.length} named member(s) — click, paste URL, or paste file path`;
    const all = await CommunityProfile.find({ status: 'approved' }).select('firstName lastName linkedIn profilePic profession company');
    const nameOf = (t) => norm(`${t.firstName} ${t.lastName}`);
    // Prefer an exact full-name match; fall back to a contains match.
    const matched = wanted.map((w) => all.find((t) => nameOf(t) === w) || all.find((t) => nameOf(t).includes(w))).filter(Boolean);
    const seen = new Set();
    targets = matched.filter((t) => !seen.has(String(t._id)) && seen.add(String(t._id)));
    const misses = wanted.filter((w) => !all.some((t) => nameOf(t).includes(w)));
    if (misses.length) console.log(`  (no match for: ${misses.join(', ')})`);
  } else if (SEARCH) {
    // Members with NO usable LinkedIn URL — the ones the collector could never
    // visit. You search + verify identity + click their photo by hand.
    mode = 'SEARCH: members with no LinkedIn URL and no photo (find them by hand)';
    targets = await CommunityProfile.find({
      status: 'approved',
      $or: [{ profilePic: null }, { profilePic: '' }],
      $and: [{ $or: [{ linkedIn: null }, { linkedIn: '' }] }],
    }).select('firstName lastName linkedIn profilePic profession company');
  } else if (INCLUDE_ALL) {
    mode = '--all: every approved member with a LinkedIn URL';
    targets = await CommunityProfile.find({ status: 'approved', linkedIn: { $nin: [null, ''] } }).select('firstName lastName linkedIn profilePic');
  } else if (UPGRADE) {
    mode = `--upgrade: photos below ${MIN_PX}px (or external hotlinks), with a LinkedIn URL`;
    const withLI = await CommunityProfile.find({ status: 'approved', linkedIn: { $nin: [null, ''] } }).select('firstName lastName linkedIn profilePic');
    targets = withLI.filter((t) => {
      if (!t.profilePic) return true;
      const { w, h } = storedDims(t.profilePic);
      return Math.max(w, h) < MIN_PX; // external URLs → 0 → included
    });
  } else {
    mode = 'missing a photo, with a LinkedIn URL';
    targets = await CommunityProfile.find({ status: 'approved', linkedIn: { $nin: [null, ''] }, $or: [{ profilePic: null }, { profilePic: '' }] }).select('firstName lastName linkedIn profilePic');
  }

  console.log(`\n${targets.length} member(s) to process (${mode}):\n`);
  targets.forEach((t, i) => console.log(`  ${String(i + 1).padStart(2)}. ${t.firstName} ${t.lastName}${(SEARCH || CUSTOM) ? `  (${t.profession || '—'}${t.company ? ` · ${t.company}` : ''})${t.linkedIn ? `  ${t.linkedIn}` : ''}` : `  →  ${t.linkedIn}`}`));

  if (DRY) { console.log('\n(dry run — no browser opened)'); await mongoose.disconnect(); return; }
  if (!targets.length) { await mongoose.disconnect(); return; }

  fs.mkdirSync(SESSION_DIR, { recursive: true });
  console.log('\nLaunching Chrome… log in to LinkedIn in the window if prompted.\n');

  const context = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false, channel: 'chrome', viewport: { width: 1280, height: 900 },
  });
  const page = context.pages()[0] || await context.newPage();

  // Single decision channel: both a typed line and an image click resolve the
  // one pending waiter, then clear it. No per-call listeners → no leak.
  let pending = null;
  const settle = (value) => { if (pending) { const r = pending; pending = null; r(value); } };
  const nextDecision = () => new Promise((resolve) => { pending = resolve; });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('line', (line) => settle({ kind: 'cmd', cmd: line.trim().toLowerCase(), raw: line.trim() }));
  await context.exposeFunction('__itcGrab', (src) => settle({ kind: 'grab', src }));
  await context.addInitScript(() => {
    document.addEventListener('click', (e) => {
      const img = e.target?.closest?.('img');
      if (img && (img.currentSrc || img.src)) window.__itcGrab(img.currentSrc || img.src);
    }, true);
  });

  // Auto-detect the top-card profile photo. Waits for a real, fully-loaded
  // displayphoto image (LinkedIn lazy-loads it after first paint, so detecting
  // too early grabs a placeholder that fetches as text/plain). Picks the
  // largest loaded one and returns its rendered URL.
  const detectPhoto = async () => {
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    for (let attempt = 0; attempt < 4; attempt++) {
      const src = await page.evaluate(() => {
        const ok = (i) => i.complete && i.naturalWidth > 1
          && /media\.licdn\.com/.test(i.currentSrc || i.src || '')
          && /displayphoto/.test(i.currentSrc || i.src || '');
        const imgs = [...document.querySelectorAll('img')].filter(ok);
        if (!imgs.length) return null;
        imgs.sort((a, b) => b.naturalWidth - a.naturalWidth);
        return imgs[0].currentSrc || imgs[0].src;
      }).catch(() => null);
      if (src) return src;
      await page.waitForTimeout(1200); // let the photo finish loading
    }
    return null;
  };

  // Confirm login once. In --auto we can't stop for a typed Enter, so if the
  // session isn't logged in, wait for the URL to leave the login/authwall page
  // (you log in in the window) before proceeding.
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  if (/\/(login|authwall|checkpoint)/.test(page.url())) {
    if (AUTO) {
      console.log('→ Log in in the Chrome window — auto-collection starts once you reach the feed…');
      await page.waitForURL((url) => !/\/(login|authwall|checkpoint)/.test(url.toString()), { timeout: 300000 }).catch(() => {});
    } else {
      console.log('→ Log in in the Chrome window, then press Enter here.');
      await nextDecision();
    }
  }

  let saved = 0, skipped = 0;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];

    // CUSTOM mode: whatever it takes. Open a sensible starting point, then
    // accept a click, a pasted image URL, or a pasted local file path.
    if (CUSTOM) {
      const start = t.linkedIn || `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${t.firstName} ${t.lastName} ${t.company || ''}`.trim())}`;
      console.log(`\n[${i + 1}/${targets.length}] ${t.firstName} ${t.lastName}  (${t.profession || '—'}${t.company ? ` · ${t.company}` : ''})`);
      console.log('  click the photo · OR paste an image URL · OR paste a file path (e.g. a screenshot) · s skip · o reopen · q quit');
      try { await page.goto(start, { waitUntil: 'domcontentloaded', timeout: 30000 }); } catch { console.log('  (slow to load — o to retry)'); }

      let done = false;
      for (let tries = 0; !done && tries < MAX_TRIES + 6; tries++) {
        const d = await nextDecision();
        let img;
        if (d.kind === 'grab') {
          img = await toImage(context, d.src);
        } else {
          const raw = d.raw;
          const low = d.cmd;
          if (low === 'q') { console.log('  quitting.'); rl.close(); await context.close(); await mongoose.disconnect(); console.log(`\nDone. saved: ${saved} | skipped: ${skipped}`); return; }
          if (low === 's' || low === '') { console.log('  skipped.'); skipped++; done = true; break; }
          if (low === 'o') { await page.goto(start, { waitUntil: 'domcontentloaded' }).catch(() => {}); tries--; continue; }
          img = await inputToImage(context, raw); // URL / data: / file path
        }
        if (img.error) { console.log(`  ${img.error} — try again (click / paste URL / paste path), or s to skip.`); continue; }

        const set = { profilePic: `data:${img.type};base64,${img.buf.toString('base64')}` };
        const m = page.url().match(/https:\/\/[^/]*linkedin\.com\/in\/[^/?#]+/);
        if (m && !t.linkedIn) set.linkedIn = m[0]; // backfill URL if we learned it
        await CommunityProfile.updateOne({ _id: t._id }, { $set: set });
        saved++; done = true;
        console.log(`  ✓ saved (${Math.round(img.buf.length / 1024)}kb, ${img.type})${set.linkedIn ? `  +url ${set.linkedIn}` : ''}`);
      }
      if (!done) { console.log('  skipped.'); skipped++; }
      continue;
    }

    // SEARCH mode: no URL on file. Open a people-search for this member so you
    // can find + verify them and click their photo. Never auto (identity needs
    // a human), so fall through to the manual interaction loop below.
    if (SEARCH) {
      const kw = encodeURIComponent(`${t.firstName} ${t.lastName} ${t.company || ''}`.trim());
      const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${kw}`;
      console.log(`\n[${i + 1}/${targets.length}] ${t.firstName} ${t.lastName}  (${t.profession || '—'}${t.company ? ` · ${t.company}` : ''})`);
      console.log(`  searching… open the right person, then click their profile photo. (s skip · o re-search · q quit)`);
      try { await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }); } catch { console.log('  (slow to load — o to retry)'); }

      let done = false;
      for (let tries = 0; !done && tries < MAX_TRIES + 4; tries++) {
        const d = await nextDecision();
        if (d.kind === 'cmd') {
          if (d.cmd === 'q') { console.log('  quitting.'); rl.close(); await context.close(); await mongoose.disconnect(); console.log(`\nDone. saved: ${saved} | skipped: ${skipped}`); return; }
          if (d.cmd === 's' || d.cmd === '') { console.log('  skipped.'); skipped++; done = true; break; }
          if (d.cmd === 'o') { await page.goto(searchUrl, { waitUntil: 'domcontentloaded' }).catch(() => {}); tries--; continue; }
          console.log('  (click their photo · s=skip · o=re-search · q=quit)'); tries--; continue;
        }
        // Require being on the profile page: guarantees we grab the full-size
        // photo (not a search thumbnail) and capture the /in/ URL to save.
        const m = page.url().match(/https:\/\/[^/]*linkedin\.com\/in\/[^/?#]+/);
        if (!m) { console.log('  open their profile page first (click into the result), then click the big photo.'); continue; }
        const img = await toImage(context, d.src);
        if (img.error) { console.log(`  ${img.error} — click the profile photo, or s to skip.`); continue; }
        await CommunityProfile.updateOne({ _id: t._id }, { $set: {
          profilePic: `data:${img.type};base64,${img.buf.toString('base64')}`,
          linkedIn: m[0],
        } });
        saved++; done = true;
        console.log(`  ✓ saved (${Math.round(img.buf.length / 1024)}kb, ${img.type})  +url ${m[0]}`);
      }
      if (!done) { console.log('  skipped.'); skipped++; }
      continue;
    }

    console.log(`\n[${i + 1}/${targets.length}] ${t.firstName} ${t.lastName}\n  opening ${t.linkedIn}`);
    try {
      await page.goto(t.linkedIn, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch { console.log('  (slow to load — o to reopen, s to skip)'); }

    let candidate = await detectPhoto();

    // Hands-free: take the detected photo and move on (bulk low-res upgrade).
    if (AUTO) {
      let done = false;
      for (let attempt = 0; attempt < 3 && !done; attempt++) {
        if (attempt > 0) { await page.waitForTimeout(1500); candidate = await detectPhoto(); }
        if (!candidate) continue;
        const img = await toImage(context, candidate);
        if (img.error) { candidate = null; continue; }
        await CommunityProfile.updateOne({ _id: t._id }, { $set: { profilePic: `data:${img.type};base64,${img.buf.toString('base64')}` } });
        saved++; done = true;
        console.log(`  ✓ saved (${Math.round(img.buf.length / 1024)}kb, ${img.type})`);
      }
      if (!done) { console.log('  no usable photo (likely no public photo) — skipped.'); skipped++; }
      await page.waitForTimeout(600); // stay human-paced
      continue;
    }

    if (candidate) console.log('  detected a profile photo. Enter = save it, or click a different image. (s skip · o reopen · q quit)');
    else console.log('  no photo auto-detected — click the profile photo in the browser. (s skip · o reopen · q quit)');

    let done = false;
    for (let tries = 0; !done && tries < MAX_TRIES; tries++) {
      const d = await nextDecision();

      if (d.kind === 'cmd') {
        if (d.cmd === 'q') { console.log('  quitting.'); rl.close(); await context.close(); await mongoose.disconnect(); console.log(`\nDone. saved: ${saved} | skipped: ${skipped}`); return; }
        if (d.cmd === 's') { console.log('  skipped.'); skipped++; done = true; break; }
        if (d.cmd === 'o') { i--; done = true; break; }
        if (d.cmd !== '') { console.log('  (Enter=save · s=skip · o=reopen · q=quit)'); tries--; continue; }
        if (!candidate) { console.log('  nothing detected yet — click the photo, or s to skip.'); tries--; continue; }
      }

      const src = d.kind === 'grab' ? d.src : candidate;
      const img = await toImage(context, src);
      if (img.error) { console.log(`  ${img.error} — click the photo again, or s to skip.`); continue; }

      await CommunityProfile.updateOne({ _id: t._id }, { $set: { profilePic: `data:${img.type};base64,${img.buf.toString('base64')}` } });
      saved++; done = true;
      console.log(`  ✓ saved (${Math.round(img.buf.length / 1024)}kb, ${img.type})`);
    }
    if (!done) { console.log('  too many misses — skipped. Re-run later to retry.'); skipped++; }
  }

  console.log(`\nDone. saved: ${saved} | skipped: ${skipped}`);
  rl.close();
  await context.close();
  await mongoose.disconnect();
}

main().catch((err) => { console.error('❌ Collector failed:', err); process.exit(1); });
