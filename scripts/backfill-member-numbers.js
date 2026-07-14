/**
 * Backfill memberNumber and inviteCode for already-approved profiles.
 * Founders get the lowest numbers (seed order), then everyone else by
 * createdAt. The memberNumber counter is left at the max assigned value so
 * future approvals continue the sequence.
 *
 * Idempotent — profiles that already have a number/code are skipped.
 *
 * Usage: MONGODB_URI must be set (or present in .env), then:
 *   npm run backfill:member-numbers
 */
import 'dotenv/config';
import crypto from 'crypto';
import mongoose from 'mongoose';
import CommunityProfile from '../server/models/CommunityProfile.js';
import { Counter } from '../server/models/Counter.js';

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);

  const approved = await CommunityProfile.find({ status: 'approved' })
    .sort({ isFounder: -1, createdAt: 1 });

  const taken = new Set(approved.map((p) => p.memberNumber).filter((n) => typeof n === 'number'));
  let next = 1;
  const nextFree = () => {
    while (taken.has(next)) next += 1;
    taken.add(next);
    return next;
  };

  let numbered = 0;
  let coded = 0;
  for (const profile of approved) {
    let changed = false;
    if (profile.memberNumber == null) {
      profile.memberNumber = nextFree();
      numbered += 1;
      changed = true;
    }
    if (!profile.inviteCode) {
      profile.inviteCode = crypto.randomBytes(6).toString('base64url');
      coded += 1;
      changed = true;
    }
    if (changed) await profile.save();
    console.log(`#${String(profile.memberNumber).padStart(3, '0')}  ${profile.firstName} ${profile.lastName}${profile.isFounder ? '  ★ founder' : ''}`);
  }

  const maxNumber = Math.max(0, ...taken);
  await Counter.findOneAndUpdate(
    { _id: 'memberNumber' },
    { $max: { seq: maxNumber } },
    { upsert: true },
  );

  console.log(`\n✅ ${approved.length} approved profiles — assigned ${numbered} member numbers, ${coded} invite codes. Counter at ${maxNumber}.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
