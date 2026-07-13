import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * Consolidated community API. Vercel Hobby caps a deployment at 12 serverless
 * functions, so all community endpoints share this one dynamic route:
 *   GET    /api/community/profiles
 *   POST   /api/community/submit
 *   GET|POST|PUT|DELETE /api/community/manage
 *   POST   /api/community/claim-request
 *   GET|POST /api/community/admin           (admin session required)
 * The segment after /community/ arrives as req.query.action.
 * (Mirror of server/routes/community.js used by the local express server.)
 */

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

const MANAGE_TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutes
const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000; // 60 minutes
const SITE_URL = process.env.SITE_URL || 'https://italiantechclubnyc.com';
const FROM_EMAIL = process.env.SPONSOR_FROM_EMAIL || 'ITC Website <onboarding@resend.dev>';
const EDITABLE_FIELDS = ['firstName', 'lastName', 'linkedIn', 'profilePic', 'profession', 'company', 'bio'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function sendMail(to, subject, { heading, intro, link, buttonLabel }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — email not sent:', subject);
    return false;
  }
  const html = `
    <h2>${heading}</h2>
    <p>${intro}</p>
    <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#ffffff;border-radius:9999px;text-decoration:none;font-weight:bold;">${buttonLabel}</a></p>
    <p style="color:#64748b;font-size:12px;">If the button doesn't work, copy this URL: ${link}</p>
    <p style="color:#64748b;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
  `;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!response.ok) {
    console.error('Resend API error:', response.status, await response.text());
    return false;
  }
  return true;
}

async function findProfileByToken(token) {
  if (!token) return null;
  return CommunityProfile.findOne({
    manageTokenHash: sha256(token),
    manageTokenExpiry: { $gt: new Date() },
  });
}

// Verify + claim a profile accessed via a valid magic link. Seeded-but-
// unconsented profiles become approved (consent recorded); new self-submissions
// ('pending') stay pending until an admin approves.
async function applyClaim(profile) {
  let changed = false;
  if (!profile.emailVerified) { profile.emailVerified = true; changed = true; }
  if (!profile.claimed) { profile.claimed = true; changed = true; }
  if (profile.status === 'unclaimed') {
    profile.status = 'approved';
    profile.gdprConsent = true;
    changed = true;
  }
  if (changed) await profile.save();
}

async function isAuthorized(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;
  const session = await AdminSession.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
  return !!session;
}

// ---- GET /api/community/profiles ----
async function handleProfiles(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });
  const profiles = await CommunityProfile.find({ status: 'approved' })
    .select('firstName lastName linkedIn profilePic profession company bio isFounder createdAt')
    .sort({ createdAt: -1 });
  return res.status(200).json({ success: true, profiles, count: profiles.length });
}

// ---- POST /api/community/submit ----
async function handleSubmit(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { firstName, lastName, email, linkedIn, profilePic, profession, company, bio } = req.body;
  if (!firstName || !lastName || !email || !linkedIn || !profilePic || !profession) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email' });
  }

  const existingProfile = await CommunityProfile.findOne({ email: email.toLowerCase() });
  if (existingProfile) {
    return res.status(409).json({ success: false, message: 'A profile with this email already exists. Use the manage link to edit it.' });
  }

  const verifyToken = crypto.randomBytes(32).toString('hex');
  const profile = new CommunityProfile({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.toLowerCase().trim(),
    linkedIn: linkedIn.trim(),
    profilePic,
    profession: profession.trim(),
    company: company?.trim() || '',
    bio: bio?.trim() || '',
    status: 'pending',
    manageTokenHash: sha256(verifyToken),
    manageTokenExpiry: new Date(Date.now() + MANAGE_TOKEN_TTL_MS),
  });
  await profile.save();

  let emailSent = false;
  try {
    emailSent = await sendMail(profile.email, 'Verify your ITC community profile', {
      heading: 'Verify your profile — Italian Tech Club NYC',
      intro: `Ciao ${profile.firstName}! Click the link below to verify your email. Your profile will go live once our team approves it. The link expires in 60 minutes.`,
      link: `${SITE_URL}/community/manage?token=${verifyToken}`,
      buttonLabel: 'Verify My Email',
    });
  } catch (e) {
    console.error('Failed to send verification email:', e);
  }

  return res.status(201).json({
    success: true,
    message: emailSent
      ? 'Profile submitted! Verify your email, then our team will review and approve it.'
      : 'Profile submitted! It will appear once our team approves it.',
    emailSent,
    profileId: profile._id,
  });
}

// ---- GET|POST|PUT|DELETE /api/community/manage ----
async function handleManage(req, res) {
  if (req.method === 'POST') {
    // Primary-email change (requires a valid manage token)
    if (req.query.token && req.body?.action === 'change-email') {
      const profile = await findProfileByToken(req.query.token);
      if (!profile) return res.status(401).json({ success: false, message: 'This link is invalid or has expired. Request a new one.' });

      const newEmail = (req.body.newEmail || '').toLowerCase().trim();
      if (!EMAIL_RE.test(newEmail)) return res.status(400).json({ success: false, message: 'Please enter a valid email.' });
      if (newEmail === profile.email) return res.status(400).json({ success: false, message: 'That is already your primary email.' });
      const taken = await CommunityProfile.findOne({ email: newEmail });
      if (taken) return res.status(409).json({ success: false, message: 'That email is already linked to another profile.' });

      const emailToken = crypto.randomBytes(32).toString('hex');
      profile.pendingEmail = newEmail;
      profile.pendingEmailTokenHash = sha256(emailToken);
      profile.pendingEmailTokenExpiry = new Date(Date.now() + EMAIL_CHANGE_TTL_MS);
      await profile.save();

      await sendMail(newEmail, 'Confirm your new ITC profile email', {
        heading: 'Confirm your new email — Italian Tech Club NYC',
        intro: `Ciao ${profile.firstName}! Click below to make this address the primary email for your community profile. The link expires in 60 minutes.`,
        link: `${SITE_URL}/community/manage?emailToken=${emailToken}`,
        buttonLabel: 'Confirm New Email',
      });

      return res.status(200).json({ success: true, message: `Check ${newEmail} to confirm the change.` });
    }

    // Request a manage link by email
    const email = (req.body?.email || '').toLowerCase().trim();
    const genericResponse = { success: true, message: 'If a profile with this email exists, a manage link is on its way.' };
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const profile = await CommunityProfile.findOne({ email });
    if (!profile) return res.status(200).json(genericResponse);

    const token = crypto.randomBytes(32).toString('hex');
    profile.manageTokenHash = sha256(token);
    profile.manageTokenExpiry = new Date(Date.now() + MANAGE_TOKEN_TTL_MS);
    await profile.save();

    await sendMail(profile.email, 'Manage your ITC community profile', {
      heading: 'Manage your profile — Italian Tech Club NYC',
      intro: `Ciao ${profile.firstName}! Click the link below to claim or edit your community profile. The link expires in 60 minutes.`,
      link: `${SITE_URL}/community/manage?token=${token}`,
      buttonLabel: 'Manage My Profile',
    });

    return res.status(200).json(genericResponse);
  }

  // Confirm a primary-email change
  if (req.method === 'GET' && req.query.emailToken) {
    const profile = await CommunityProfile.findOne({
      pendingEmailTokenHash: sha256(req.query.emailToken),
      pendingEmailTokenExpiry: { $gt: new Date() },
    });
    if (!profile) return res.status(401).json({ success: false, message: 'This confirmation link is invalid or has expired.' });

    const clash = await CommunityProfile.findOne({ email: profile.pendingEmail, _id: { $ne: profile._id } });
    if (clash) {
      profile.pendingEmail = null;
      profile.pendingEmailTokenHash = null;
      profile.pendingEmailTokenExpiry = null;
      await profile.save();
      return res.status(409).json({ success: false, message: 'That email is now linked to another profile.' });
    }

    profile.email = profile.pendingEmail;
    profile.emailVerified = true;
    profile.pendingEmail = null;
    profile.pendingEmailTokenHash = null;
    profile.pendingEmailTokenExpiry = null;
    await profile.save();

    return res.status(200).json({ success: true, emailChanged: true, email: profile.email });
  }

  // Everything below requires a valid manage token
  const profile = await findProfileByToken(req.query.token);
  if (!profile) return res.status(401).json({ success: false, message: 'This link is invalid or has expired. Request a new one.' });

  if (req.method === 'GET') {
    await applyClaim(profile);
    return res.status(200).json({
      success: true,
      profile: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        linkedIn: profile.linkedIn,
        profilePic: profile.profilePic,
        profession: profile.profession,
        company: profile.company,
        bio: profile.bio,
        status: profile.status,
        isFounder: profile.isFounder,
      },
    });
  }

  if (req.method === 'PUT') {
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        profile[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
      }
    }
    await applyClaim(profile);
    await profile.save();
    return res.status(200).json({ success: true, message: 'Profile updated!' });
  }

  if (req.method === 'DELETE') {
    if (profile.isFounder) return res.status(403).json({ success: false, message: 'Founder profiles cannot be deleted.' });
    await profile.deleteOne();
    return res.status(200).json({ success: true, message: 'Profile deleted.' });
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}

// ---- POST /api/community/claim-request ----
async function handleClaimRequest(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

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
}

// ---- GET|POST /api/community/admin (admin session required) ----
async function handleAdmin(req, res) {
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

      try {
        await sendMail(request.requestedEmail, 'Your ITC profile claim was approved', {
          heading: 'Claim approved — Italian Tech Club NYC',
          intro: `Ciao ${target.firstName}! Your request to use this email for your community profile was approved. Click below to sign in and manage your profile.`,
          link: `${SITE_URL}/community/manage`,
          buttonLabel: 'Sign in to My Profile',
        });
      } catch (e) {
        console.error('claim email failed', e);
      }

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
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await connectDB();

    const action = req.query.action;

    switch (action) {
      case 'profiles': return await handleProfiles(req, res);
      case 'submit': return await handleSubmit(req, res);
      case 'manage': return await handleManage(req, res);
      case 'claim-request': return await handleClaimRequest(req, res);
      case 'admin': return await handleAdmin(req, res);
      default: return res.status(404).json({ success: false, message: 'Not found' });
    }
  } catch (error) {
    console.error('Error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A profile with this email already exists.' });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
}
