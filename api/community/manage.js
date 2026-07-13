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

// Schema definition (must match server/models/CommunityProfile.js)
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

const CommunityProfile = mongoose.models.CommunityProfile || mongoose.model('CommunityProfile', communityProfileSchema);

const MANAGE_TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutes
const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000; // 60 minutes

const SITE_URL = process.env.SITE_URL || 'https://italiantechclubnyc.com';
const FROM_EMAIL = process.env.SPONSOR_FROM_EMAIL || 'ITC Website <onboarding@resend.dev>';

const EDITABLE_FIELDS = ['firstName', 'lastName', 'linkedIn', 'profilePic', 'profession', 'company', 'bio'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function sendMail(to, subject, { heading, intro, link, buttonLabel }) {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set — cannot send email');
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
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
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

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await connectDB();

    if (req.method === 'POST') {
      // Primary-email change (requires a valid manage token)
      if (req.query.token && req.body?.action === 'change-email') {
        const profile = await findProfileByToken(req.query.token);
        if (!profile) {
          return res.status(401).json({ success: false, message: 'This link is invalid or has expired. Request a new one.' });
        }

        const newEmail = (req.body.newEmail || '').toLowerCase().trim();
        if (!EMAIL_RE.test(newEmail)) {
          return res.status(400).json({ success: false, message: 'Please enter a valid email.' });
        }
        if (newEmail === profile.email) {
          return res.status(400).json({ success: false, message: 'That is already your primary email.' });
        }
        const taken = await CommunityProfile.findOne({ email: newEmail });
        if (taken) {
          return res.status(409).json({ success: false, message: 'That email is already linked to another profile.' });
        }

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

      if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
      }

      const profile = await CommunityProfile.findOne({ email });
      if (!profile) {
        return res.status(200).json(genericResponse);
      }

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
      if (!profile) {
        return res.status(401).json({ success: false, message: 'This confirmation link is invalid or has expired.' });
      }

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
    const token = req.query.token;
    const profile = await findProfileByToken(token);
    if (!profile) {
      return res.status(401).json({ success: false, message: 'This link is invalid or has expired. Request a new one.' });
    }

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
      if (profile.isFounder) {
        return res.status(403).json({ success: false, message: 'Founder profiles cannot be deleted.' });
      }
      await profile.deleteOne();
      return res.status(200).json({ success: true, message: 'Profile deleted.' });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });

  } catch (error) {
    console.error('Error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }

    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
}
