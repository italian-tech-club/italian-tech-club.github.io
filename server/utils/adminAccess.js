import crypto from 'crypto';
import { AdminSession } from '../models/AdminAuth.js';
import { MemberSession } from '../models/MemberAuth.js';

// Hardcoded admin allowlist — the only emails that can hold admin access,
// whether they signed in through /admin or through their member magic link.
export const ADMIN_EMAILS = [
  'giuseppe.concialdi@gmail.com',
  'noemi.gozzi@gmail.com',
  'enrico.fontana1997@gmail.com',
  'michela@tarantino.email',
  'nicole.bizzini@gmail.com',
];

export const ADMIN_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
// A session with less than this left is pushed back to a full TTL on every
// authenticated call, so an admin who keeps using the panel never signs in again.
const RENEW_BELOW_MS = 7 * 24 * 60 * 60 * 1000;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const isAdminEmail = (email) => ADMIN_EMAILS.includes(String(email || '').toLowerCase());

export const bearerToken = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
};

/**
 * Resolve admin access from the Authorization header. Either session type
 * counts: an admin magic-link session, or a member session whose email is on
 * the allowlist — admins are members too, so one sign-in covers both panels.
 * A near-expiry admin session is renewed in passing.
 * @returns {Promise<{email: string, via: 'admin'|'member', expiresAt: Date} | null>}
 */
export async function resolveAdmin(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const tokenHash = sha256(token);
  const now = new Date();

  const adminSession = await AdminSession.findOne({ tokenHash, expiresAt: { $gt: now } });
  if (adminSession) {
    if (adminSession.expiresAt - now < RENEW_BELOW_MS) {
      adminSession.expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS);
      await adminSession.save();
    }
    return { email: adminSession.email, via: 'admin', expiresAt: adminSession.expiresAt };
  }

  const memberSession = await MemberSession.findOne({ tokenHash, expiresAt: { $gt: now } });
  if (memberSession && isAdminEmail(memberSession.email)) {
    return { email: memberSession.email, via: 'member', expiresAt: memberSession.expiresAt };
  }

  return null;
}

/** Express guard: 401 unless the caller resolves to an admin. */
export async function requireAdmin(req, res, next) {
  try {
    const admin = await resolveAdmin(req);
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    req.admin = admin;
    next();
  } catch (error) {
    console.error('Auth check failed:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong' });
  }
}
