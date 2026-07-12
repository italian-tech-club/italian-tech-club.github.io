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

// Hardcoded admin allowlist — the only emails that can receive a login link
const ADMIN_EMAILS = [
  'giuseppe.concialdi@gmail.com',
  'noemi.gozzi@gmail.com',
  'enrico.fontana1997@gmail.com',
  'michela@tarantino.email',
  'nicole.bizzini@gmail.com',
];

const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes, single-use
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const SITE_URL = process.env.SITE_URL || 'https://italiantechclubnyc.com';
const FROM_EMAIL = process.env.SPONSOR_FROM_EMAIL || 'ITC Website <onboarding@resend.dev>';

// One-time login tokens (consumed on exchange)
const adminLoginTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  email: { type: String, required: true, lowercase: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'admin_login_tokens',
});
adminLoginTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Active admin sessions (Bearer token for the events API)
const adminSessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  email: { type: String, required: true, lowercase: true },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: true,
  collection: 'admin_sessions',
});
adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AdminLoginToken = mongoose.models.AdminLoginToken || mongoose.model('AdminLoginToken', adminLoginTokenSchema);
const AdminSession = mongoose.models.AdminSession || mongoose.model('AdminSession', adminSessionSchema);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function sendLoginEmail(email, token) {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set — cannot send admin login link');
    return false;
  }

  const link = `${SITE_URL}/admin?token=${token}`;
  const html = `
    <h2>Admin login — Italian Tech Club NYC</h2>
    <p>Click the link below to sign in to the admin panel. The link expires in 15 minutes and can be used once.</p>
    <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#ffffff;border-radius:9999px;text-decoration:none;font-weight:bold;">Sign in to Admin</a></p>
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
      subject: 'Your admin login link — Italian Tech Club NYC',
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

    const { action } = req.body || {};

    // Step 1: request a magic link
    if (action === 'request') {
      const email = (req.body.email || '').toLowerCase().trim();

      // Always respond identically so the allowlist can't be probed
      const genericResponse = { success: true, message: 'If this email is authorized, a login link is on its way.' };

      if (!email || !ADMIN_EMAILS.includes(email)) {
        return res.status(200).json(genericResponse);
      }

      const token = crypto.randomBytes(32).toString('hex');
      await AdminLoginToken.create({
        tokenHash: sha256(token),
        email,
        expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MS),
      });

      await sendLoginEmail(email, token);
      return res.status(200).json(genericResponse);
    }

    // Step 2: exchange the emailed token for a session token
    if (action === 'exchange') {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ success: false, message: 'Missing token' });
      }

      const loginToken = await AdminLoginToken.findOne({
        tokenHash: sha256(token),
        usedAt: null,
        expiresAt: { $gt: new Date() },
      });

      if (!loginToken) {
        return res.status(401).json({ success: false, message: 'This login link is invalid or has expired. Request a new one.' });
      }

      loginToken.usedAt = new Date();
      await loginToken.save();

      const sessionToken = crypto.randomBytes(32).toString('hex');
      await AdminSession.create({
        tokenHash: sha256(sessionToken),
        email: loginToken.email,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      });

      return res.status(200).json({ success: true, sessionToken, email: loginToken.email });
    }

    return res.status(400).json({ success: false, message: 'Unknown action' });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
}
