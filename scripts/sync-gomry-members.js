/**
 * Sync approved New York applicants from Gomry into `community_profiles`.
 *
 * Being approved on the Gomry application form with hub "New York" *is* ITC NYC
 * membership. That verdict reached the directory exactly once, by hand, via
 * seed-community.js and itc-contacts.csv — so everyone approved since has been a
 * member with no profile. This script closes that gap and can keep it closed.
 *
 * Two effects per approved NYC applicant:
 *  1. upsert a community profile (idempotent on email, `$setOnInsert` so a
 *     member's own edits are never overwritten)
 *  2. put their contact on the Gomry "New York Chapter" list
 *
 * Step 2 goes through MCP because REST cannot write list membership, and MCP
 * tokens get revoked without notice — so it is best-effort and reported
 * separately. A dead token costs you the list, never the profiles.
 *
 * Runs standalone (backfill / reconcile) and is also the code path the
 * gomry-webhook route uses for a single live approval.
 *
 * Usage: MONGODB_URI + GOMRY_API_KEY set (GOMRY_MCP_TOKEN for the list), then:
 *   npm run sync:gomry -- --dry          # parse + report, no writes anywhere
 *   npm run sync:gomry                   # full reconcile
 *   npm run sync:gomry -- --since 2026-08-01T00:00:00Z
 *   npm run sync:gomry -- --skip-list    # profiles only
 *   npm run sync:gomry -- --enrich       # also fill fields left empty on unclaimed profiles
 *
 * Profile photos are not this script's job — run `npm run backfill:pics`.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import CommunityProfile from '../server/models/CommunityProfile.js';
import {
  listAcceptedApplications,
  isNycApplication,
  profileFromApplication,
  addContactsToNycList,
  NYC_HUB,
} from '../server/utils/gomry.js';

// Seeded as founders by seed-founders.js; must not be re-created here.
// Mirrors the allowlist in seed-community.js.
const ADMIN_EMAILS = new Set([
  'giuseppe.concialdi@gmail.com',
  'noemi.gozzi@gmail.com',
  'enrico.fontana1997@gmail.com',
  'michela@tarantino.email',
  'nicole.bizzini@gmail.com',
]);

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (process.argv[i + 1] ?? true);
};
const flag = (name) => process.argv.includes(`--${name}`);

/**
 * Create or refresh one member from an accepted application.
 *
 * `$setOnInsert` carries the profile content so a re-run only ever re-asserts
 * provenance — a member who has since edited their title or photo keeps it.
 * Returns null when the application can't identify a member.
 */
export async function upsertMemberFromApplication(application, { contact = null } = {}) {
  // `contact` only supplies the avatar, which lives on the contact record rather
  // than the submission. A missing photo renders as an initials avatar, so it is
  // never worth a failure — callers pass it when they already have it.
  const doc = profileFromApplication(application, contact);
  if (!doc) return null;
  if (ADMIN_EMAILS.has(doc.email)) return { email: doc.email, skipped: 'admin' };

  // Provenance is re-asserted on every run — cheap, and it back-fills the
  // profiles the original CSV seed created without it. It therefore belongs to
  // $set only: Mongo rejects an update naming the same path in two operators.
  const { email, seeded, gomryApplicationId, gomryContactId, ...content } = doc;
  const result = await CommunityProfile.updateOne(
    { email },
    {
      $setOnInsert: content,
      $set: { seeded, gomryApplicationId, gomryContactId },
    },
    { upsert: true },
  );

  return { email, created: result.upsertedCount > 0, status: content.status };
}

// Fields the sync may fill in later on a profile that never got them. Each entry
// says what counts as "still empty" — `profession` defaults to the placeholder
// "Member" when an application had no job title, which is as empty as ''.
const ENRICHABLE = {
  bio: (current) => !current,
  company: (current) => !current,
  linkedIn: (current) => !current,
  profession: (current) => !current || current === 'Member',
};

/**
 * Fill fields that are still empty on an already-created profile.
 *
 * Needed because content is written with `$setOnInsert`: a profile created before
 * a mapping existed (bios, originally) keeps the empty value forever otherwise.
 * Only touches UNCLAIMED profiles and only writes where the current value is
 * empty — a member's own text is never overwritten, and neither is anything a
 * previous run already filled.
 */
async function enrichProfile(application) {
  const doc = profileFromApplication(application);
  if (!doc || ADMIN_EMAILS.has(doc.email)) return null;

  const profile = await CommunityProfile.findOne({ email: doc.email, claimed: false })
    .select(Object.keys(ENRICHABLE).join(' '))
    .lean();
  if (!profile) return null;

  const updates = {};
  for (const [field, isEmpty] of Object.entries(ENRICHABLE)) {
    if (isEmpty(profile[field]) && doc[field]) updates[field] = doc[field];
  }
  if (!Object.keys(updates).length) return null;

  await CommunityProfile.updateOne({ _id: profile._id, claimed: false }, { $set: updates });
  return { email: doc.email, fields: Object.keys(updates) };
}

async function main() {
  const dry = flag('dry');

  if (!process.env.GOMRY_API_KEY) {
    console.error('❌ GOMRY_API_KEY is not set');
    process.exit(1);
  }
  if (!dry && !process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined');
    process.exit(1);
  }

  const since = arg('since');
  console.log(`Fetching accepted applications${since ? ` submitted after ${since}` : ''}…`);
  const accepted = await listAcceptedApplications({ submittedAfter: since });
  const nyc = accepted.filter(isNycApplication);
  console.log(`  ${accepted.length} accepted org-wide → ${nyc.length} for hub "${NYC_HUB}"\n`);

  if (dry) {
    let withoutEmail = 0;
    for (const application of nyc) {
      const doc = profileFromApplication(application);
      if (!doc) { withoutEmail += 1; continue; }
      const note = ADMIN_EMAILS.has(doc.email) ? ' [admin, skipped]' : '';
      console.log(`  ${doc.firstName} ${doc.lastName} <${doc.email}> [${doc.status}] ${doc.profession}${note}`);
    }
    console.log(`\n🔎 DRY RUN — no writes. ${nyc.length - withoutEmail} identifiable, ${withoutEmail} without an email.`);
    return;
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  console.log('✅ Connected to MongoDB\n');

  let created = 0, existing = 0, skipped = 0, unidentified = 0;
  for (const application of nyc) {
    // No avatar here on purpose: photos are `npm run backfill:pics`, which
    // already fills empty profilePic from LinkedIn og:image and Gravatar. The
    // webhook path does pass a contact, since its payload carries `img` free.
    const result = await upsertMemberFromApplication(application);
    if (!result) { unidentified += 1; continue; }
    if (result.skipped) { skipped += 1; continue; }
    if (result.created) {
      created += 1;
      console.log(`  + ${result.email} [${result.status}]`);
    } else {
      existing += 1;
    }
  }

  let enriched = 0;
  if (flag('enrich')) {
    for (const application of nyc) {
      const result = await enrichProfile(application);
      if (result) {
        enriched += 1;
        console.log(`  ~ ${result.email} ← ${result.fields.join(', ')}`);
      }
    }
  }

  // Best-effort, and last: a revoked MCP token must not cost us the profiles above.
  let listed = 0;
  let listError = null;
  if (!flag('skip-list')) {
    try {
      const response = await addContactsToNycList(nyc.map((a) => a.contact_id));
      listed = response.contactsUpdated ?? 0;
    } catch (error) {
      listError = error.message;
    }
  }

  console.log('\nDone.');
  console.log(`  profiles created:   ${created}`);
  console.log(`  already present:    ${existing}`);
  console.log(`  skipped (admins):   ${skipped}`);
  if (flag('enrich')) console.log(`  enriched (empty):   ${enriched}`);
  if (unidentified) console.log(`  no email on file:   ${unidentified}`);
  if (flag('skip-list')) {
    console.log('  chapter list:       skipped (--skip-list)');
  } else if (listError) {
    console.log(`  chapter list:       ⚠ failed — ${listError}`);
    console.log('                      profiles are fine; re-run once GOMRY_MCP_TOKEN is valid.');
  } else {
    console.log(`  added to NY list:   ${listed}`);
  }

  await mongoose.disconnect();
}

// Only run as a CLI — the webhook route imports upsertMemberFromApplication.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  });
}
