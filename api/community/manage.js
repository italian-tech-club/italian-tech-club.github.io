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

// Schema definition (must match submit.js/profiles.js)
const communityProfileSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 50 },
  lastName: { type: String, required: true, trim: true, maxlength: 50 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  linkedIn: { type: String, required: true, trim: true },
  profilePic: { type: String, required: function () { return !this.isFounder; }, default: null },
  profession: { type: String, required: true, trim: true, maxlength: 100 },
  company: { type: String, trim: true, maxlength: 100, default: '' },
  bio: { type: String, maxlength: 500, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'inactive'], default: 'pending' },
  emailVerified: { type: Boolean, default: false },
  isFounder: { type: Boolean, default: false },
  manageTokenHash: { type: String, default: null },
  manageTokenExpiry: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'community_profiles',
});

const CommunityProfile = mongoose.models.CommunityProfile || mongoose.model('CommunityProfile', communityProfileSchema);

const MANAGE_TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutes

const SITE_URL = process.env.SITE_URL || 'https://italiantechclubnyc.com';
const FROM_EMAIL = process.env.SPONSOR_FROM_EMAIL || 'ITC Website <onboarding@resend.dev>';

const EDITABLE_FIELDS = ['firstName', 'lastName', 'linkedIn', 'profilePic', 'profession', 'company', 'bio'];

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function sendManageEmail(email, token, firstName) {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set — cannot send manage link');
    return false;
  }

  const link = `${SITE_URL}/community/manage?token=${token}`;
  const html = `
    <h2>Manage your profile — Italian Tech Club NYC</h2>
    <p>Ciao${firstName ? ` ${firstName}` : ''}! Click the link below to edit or remove your community profile. The link expires in 60 minutes.</p>
    <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#ffffff;border-radius:9999px;text-decoration:none;font-weight:bold;">Manage My Profile</a></p>
    <p style="color:#64748b;font-size:12px;">If the button doesn't work, copy this URL: ${link}</p>
    <p style="color:#64748b;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [email],
      subject: 'Manage your ITC community profile',
      html,
    }),
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

    // Request a manage link by email
    if (req.method === 'POST') {
      const email = (req.body?.email || '').toLowerCase().trim();

      // Identical response whether or not the profile exists (no enumeration)
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

      await sendManageEmail(profile.email, token, profile.firstName);
      return res.status(200).json(genericResponse);
    }

    // Everything below requires a valid manage token
    const token = req.query.token;
    const profile = await findProfileByToken(token);
    if (!profile) {
      return res.status(401).json({ success: false, message: 'This link is invalid or has expired. Request a new one.' });
    }

    // Fetch own profile (clicking the link also verifies the email)
    if (req.method === 'GET') {
      if (!profile.emailVerified) {
        profile.emailVerified = true;
        if (profile.status === 'pending') profile.status = 'approved';
        await profile.save();
      }

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

    // Update own profile
    if (req.method === 'PUT') {
      for (const field of EDITABLE_FIELDS) {
        if (req.body[field] !== undefined) {
          profile[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
        }
      }
      if (!profile.emailVerified) {
        profile.emailVerified = true;
        if (profile.status === 'pending') profile.status = 'approved';
      }
      await profile.save();

      return res.status(200).json({ success: true, message: 'Profile updated!' });
    }

    // Delete own profile (founder profiles are permanent)
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
