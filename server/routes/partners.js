import express from 'express';
import crypto from 'crypto';
import CommunityProfile from '../models/CommunityProfile.js';
import BenefitClaim from '../models/BenefitClaim.js';
import { MemberSession } from '../models/MemberAuth.js';
import { resolveAdmin, bearerToken } from '../utils/adminAccess.js';
import { findBenefit } from '../../src/data/partners.js';
import { SITE_URL } from '../utils/email.js';

// Partners + member benefits. Mirror of api/partners/[action].js (the Vercel
// deployment); this is what the local express server serves.
const router = express.Router();

// Unambiguous alphabet — no O/0, I/1, so a code read over the phone survives.
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 8; // 32^8 ≈ 1.1e12 — not guessable at any useful rate
const MAX_CODE_ATTEMPTS = 5;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Each partner marks codes redeemed with their own key, handed to their staff as
// ?k= on the verify link and held in env as PARTNER_VERIFY_KEY_<SLUG> (never in
// src/data/partners.js — that module is bundled into the client). Scoped per
// partner so one partner's link can only burn codes issued against that partner.
// Read-only verification never needs a key.
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
  const token = bearerToken(req);
  if (!token) return null;

  const session = await MemberSession.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
  if (session) {
    const profile = await CommunityProfile.findById(session.profileId);
    return profile && profile.status === 'approved' ? profile : null;
  }

  const admin = await resolveAdmin(req);
  if (!admin) return null;
  return CommunityProfile.findOne({ email: admin.email, status: 'approved' });
}

const claimSummary = (claim) => ({
  benefitId: claim.benefitId,
  code: claim.code,
  status: claim.status,
  issuedAt: claim.createdAt,
  redeemedAt: claim.redeemedAt,
  verifyCount: claim.verifyCount,
});

// GET /api/partners/list
// Just this member's codes. The catalog is a static import on both sides, so
// there's no reason to send it over the wire.
router.get('/list', async (req, res) => {
  try {
    const member = await findMemberSession(req);
    if (!member) {
      return res.json({ success: true, memberView: false, claims: [] });
    }

    const claims = await BenefitClaim.find({ profileId: member._id }).sort({ createdAt: -1 });
    return res.json({
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
  } catch (error) {
    console.error('❌ Partner list error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/partners/claim
// Idempotent: a member always gets the same code back for a given benefit, so
// re-claiming from another device doesn't mint a second one.
router.post('/claim', async (req, res) => {
  try {
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
      return res.json({ success: true, claim: claimSummary(existing), created: false });
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
        if (raced) return res.json({ success: true, claim: claimSummary(raced), created: false });
      }
    }

    return res.status(500).json({ success: false, message: 'Could not issue a code. Please try again.' });
  } catch (error) {
    console.error('❌ Benefit claim error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// Shared resolution for both verify verbs.
async function loadClaimForVerify(code) {
  const codeKey = normalizeCode(code);
  if (!codeKey) return { error: { status: 400, message: 'Missing code.' } };

  const claim = await BenefitClaim.findOne({ codeKey });
  if (!claim) {
    return { error: { status: 404, valid: false, reason: 'not-found', message: 'No ITC benefit code matches that.' } };
  }

  const profile = await CommunityProfile.findById(claim.profileId);
  const match = findBenefit(claim.benefitId);
  const benefit = match?.benefit || null;
  const memberActive = !!profile && profile.status === 'approved';

  // First failing condition wins — the partner sees one clear reason.
  let reason = 'ok';
  if (claim.status === 'revoked') reason = 'revoked';
  else if (claim.status === 'redeemed') reason = 'redeemed';
  else if (!memberActive) reason = 'member-inactive';
  else if (!benefit || !benefit.active) reason = 'benefit-inactive';

  return {
    claim,
    profile,
    benefit,
    partnerName: match?.partner.name || claim.partnerSlug,
    memberActive,
    reason,
    valid: reason === 'ok',
    // The key that can burn this code belongs to the partner who issued it.
    expectedKey: partnerVerifyKey(claim.partnerSlug),
  };
}

// GET /api/partners/verify?code=<code>
// The handshake. Public on purpose: partner staff open it with nothing but the
// code the member gave them. It answers one question — "is this a current ITC
// member, and is this code good?" — and reveals only what's needed to match the
// code to the person standing there.
router.get('/verify', async (req, res) => {
  try {
    const result = await loadClaimForVerify(req.query.code);
    if (result.error) {
      const { status, ...body } = result.error;
      return res.status(status).json({ success: false, ...body });
    }

    const { claim, profile, benefit, partnerName, memberActive, reason, valid, expectedKey } = result;

    // Telemetry only — a lookup is not a redemption.
    claim.verifyCount += 1;
    claim.lastVerifiedAt = new Date();
    await claim.save();

    return res.json({
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
  } catch (error) {
    console.error('❌ Benefit verify error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/partners/verify?code=<code> — burn a one-time code.
router.post('/verify', async (req, res) => {
  try {
    // The claim has to load first: which key is the right one depends on which
    // partner issued the code.
    const result = await loadClaimForVerify(req.query.code || req.body?.code);
    if (result.error) {
      const { status, ...body } = result.error;
      return res.status(status).json({ success: false, ...body });
    }

    const { claim, benefit, partnerName, reason, valid, expectedKey } = result;

    // Marking a code redeemed changes state, so it needs that partner's own key
    // (or an ITC admin session, for fixing things by hand). Another partner's key
    // is simply the wrong key here — no cross-partner burns.
    if (!keyMatches(req.body?.key, expectedKey) && !(await resolveAdmin(req))) {
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

    return res.json({ success: true, redeemedAt: claim.redeemedAt, message: 'Code marked as redeemed.' });
  } catch (error) {
    console.error('❌ Benefit redeem error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

export default router;
