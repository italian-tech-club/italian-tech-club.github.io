import mongoose from 'mongoose';

// Active member sessions (Bearer token for the community API). Issued when a
// member opens a valid manage magic link; lets the SPA show the full directory
// and use member-only actions (connect, view tracking) without re-emailing.
const memberSessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityProfile', required: true },
  email: { type: String, required: true, lowercase: true },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: true,
  collection: 'member_sessions',
});
memberSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
memberSessionSchema.index({ profileId: 1 });

export const MemberSession = mongoose.models.MemberSession || mongoose.model('MemberSession', memberSessionSchema);
