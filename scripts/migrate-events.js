/**
 * One-time migration: seed the `events` MongoDB collection from src/data/events.json.
 *
 * Idempotent — upserts on (date, title), so it can be re-run safely.
 *
 * Usage: MONGODB_URI must be set (or present in .env), then:
 *   npm run migrate:events
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import Event from '../server/models/Event.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const eventsPath = path.join(__dirname, '../src/data/events.json');

async function migrate() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined');
    process.exit(1);
  }

  const events = JSON.parse(readFileSync(eventsPath, 'utf8'));
  console.log(`Found ${events.length} events in events.json`);

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  console.log('✅ Connected to MongoDB');

  let created = 0;
  let updated = 0;

  for (const event of events) {
    const result = await Event.updateOne(
      { date: event.date, title: event.title },
      {
        $set: {
          subtitle: event.subtitle ?? '',
          location: event.location,
          time: event.time ?? null,
          type: event.type,
          link: event.link ?? null,
          poster: event.poster ?? null,
          gallery: event.gallery ?? [],
        },
      },
      { upsert: true, runValidators: true }
    );
    if (result.upsertedCount > 0) {
      created++;
      console.log(`  + created: ${event.date} — ${event.title}`);
    } else {
      updated++;
      console.log(`  ~ updated: ${event.date} — ${event.title}`);
    }
  }

  const total = await Event.countDocuments();
  console.log(`\nDone. ${created} created, ${updated} updated. Collection now has ${total} events.`);

  await mongoose.disconnect();
}

migrate().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
