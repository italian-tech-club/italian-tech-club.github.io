/**
 * Seed the five founder profiles into the `community_profiles` collection,
 * linked to the same emails as the admin allowlist so each founder can edit
 * their own profile via the /community/manage magic-link flow.
 *
 * Idempotent — upserts on email. Profile content (name, bio, photo, …) is
 * only written on first insert, so re-running never clobbers a founder's
 * own edits; it just re-asserts isFounder/approved/verified flags.
 *
 * Usage: MONGODB_URI must be set (or present in .env), then:
 *   npm run seed:founders
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import CommunityProfile from '../server/models/CommunityProfile.js';

// Emails must match the admin allowlist in api/admin/auth.js
const FOUNDERS = [
  {
    email: 'giuseppe.concialdi@gmail.com',
    firstName: 'Giuseppe',
    lastName: 'Concialdi',
    linkedIn: 'https://www.linkedin.com/in/giuseppe-concialdi/',
  },
  {
    email: 'enrico.fontana1997@gmail.com',
    firstName: 'Enrico',
    lastName: 'Fontana',
    linkedIn: 'https://www.linkedin.com/in/enrico-fontana/',
  },
  {
    email: 'noemi.gozzi@gmail.com',
    firstName: 'Noemi',
    lastName: 'Gozzi',
    linkedIn: 'https://www.linkedin.com/in/noemi-gozzi-a87a2215a/',
  },
  {
    email: 'michela@tarantino.email',
    firstName: 'Michela',
    lastName: 'Tarantino',
    linkedIn: 'https://www.linkedin.com/in/michela-tarantino/',
  },
  {
    email: 'nicole.bizzini@gmail.com',
    firstName: 'Nicole',
    lastName: 'Bizzini',
    linkedIn: 'https://www.linkedin.com/in/nicolebizzini/',
  },
];

const SHARED = {
  profilePic: null,
  profession: 'Founding Member',
  company: 'Italian Tech Club NYC',
  bio: 'Co-founder of the Italian Tech Club NYC chapter, connecting Italian founders, engineers, and operators in New York.',
};

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  console.log('✅ Connected to MongoDB');

  let created = 0;
  let updated = 0;

  for (const founder of FOUNDERS) {
    const result = await CommunityProfile.updateOne(
      { email: founder.email },
      {
        $set: {
          isFounder: true,
          status: 'approved',
          emailVerified: true,
        },
        $setOnInsert: {
          firstName: founder.firstName,
          lastName: founder.lastName,
          linkedIn: founder.linkedIn,
          ...SHARED,
        },
      },
      { upsert: true }
    );
    if (result.upsertedCount > 0) {
      created++;
      console.log(`  + created: ${founder.firstName} ${founder.lastName} <${founder.email}>`);
    } else {
      updated++;
      console.log(`  ~ updated: ${founder.firstName} ${founder.lastName} <${founder.email}>`);
    }
  }

  const total = await CommunityProfile.countDocuments({ isFounder: true });
  console.log(`\nDone. ${created} created, ${updated} updated. Collection now has ${total} founder profiles.`);

  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
