import mongoose from 'mongoose';

const communityProfileSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: 50,
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: 50,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email'],
  },
  // Optional so pre-seeded members (imported from the historical roster) can be
  // stored before they claim and fill in the details. New self-submissions still
  // require it at the API layer.
  linkedIn: {
    type: String,
    trim: true,
    default: '',
  },
  profilePic: {
    // Founders and pre-seeded members may go live without a photo (initials
    // avatar renders instead). New self-submissions require it at the API layer.
    type: String,
    default: null,
  },
  profession: {
    type: String,
    required: [true, 'Profession is required'],
    trim: true,
    maxlength: 100,
  },
  company: {
    type: String,
    trim: true,
    maxlength: 100,
    default: '',
  },
  bio: {
    type: String,
    maxlength: 500,
    default: '',
  },
  status: {
    type: String,
    // unclaimed  → seeded but not yet consented/claimed; hidden from the directory
    // pending    → new self-submission awaiting admin approval; hidden
    // approved   → live in the directory
    // inactive   → hidden, kept for records
    enum: ['unclaimed', 'pending', 'approved', 'inactive'],
    default: 'pending',
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  isFounder: {
    type: Boolean,
    default: false,
  },
  // True once the member has been imported from the historical roster (vs. a
  // fresh self-submission). Lets us tell "existing member, claimable" apart.
  seeded: {
    type: Boolean,
    default: false,
  },
  // True once the person has accessed the profile via a magic link (proving
  // ownership of the email on file).
  claimed: {
    type: Boolean,
    default: false,
  },
  // GDPR consent to be listed publicly. Seeded members who did not consent stay
  // hidden until they claim (which records consent).
  gdprConsent: {
    type: Boolean,
    default: false,
  },
  manageTokenHash: {
    type: String,
    default: null,
  },
  manageTokenExpiry: {
    type: Date,
    default: null,
  },
  // Self-service primary-email change: a new address that has been requested but
  // not yet verified. Confirmed via a link sent to the new address.
  pendingEmail: {
    type: String,
    lowercase: true,
    trim: true,
    default: null,
  },
  pendingEmailTokenHash: {
    type: String,
    default: null,
  },
  pendingEmailTokenExpiry: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
  collection: 'community_profiles',
});

communityProfileSchema.index({ status: 1 });

const CommunityProfile = mongoose.model('CommunityProfile', communityProfileSchema);

export default CommunityProfile;
