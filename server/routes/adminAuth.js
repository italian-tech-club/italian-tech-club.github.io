import express from 'express';
import crypto from 'crypto';
import { AdminLoginToken, AdminSession } from '../models/AdminAuth.js';
import { sendEmail, magicLinkHtml, SITE_URL } from '../utils/email.js';

const router = express.Router();

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

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

/**
 * POST /api/admin/auth
 * { action: 'request', email }  — email a magic login link (allowlisted emails only)
 * { action: 'exchange', token } — exchange a one-time link token for a session token
 */
router.post('/', async (req, res) => {
  try {
    const { action } = req.body || {};

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

      await sendEmail({
        to: email,
        subject: 'Your admin login link — Italian Tech Club NYC',
        html: magicLinkHtml({
          heading: 'Admin login — Italian Tech Club NYC',
          intro: 'Click the link below to sign in to the admin panel. The link expires in 15 minutes and can be used once.',
          link: `${SITE_URL}/admin?token=${token}`,
          buttonLabel: 'Sign in to Admin',
        }),
      });

      return res.status(200).json(genericResponse);
    }

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
    console.error('❌ Admin auth error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

export default router;
