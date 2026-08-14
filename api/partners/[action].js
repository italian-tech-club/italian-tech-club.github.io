import mongoose from 'mongoose';
import crypto from 'crypto';
import { findBenefit } from '../../src/data/partners.js';

/**
 * Partners + member benefits API. One dynamic route, three actions (Vercel Hobby
 * caps a deployment at 12 serverless functions):
 *   GET  /api/partners/list           (this member's codes; the catalog ships with the bundle)
 *   POST /api/partners/claim          (member session required; idempotent)
 *   GET  /api/partners/verify?code=   (public: partner-side membership check)
 *   POST /api/partners/verify?code=   (partner key required: mark a one-time code redeemed)
 * The segment after /partners/ arrives as req.query.action.
 * (Mirror of server/routes/partners.js used by the local express server.)
 */

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

// Schema definitions (must match server/models/*). Only the fields this route
// reads are declared on the profile — mongoose ignores the rest on read.
const communityProfileSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  profession: { type: String, trim: true },
  company: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['unclaimed', 'pending', 'approved', 'inactive'], default: 'pending' },
  memberNumber: { type: Number, default: null },
  cardSlug: { type: String, default: null },
  isFounder: { type: Boolean, default: false },
}, {
  timestamps: true,
  collection: 'community_profiles',
});

const memberSessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityProfile', required: true },
  email: { type: String, required: true, lowercase: true },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: true,
  collection: 'member_sessions',
});

const adminSessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  email: { type: String, required: true, lowercase: true },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: true,
  collection: 'admin_sessions',
});

const benefitClaimSchema = new mongoose.Schema({
  benefitId: { type: String, required: true },
  partnerSlug: { type: String, required: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityProfile', required: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  codeKey: { type: String, required: true, unique: true, uppercase: true, trim: true },
  status: { type: String, enum: ['active', 'redeemed', 'revoked'], default: 'active' },
  redeemedAt: { type: Date, default: null },
  redeemedNote: { type: String, maxlength: 200, default: '' },
  verifyCount: { type: Number, default: 0 },
  lastVerifiedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'benefit_claims',
});
benefitClaimSchema.index({ profileId: 1, benefitId: 1 }, { unique: true });

const CommunityProfile = mongoose.models.CommunityProfile || mongoose.model('CommunityProfile', communityProfileSchema);
const MemberSession = mongoose.models.MemberSession || mongoose.model('MemberSession', memberSessionSchema);
const AdminSession = mongoose.models.AdminSession || mongoose.model('AdminSession', adminSessionSchema);
const BenefitClaim = mongoose.models.BenefitClaim || mongoose.model('BenefitClaim', benefitClaimSchema);

const SITE_URL = process.env.SITE_URL || 'https://italiantechclubnyc.com';
// Shared secret handed to partner staff, appended to their verify link as ?k=.
// Read-only verification never needs it; only marking a code redeemed does.
// Unambiguous alphabet — no O/0, I/1, so a code read over the phone survives.
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 8; // 32^8 ≈ 1.1e12 — not guessable at any useful rate
const MAX_CODE_ATTEMPTS = 5;

// Mirrors the allowlist in /api/admin/auth — an admin session unlocks the member
// view too (admins are members).
const ADMIN_EMAILS = [
  'giuseppe.concialdi@gmail.com',
  'noemi.gozzi@gmail.com',
  'enrico.fontana1997@gmail.com',
  'michela@tarantino.email',
  'nicole.bizzini@gmail.com',
];

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Each partner marks codes redeemed with their own key, held in env as
// PARTNER_VERIFY_KEY_<SLUG> (never in src/data/partners.js — that module is
// bundled into the client). Scoped per partner so one partner's link can only
// burn codes issued against that same partner.
const partnerVerifyKey = (slug) =>
  process.env[`PARTNER_VERIFY_KEY_${String(slug).toUpperCase().replace(/[^A-Z0-9]/g, '_')}`] || '';

// Constant-time compare over digests, so neither the key nor its length leaks
// through timing (timingSafeEqual throws on a length mismatch).
const keyMatches = (supplied, expected) => {
  if (!expected) return false;
  return crypto.timingSafeEqual(
    crypto.createHash('sha256').update(String(supplied ?? '')).digest(),
    crypto.createHash('sha256').update(expected).digest(),
  );
};

// Everything but letters and digits is decoration — strip it so a partner can
// type the code however they received it.
const normalizeCode = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function randomCodeBody() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

// ITC-TIH-7QK9-AX2M — prefix names the club, then the partner, then the secret.
function formatCode(partner, body) {
  const tag = String(partner.shortName || partner.slug).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return { code: `ITC-${tag}-${body.slice(0, 4)}-${body.slice(4)}`, codeKey: `ITC${tag}${body}` };
}

// g*******@withrebar.ai — enough for a partner to match against the email on the
// application in front of them, without handing them the address.
function maskEmail(email) {
  const [user, domain] = String(email || '').split('@');
  if (!user || !domain) return '';
  return `${user[0]}${'*'.repeat(Math.max(user.length - 1, 3))}@${domain}`;
}

// Resolve the signed-in member from the Authorization header. Only approved
// profiles count. An admin session resolves to that admin's own profile, so
// signing in at /admin also unlocks the member view here.
async function findMemberSession(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const tokenHash = sha256(token);
  const now = new Date();

  const session = await MemberSession.findOne({ tokenHash, expiresAt: { $gt: now } });
  if (session) {
    const profile = await CommunityProfile.findById(session.profileId);
    return profile && profile.status === 'approved' ? profile : null;
  }

  const adminSession = await AdminSession.findOne({ tokenHash, expiresAt: { $gt: now } });
  if (!adminSession) return null;
  return CommunityProfile.findOne({ email: adminSession.email, status: 'approved' });
}

// Admin rights from either session type, same rule as the community API.
async function isAdmin(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;
  const tokenHash = sha256(token);
  const now = new Date();
  if (await AdminSession.findOne({ tokenHash, expiresAt: { $gt: now } })) return true;
  const memberSession = await MemberSession.findOne({ tokenHash, expiresAt: { $gt: now } });
  return !!memberSession && ADMIN_EMAILS.includes(memberSession.email);
}

const claimSummary = (claim) => ({
  benefitId: claim.benefitId,
  code: claim.code,
  status: claim.status,
  issuedAt: claim.createdAt,
  redeemedAt: claim.redeemedAt,
  verifyCount: claim.verifyCount,
});

// ---- GET /api/partners/list ----
// Just this member's codes. The catalog is a static import on both sides, so
// there's no reason to send it over the wire.
async function handleList(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const member = await findMemberSession(req);
  if (!member) {
    return res.status(200).json({ success: true, memberView: false, claims: [] });
  }

  const claims = await BenefitClaim.find({ profileId: member._id }).sort({ createdAt: -1 });
  return res.status(200).json({
    success: true,
    memberView: true,
    member: {
      firstName: member.firstName,
      lastName: member.lastName,
      memberNumber: member.memberNumber,
      maskedEmail: maskEmail(member.email),
    },
    claims: claims.map(claimSummary),
  });
}

// ---- POST /api/partners/claim ----
// Idempotent: a member always gets the same code back for a given benefit, so
// re-claiming from another device doesn't mint a second one.
async function handleClaim(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const member = await findMemberSession(req);
  if (!member) {
    return res.status(401).json({ success: false, message: 'Sign in as a member to unlock partner benefits.' });
  }

  const benefitId = String(req.body?.benefitId || '').trim();
  const match = findBenefit(benefitId);
  if (!match) return res.status(404).json({ success: false, message: 'Unknown benefit.' });
  if (!match.benefit.active) {
    return res.status(410).json({ success: false, message: 'This benefit is no longer available.' });
  }

  const existing = await BenefitClaim.findOne({ profileId: member._id, benefitId });
  if (existing) {
    return res.status(200).json({ success: true, claim: claimSummary(existing), created: false });
  }

  // Retry on the (vanishingly unlikely) collision rather than 500-ing.
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const { code, codeKey } = formatCode(match.partner, randomCodeBody());
    try {
      const claim = await BenefitClaim.create({
        benefitId,
        partnerSlug: match.partner.slug,
        profileId: member._id,
        code,
        codeKey,
      });
      return res.status(201).json({ success: true, claim: claimSummary(claim), created: true });
    } catch (error) {
      // 11000 on (profileId, benefitId) means a concurrent claim won the race —
      // return that one. On the code index, loop and draw again.
      if (error.code !== 11000) throw error;
      const raced = await BenefitClaim.findOne({ profileId: member._id, benefitId });
      if (raced) return res.status(200).json({ success: true, claim: claimSummary(raced), created: false });
    }
  }

  return res.status(500).json({ success: false, message: 'Could not issue a code. Please try again.' });
}

// ---- GET|POST /api/partners/verify?code=<code> ----
// The handshake. Public on purpose: partner staff open it with nothing but the
// code the member gave them. It answers one question — "is this a current ITC
// member, and is this code good?" — and reveals only what's needed to match the
// code to the person standing there.
async function handleVerify(req, res) {
  const codeKey = normalizeCode(req.query.code || req.body?.code);
  if (!codeKey) return res.status(400).json({ success: false, message: 'Missing code.' });

  const claim = await BenefitClaim.findOne({ codeKey });
  if (!claim) {
    return res.status(404).json({ success: false, valid: false, reason: 'not-found', message: 'No ITC benefit code matches that.' });
  }

  const [profile, match] = await Promise.all([
    CommunityProfile.findById(claim.profileId),
    Promise.resolve(findBenefit(claim.benefitId)),
  ]);

  const partnerName = match?.partner.name || claim.partnerSlug;
  const benefit = match?.benefit;
  const memberActive = !!profile && profile.status === 'approved';

  // First failing condition wins — the partner sees one clear reason.
  let reason = 'ok';
  if (claim.status === 'revoked') reason = 'revoked';
  else if (claim.status === 'redeemed') reason = 'redeemed';
  else if (!memberActive) reason = 'member-inactive';
  else if (!benefit || !benefit.active) reason = 'benefit-inactive';

  const valid = reason === 'ok';
  // The key that can burn this code belongs to the partner who issued it.
  const expectedKey = partnerVerifyKey(claim.partnerSlug);

  if (req.method === 'GET') {
    // Telemetry only — a lookup is not a redemption.
    claim.verifyCount += 1;
    claim.lastVerifiedAt = new Date();
    await claim.save();

    return res.status(200).json({
      success: true,
      valid,
      reason,
      code: claim.code,
      partner: { name: partnerName, slug: claim.partnerSlug },
      benefit: benefit
        ? { title: benefit.title, discount: benefit.discount, oneTime: benefit.oneTime }
        : { title: 'Retired benefit', discount: '', oneTime: true },
      member: memberActive
        ? {
          fullName: `${profile.firstName} ${profile.lastName}`,
          memberNumber: profile.memberNumber,
          memberSince: profile.createdAt ? new Date(profile.createdAt).getUTCFullYear() : null,
          maskedEmail: maskEmail(profile.email),
          cardUrl: profile.cardSlug ? `${SITE_URL}/m/${profile.cardSlug}` : null,
        }
        : null,
      issuedAt: claim.createdAt,
      redeemedAt: claim.redeemedAt,
      redeemedNote: claim.redeemedNote,
      // Reusable benefits are never marked off; there is nothing to burn.
      canMarkRedeemed: valid && !!benefit?.oneTime && !!expectedKey,
      // Tells the UI whether to render the redeem form at all.
      redeemConfigured: !!expectedKey,
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  // Marking a code redeemed changes state, so it needs that partner's own key
  // (or an ITC admin session, for fixing things by hand). Another partner's key
  // is simply the wrong key here — no cross-partner burns.
  if (!keyMatches(req.body?.key, expectedKey) && !(await isAdmin(req))) {
    return res.status(401).json({
      success: false,
      message: `This key doesn't match ${partnerName}. Use the verify link ${partnerName} was given.`,
    });
  }
  if (!valid) {
    return res.status(409).json({ success: false, valid: false, reason, message: 'This code is not currently valid.' });
  }
  if (!benefit.oneTime) {
    return res.status(400).json({ success: false, message: 'This benefit is reusable — there is nothing to mark off.' });
  }

  claim.status = 'redeemed';
  claim.redeemedAt = new Date();
  claim.redeemedNote = String(req.body?.note || '').trim().slice(0, 200);
  await claim.save();

  return res.status(200).json({ success: true, redeemedAt: claim.redeemedAt, message: 'Code marked as redeemed.' });
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

    switch (req.query.action) {
      case 'list': return await handleList(req, res);
      case 'claim': return await handleClaim(req, res);
      case 'verify': return await handleVerify(req, res);
      default: return res.status(404).json({ success: false, message: 'Not found' });
    }
  } catch (error) {
    console.error('Error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
}
