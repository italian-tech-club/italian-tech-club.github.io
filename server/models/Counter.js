import mongoose from 'mongoose';

// Atomic sequence generator (used for memberNumber assignment).
const counterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 },
}, {
  collection: 'counters',
});

export const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

export async function nextSequence(name) {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return doc.seq;
}
