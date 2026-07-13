import mongoose from 'mongoose';

/**
 * A request from someone who is an existing community member but no longer has
 * access to the email their profile was registered with, and wants to take
 * ownership using a different email. An admin reviews and approves/rejects it in
 * the admin panel; on approval the target profile's primary email is switched to
 * the requested address so the person can then claim it via the magic link.
 */
const emailClaimRequestSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  // The email the profile is currently registered under, if the requester knows
  // it. Used to auto-match the target profile.
  currentEmail: {
    type: String,
    lowercase: true,
    trim: true,
    default: '',
  },
  // The new email the requester wants to use as the profile's primary email.
  requestedEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email'],
  },
  message: {
    type: String,
    maxlength: 1000,
    default: '',
  },
  // Best-effort auto-matched profile (by currentEmail, then by name). Admin can
  // override at approval time.
  candidateProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommunityProfile',
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
  collection: 'email_claim_requests',
});

emailClaimRequestSchema.index({ status: 1, createdAt: -1 });

const EmailClaimRequest = mongoose.model('EmailClaimRequest', emailClaimRequestSchema);

export default EmailClaimRequest;
