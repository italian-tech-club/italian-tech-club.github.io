import express from 'express';
import crypto from 'crypto';
import { AdminLoginToken, AdminSession } from '../models/AdminAuth.js';
import { ADMIN_SESSION_TTL_MS, ADMIN_EMAILS, bearerToken, resolveAdmin } from '../utils/adminAccess.js';
import { sendEmail, magicLinkHtml, SITE_URL } from '../utils/email.js';

const router = express.Router();

const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes, single-use

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

/**
 * POST /api/admin/auth
 * { action: 'request', email }  — email a magic login link (allowlisted emails only)
 * { action: 'exchange', token } — exchange a one-time link token for a session token
 * { action: 'session' }         — validate the Bearer token in the header (an admin
 *                                 session, or a member session on the allowlist)
 * { action: 'signout' }         — revoke the admin session in the header
 */
router.post('/', async (req, res) => {
  try {
    const { action } = req.body || {};

    if (action === 'signout') {
      const token = bearerToken(req);
      if (token) await AdminSession.deleteOne({ tokenHash: sha256(token) });
      return res.status(200).json({ success: true });
    }

    if (action === 'session') {
      const admin = await resolveAdmin(req);
      if (!admin) return res.status(401).json({ success: false, message: 'Not signed in' });
      return res.status(200).json({
        success: true,
        email: admin.email,
        via: admin.via,
        sessionExpiresAt: admin.expiresAt,
      });
    }

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
      const sessionExpiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS);
      await AdminSession.create({
        tokenHash: sha256(sessionToken),
        email: loginToken.email,
        expiresAt: sessionExpiresAt,
      });

      return res.status(200).json({ success: true, sessionToken, email: loginToken.email, sessionExpiresAt });
    }

    return res.status(400).json({ success: false, message: 'Unknown action' });

  } catch (error) {
    console.error('❌ Admin auth error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

export default router;
