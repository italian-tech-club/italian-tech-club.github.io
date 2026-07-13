/**
 * Seed the historical member roster (itc-contacts.csv) into the
 * `community_profiles` collection so existing members can claim their profile
 * via the /community/manage magic-link flow (using the email on file, or by
 * requesting a different email that an admin approves).
 *
 * Rules:
 *  - Admin/founder emails (api/admin/auth.js allowlist) are skipped — they are
 *    seeded separately by seed-founders.js.
 *  - GDPR "Non accetto" (did not consent) → status 'unclaimed' (hidden from the
 *    public directory until they claim, which records consent).
 *  - Everyone else → status 'approved' (public), gdprConsent true.
 *  - linkedIn / profilePic are optional here; members fill/replace them on claim.
 *
 * Idempotent — upserts on email. Profile content is only written on first insert
 * ($setOnInsert), so re-running never clobbers a member's own edits; it just
 * re-asserts the `seeded` marker.
 *
 * Usage: MONGODB_URI must be set (or present in .env), then:
 *   npm run seed:community
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import CommunityProfile from '../server/models/CommunityProfile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.resolve(__dirname, '..', 'itc-contacts.csv');

// Emails that must NOT be imported here (seeded as founders/admins elsewhere).
const ADMIN_EMAILS = new Set([
  'giuseppe.concialdi@gmail.com',
  'noemi.gozzi@gmail.com',
  'enrico.fontana1997@gmail.com',
  'michela@tarantino.email',
  'nicole.bizzini@gmail.com',
]);

/**
 * Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas,
 * embedded newlines, and "" escaped quotes. Returns an array of row arrays.
 */
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
  // trailing field/row (no final newline)
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

const clean = (v) => (v == null ? '' : v.trim());
const truncate = (v, n) => (v.length > n ? v.slice(0, n).trim() : v);

function normalizeLinkedIn(raw) {
  let v = clean(raw);
  if (!v) return '';
  // Strip stray non-url trailing characters seen in the export (e.g. "●").
  v = v.replace(/[^\x21-\x7e]+$/g, '').trim();
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  return v;
}

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined');
    process.exit(1);
  }

  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsv(raw);
  const header = rows.shift();

  // Resolve column indices by header name (robust to column reordering).
  const col = (name) => {
    const idx = header.findIndex((h) => clean(h).toLowerCase() === name.toLowerCase());
    if (idx === -1) throw new Error(`CSV column not found: ${name}`);
    return idx;
  };
  const C = {
    nome: col('Nome'),
    cognome: col('Cognome'),
    email: col('Email'),
    linkedIn: col('LinkedIn'),
    profession: col('Titolo professionale'),
    company: col('Azienda'),
    img: col('img'),
    gdpr: col('GDPR'),
  };

  const DRY = process.argv.includes('--dry');

  if (!DRY) {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    console.log('✅ Connected to MongoDB');
  } else {
    console.log('🔎 DRY RUN — parsing only, no DB writes\n');
  }

  let created = 0, updated = 0, skippedAdmin = 0, skippedNoEmail = 0, hidden = 0, published = 0;

  for (const r of rows) {
    if (!r.length || r.every((c) => clean(c) === '')) continue; // blank line

    const email = clean(r[C.email]).toLowerCase();
    const firstName = clean(r[C.nome]);
    const lastName = clean(r[C.cognome]);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skippedNoEmail++; continue; }
    if (ADMIN_EMAILS.has(email)) { skippedAdmin++; continue; }

    const consented = clean(r[C.gdpr]).toLowerCase() !== 'non accetto';
    const status = consented ? 'approved' : 'unclaimed';
    if (consented) published++; else hidden++;

    const doc = {
      firstName: truncate(firstName, 50) || 'Member',
      lastName: truncate(lastName, 50) || ' ',
      linkedIn: normalizeLinkedIn(r[C.linkedIn]),
      profilePic: clean(r[C.img]).startsWith('http') ? clean(r[C.img]) : null,
      profession: truncate(clean(r[C.profession]), 100),
      company: truncate(clean(r[C.company]), 100),
      bio: '',
      isFounder: false,
      status,
      gdprConsent: consented,
      emailVerified: false,
      claimed: false,
    };

    if (DRY) {
      created++;
      console.log(`  + ${doc.firstName} ${doc.lastName} <${email}> [${status}] ${doc.profession || '(no profession)'}${doc.linkedIn ? '' : ' (no LinkedIn)'}${doc.profilePic ? ' 📷' : ''}`);
      continue;
    }

    const result = await CommunityProfile.updateOne(
      { email },
      { $setOnInsert: doc, $set: { seeded: true } },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      created++;
      console.log(`  + ${firstName} ${lastName} <${email}> [${status}]`);
    } else {
      updated++;
    }
  }

  const total = DRY ? 0 : await CommunityProfile.countDocuments({ seeded: true });
  console.log('\nDone.');
  console.log(`  created:        ${created}`);
  console.log(`  already there:  ${updated}`);
  console.log(`  published:      ${published} (this run)`);
  console.log(`  hidden (GDPR):  ${hidden} (this run)`);
  console.log(`  skipped admins: ${skippedAdmin}`);
  console.log(`  skipped (bad email): ${skippedNoEmail}`);
  if (!DRY) console.log(`  seeded profiles in collection: ${total}`);

  if (!DRY) await mongoose.disconnect();
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
