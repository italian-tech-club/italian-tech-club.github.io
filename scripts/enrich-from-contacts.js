/**
 * Enrich seeded community profiles with the new signal fields, inferred from
 * itc-contacts.csv (the same export seed-community.js imported from):
 *
 *  - roles       ← "Titolo professionale" + "Posizione" + "Area di expertise"
 *                  (keyword rules; conservative — no match means left empty
 *                  for the member to self-select)
 *  - lookingFor  ← "Motivazione" (only explicit mentions: cofounder, hiring)
 *  - bio         ← "Talento Speciale" (the member's own words), only when the
 *                  profile bio is empty
 *
 * Never overwrites: a field is only filled when it is currently empty, so
 * members who already edited their profile keep their edits. Idempotent.
 *
 * Usage:
 *   node scripts/enrich-from-contacts.js --dry   # report only, no writes
 *   node scripts/enrich-from-contacts.js         # apply
 *   node scripts/enrich-from-contacts.js --no-bio  # apply roles/lookingFor only
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import CommunityProfile from '../server/models/CommunityProfile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.resolve(__dirname, '..', 'itc-contacts.csv');

const DRY = process.argv.includes('--dry');
const SKIP_BIO = process.argv.includes('--no-bio');

// Same minimal RFC-4180-ish parser as seed-community.js
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += c; i += 1; continue;
    }
    if (c === '"') { inQuotes = true; i += 1; continue; }
    if (c === ',') { row.push(field); field = ''; i += 1; continue; }
    if (c === '\r') { i += 1; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; continue; }
    field += c; i += 1;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

const clean = (v) => (v == null ? '' : v.trim());

// ---- inference rules ----

function inferRoles({ profession, position, expertise }) {
  const title = `${profession} ${position}`.toLowerCase();
  const exp = expertise.toLowerCase();
  const roles = new Set();

  if (/\bfound|foundatore|\bceo\b/.test(title)) roles.add('founder');
  // "invest(or|ing|...)" with suffix so "investigator" doesn't match
  if (/invest(or|ing|ment|imenti)|venture|angel\b|\bvc\b|managing partner/.test(title) || /investments/.test(exp)) roles.add('investor');
  if (/engineer|developer|\bcto\b|software|programm/.test(title) || /software development/.test(exp)) roles.add('engineer');
  if (/research|phd|professor|postdoc|scientist|dottorato/.test(title)) roles.add('researcher');

  return [...roles];
}

function inferLookingFor({ motivation }) {
  const m = motivation.toLowerCase();
  const looking = new Set();
  if (/co-?founder|co-?fondatore/.test(m)) looking.add('cofounder');
  if (/find the best talent|hiring|cerco talent|assumere/.test(m)) looking.add('hiring');
  return [...looking];
}

function buildBio({ talent }) {
  const t = clean(talent);
  // Skip throwaway answers — too short to stand as a public bio.
  if (t.length < 40) return '';
  return t.length > 500 ? `${t.slice(0, 497).trim()}...` : t;
}

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined');
    process.exit(1);
  }

  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsv(raw);
  const header = rows.shift();
  const col = (name) => {
    const idx = header.findIndex((h) => clean(h).toLowerCase() === name.toLowerCase());
    if (idx === -1) throw new Error(`CSV column not found: ${name}`);
    return idx;
  };
  const C = {
    email: col('Email'),
    profession: col('Titolo professionale'),
    position: col('Posizione'),
    expertise: col('Area di expertise'),
    talent: col('Talento Speciale'),
    motivation: col('Motivazione'),
  };

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });

  console.log(DRY ? '🔎 DRY RUN — no DB writes\n' : '✍️  Applying enrichment\n');

  let matched = 0, changed = 0, unmatchedCsv = 0, untouched = 0;

  for (const r of rows) {
    if (!r.length || r.every((c) => clean(c) === '')) continue;
    const email = clean(r[C.email]).toLowerCase();
    if (!email) continue;

    const profile = await CommunityProfile.findOne({ email });
    if (!profile) { unmatchedCsv++; continue; }
    matched++;

    const source = {
      profession: clean(r[C.profession]),
      position: clean(r[C.position]),
      expertise: clean(r[C.expertise]),
      talent: clean(r[C.talent]),
      motivation: clean(r[C.motivation]),
    };

    const updates = {};
    if (!profile.roles?.length) {
      const roles = inferRoles(source);
      if (roles.length) updates.roles = roles;
    }
    if (!profile.lookingFor?.length) {
      const looking = inferLookingFor(source);
      if (looking.length) updates.lookingFor = looking;
    }
    if (!SKIP_BIO && !clean(profile.bio)) {
      const bio = buildBio(source);
      if (bio) updates.bio = bio;
    }

    if (!Object.keys(updates).length) { untouched++; continue; }
    changed++;

    const summary = [
      updates.roles ? `roles=[${updates.roles.join(',')}]` : null,
      updates.lookingFor ? `lookingFor=[${updates.lookingFor.join(',')}]` : null,
      updates.bio ? `bio="${updates.bio.slice(0, 60)}${updates.bio.length > 60 ? '...' : ''}"` : null,
    ].filter(Boolean).join('  ');
    console.log(`  ${profile.firstName} ${profile.lastName} <${email}>\n      ${summary}`);

    if (!DRY) {
      Object.assign(profile, updates);
      await profile.save();
    }
  }

  console.log(`\n${DRY ? 'Would change' : 'Changed'}: ${changed}  |  matched in DB: ${matched}  |  already set/nothing to add: ${untouched}  |  CSV rows with no DB profile: ${unmatchedCsv}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌ Enrichment failed:', err);
  process.exit(1);
});
