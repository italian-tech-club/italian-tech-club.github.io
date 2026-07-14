import mongoose from 'mongoose';

// One doc per (profile, viewer, day) — dedupes repeat views so viewCount and
// the owner's "views this week" stat count people, not refreshes.
const profileViewSchema = new mongoose.Schema({
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityProfile', required: true },
  viewerProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityProfile', required: true },
  day: { type: String, required: true }, // YYYY-MM-DD
  viewedAt: { type: Date, default: Date.now },
}, {
  collection: 'profile_views',
});
profileViewSchema.index({ profileId: 1, viewerProfileId: 1, day: 1 }, { unique: true });
profileViewSchema.index({ profileId: 1, viewedAt: 1 });

export const ProfileView = mongoose.models.ProfileView || mongoose.model('ProfileView', profileViewSchema);
