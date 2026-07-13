import mongoose from 'mongoose';
import crypto from 'crypto';

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
  manageTokenHash: { type: String, default: null },
  manageTokenExpiry: { type: Date, default: null },
  pendingEmail: { type: String, lowercase: true, trim: true, default: null },
  pendingEmailTokenHash: { type: String, default: null },
  pendingEmailTokenExpiry: { type: Date, default: null },
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

const adminSessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  email: { type: String, required: true, lowercase: true },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: true,
  collection: 'admin_sessions',
});
adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const CommunityProfile = mongoose.models.CommunityProfile || mongoose.model('CommunityProfile', communityProfileSchema);
const EmailClaimRequest = mongoose.models.EmailClaimRequest || mongoose.model('EmailClaimRequest', emailClaimRequestSchema);
const AdminSession = mongoose.models.AdminSession || mongoose.model('AdminSession', adminSessionSchema);

const SITE_URL = process.env.SITE_URL || 'https://italiantechclubnyc.com';
const FROM_EMAIL = process.env.SPONSOR_FROM_EMAIL || 'ITC Website <onboarding@resend.dev>';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function isAuthorized(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;
  const session = await AdminSession.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
  return !!session;
}

async function sendClaimApprovedEmail(to, firstName) {
  if (!process.env.RESEND_API_KEY) return false;
  const link = `${SITE_URL}/community/manage`;
  const html = `
    <h2>Claim approved — Italian Tech Club NYC</h2>
    <p>Ciao ${firstName}! Your request to use this email for your community profile was approved. Click below to sign in and manage your profile.</p>
    <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#ffffff;border-radius:9999px;text-decoration:none;font-weight:bold;">Sign in to My Profile</a></p>
    <p style="color:#64748b;font-size:12px;">If the button doesn't work, copy this URL: ${link}</p>
  `;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject: 'Your ITC profile claim was approved', html }),
  });
  return response.ok;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await connectDB();

    if (!(await isAuthorized(req))) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (req.method === 'GET') {
      const pendingProfiles = await CommunityProfile.find({ status: 'pending' })
        .select('firstName lastName email linkedIn profilePic profession company bio emailVerified createdAt')
        .sort({ createdAt: -1 })
        .lean();

      const claimRequests = await EmailClaimRequest.find({ status: 'pending' })
        .populate('candidateProfileId', 'firstName lastName email status')
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({ success: true, pendingProfiles, claimRequests });
    }

    if (req.method === 'POST') {
      const { action } = req.body || {};

      if (action === 'approve-profile') {
        const profile = await CommunityProfile.findById(req.body.profileId);
        if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
        profile.status = 'approved';
        await profile.save();
        return res.status(200).json({ success: true, message: 'Profile approved.' });
      }

      if (action === 'reject-profile') {
        const profile = await CommunityProfile.findByIdAndDelete(req.body.profileId);
        if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
        return res.status(200).json({ success: true, message: 'Profile rejected.' });
      }

      if (action === 'approve-claim') {
        const request = await EmailClaimRequest.findById(req.body.requestId);
        if (!request || request.status !== 'pending') {
          return res.status(404).json({ success: false, message: 'Claim request not found' });
        }

        const targetId = req.body.profileId || request.candidateProfileId;
        if (!targetId) {
          return res.status(400).json({ success: false, message: 'No target profile. Specify which profile to reassign.' });
        }

        const target = await CommunityProfile.findById(targetId);
        if (!target) return res.status(404).json({ success: false, message: 'Target profile not found' });

        const clash = await CommunityProfile.findOne({ email: request.requestedEmail, _id: { $ne: target._id } });
        if (clash) return res.status(409).json({ success: false, message: 'That email is already linked to another profile.' });

        target.email = request.requestedEmail;
        target.emailVerified = false;
        target.claimed = false;
        await target.save();

        request.status = 'approved';
        request.resolvedAt = new Date();
        request.candidateProfileId = target._id;
        await request.save();

        try { await sendClaimApprovedEmail(request.requestedEmail, target.firstName); } catch (e) { console.error('claim email failed', e); }

        return res.status(200).json({ success: true, message: 'Claim approved and email reassigned.' });
      }

      if (action === 'reject-claim') {
        const request = await EmailClaimRequest.findById(req.body.requestId);
        if (!request || request.status !== 'pending') {
          return res.status(404).json({ success: false, message: 'Claim request not found' });
        }
        request.status = 'rejected';
        request.resolvedAt = new Date();
        await request.save();
        return res.status(200).json({ success: true, message: 'Claim request rejected.' });
      }

      return res.status(400).json({ success: false, message: 'Unknown action' });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });

  } catch (error) {
    console.error('Error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
}
