import mongoose from 'mongoose';

// MongoDB connection caching for serverless
let cachedConnection = null;

async function connectDB() {
  if (cachedConnection) {
    return cachedConnection;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined');
  }

  cachedConnection = await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });

  return cachedConnection;
}

// Schema definitions (must match server/models/*)
const communityProfileSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 50 },
  lastName: { type: String, required: true, trim: true, maxlength: 50 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  linkedIn: { type: String, trim: true, default: '' },
  profilePic: { type: String, default: null },
  profession: { type: String, required: true, trim: true, maxlength: 100 },
  company: { type: String, trim: true, maxlength: 100, default: '' },
  bio: { type: String, maxlength: 500, default: '' },
  status: { type: String, enum: ['unclaimed', 'pending', 'approved', 'inactive'], default: 'pending' },
  emailVerified: { type: Boolean, default: false },
  isFounder: { type: Boolean, default: false },
  seeded: { type: Boolean, default: false },
  claimed: { type: Boolean, default: false },
  gdprConsent: { type: Boolean, default: false },
}, {
  timestamps: true,
  collection: 'community_profiles',
});

const emailClaimRequestSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  currentEmail: { type: String, lowercase: true, trim: true, default: '' },
  requestedEmail: { type: String, required: true, lowercase: true, trim: true },
  message: { type: String, maxlength: 1000, default: '' },
  candidateProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityProfile', default: null },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  resolvedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'email_claim_requests',
});

const CommunityProfile = mongoose.models.CommunityProfile || mongoose.model('CommunityProfile', communityProfileSchema);
const EmailClaimRequest = mongoose.models.EmailClaimRequest || mongoose.model('EmailClaimRequest', emailClaimRequestSchema);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    await connectDB();

    const fullName = (req.body?.fullName || '').trim();
    const currentEmail = (req.body?.currentEmail || '').toLowerCase().trim();
    const newEmail = (req.body?.newEmail || '').toLowerCase().trim();
    const message = (req.body?.message || '').trim();

    if (!fullName || !EMAIL_RE.test(newEmail)) {
      return res.status(400).json({ success: false, message: 'Your name and a valid new email are required.' });
    }

    const existing = await CommunityProfile.findOne({ email: newEmail });
    if (existing) {
      return res.status(409).json({ success: false, message: 'That email already has a profile — use the manage link to sign in instead.' });
    }

    // Best-effort auto-match the target profile
    let candidate = null;
    if (currentEmail && EMAIL_RE.test(currentEmail)) {
      candidate = await CommunityProfile.findOne({ email: currentEmail });
    }
    if (!candidate) {
      const parts = fullName.split(/\s+/).filter(Boolean).map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (parts.length) {
        candidate = await CommunityProfile.findOne({
          firstName: new RegExp(`^${parts[0]}$`, 'i'),
          lastName: new RegExp(`^${parts.slice(1).join(' ') || parts[0]}$`, 'i'),
        });
      }
    }

    await EmailClaimRequest.create({
      fullName,
      currentEmail,
      requestedEmail: newEmail,
      message,
      candidateProfileId: candidate?._id || null,
    });

    return res.status(201).json({
      success: true,
      message: "Request received. An admin will review it and you'll get an email once approved.",
    });
  } catch (error) {
    console.error('Error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
}
