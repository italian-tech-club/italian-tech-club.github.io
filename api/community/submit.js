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

// Schema definition
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

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function sendVerifyEmail(email, token, firstName) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — profile stays pending until manually approved');
    return false;
  }

  const link = `${SITE_URL}/community/manage?token=${token}`;
  const html = `
    <h2>Verify your profile — Italian Tech Club NYC</h2>
    <p>Ciao ${firstName}! Click the link below to verify your email and publish your community profile. The link expires in 60 minutes.</p>
    <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#ffffff;border-radius:9999px;text-decoration:none;font-weight:bold;">Verify &amp; Publish My Profile</a></p>
    <p style="color:#64748b;font-size:12px;">If the button doesn't work, copy this URL: ${link}</p>
    <p style="color:#64748b;font-size:12px;">If you didn't create this profile, you can safely ignore this email.</p>
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
      subject: 'Verify your ITC community profile',
      html,
    }),
  });

  if (!response.ok) {
    console.error('Resend API error:', response.status, await response.text());
    return false;
  }
  return true;
}

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

    const { firstName, lastName, email, linkedIn, profilePic, profession, company, bio } = req.body;

    if (!firstName || !lastName || !email || !linkedIn || !profilePic || !profession) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email' });
    }

    const existingProfile = await CommunityProfile.findOne({ email: email.toLowerCase() });
    if (existingProfile) {
      return res.status(409).json({
        success: false,
        message: 'A profile with this email already exists.',
      });
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
      manageTokenHash: sha256(verifyToken),
      manageTokenExpiry: new Date(Date.now() + MANAGE_TOKEN_TTL_MS),
    });

    await profile.save();

    // Best-effort: profile is saved as pending either way
    let emailSent = false;
    try {
      emailSent = await sendVerifyEmail(profile.email, verifyToken, profile.firstName);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }

    return res.status(201).json({
      success: true,
      message: emailSent
        ? 'Almost done! Check your email to verify and publish your profile.'
        : 'Profile submitted! It will appear once approved.',
      emailSent,
      profileId: profile._id,
    });

  } catch (error) {
    console.error('Error:', error);

    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A profile with this email already exists.' });
    }

    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
}
