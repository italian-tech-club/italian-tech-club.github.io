/**
 * Set up the "Il Posto Fisso" standing series in MongoDB.
 *
 * Two things happen:
 *   1. The series document (the recurrence rule) is upserted from events.json.
 *   2. The All'Antico Vinaio nights we already ran are tagged into the series,
 *      so their existing posters and photos show up on the series card. Their own
 *      Past Events cards are untouched.
 *
 * Dry run by default — nothing is written until you pass --apply:
 *   npm run seed:posto-fisso            # show what would change
 *   npm run seed:posto-fisso -- --apply # write it
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import Event from '../server/models/Event.js';

const SERIES_SLUG = 'posto-fisso';
// Straight and curly apostrophes both appear in the existing titles.
const EDITION_TITLE = /antico\s*vinaio/i;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const eventsPath = path.join(__dirname, '../src/data/events.json');

const apply = process.argv.includes('--apply');

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined');
    process.exit(1);
  }

  const seriesDoc = JSON.parse(readFileSync(eventsPath, 'utf8'))
    .find((event) => event.series === SERIES_SLUG && event.recurrence);

  if (!seriesDoc) {
    console.error(`❌ No "${SERIES_SLUG}" series entry with a recurrence rule in events.json`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  console.log(`✅ Connected${apply ? '' : ' — DRY RUN, nothing will be written'}\n`);

  const existing = await Event.findOne({ date: seriesDoc.date, title: seriesDoc.title }).lean();
  console.log(`Series document: ${seriesDoc.date} — ${seriesDoc.title}`);
  console.log(`  ${existing ? '~ already present, will update the rule' : '+ will be created'}`);
  console.log(`  every ${seriesDoc.recurrence.interval} weeks from ${seriesDoc.recurrence.startDate}`);

  const editions = await Event.find({ title: EDITION_TITLE, recurrence: null }).lean();
  console.log(`\nNights to tag as "${SERIES_SLUG}" (${editions.length}):`);
  editions.forEach((edition) => {
    const already = edition.series === SERIES_SLUG ? ' [already tagged]' : '';
    console.log(`  ${edition.date} — ${edition.title} (${edition.gallery?.length || 0} photos)${already}`);
  });

  if (editions.length === 0) {
    console.log('  none matched — check the titles in the admin panel');
  }

  if (!apply) {
    console.log('\nRe-run with --apply to write these changes.');
    await mongoose.disconnect();
    return;
  }

  await Event.updateOne(
    { date: seriesDoc.date, title: seriesDoc.title },
    {
      $set: {
        subtitle: seriesDoc.subtitle ?? '',
        location: seriesDoc.location,
        time: seriesDoc.time ?? null,
        type: seriesDoc.type,
        link: seriesDoc.link ?? null,
        poster: seriesDoc.poster ?? null,
        recurrence: seriesDoc.recurrence,
        series: SERIES_SLUG,
      },
    },
    { upsert: true, runValidators: true }
  );

  const tagged = await Event.updateMany(
    { _id: { $in: editions.map((edition) => edition._id) } },
    { $set: { series: SERIES_SLUG } }
  );

  console.log(`\n✅ Series document saved. ${tagged.modifiedCount} night(s) tagged.`);
  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
