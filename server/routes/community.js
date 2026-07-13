import express from 'express';
import crypto from 'crypto';
import CommunityProfile from '../models/CommunityProfile.js';
import EmailClaimRequest from '../models/EmailClaimRequest.js';
import { AdminSession } from '../models/AdminAuth.js';
import { sendEmail, magicLinkHtml, SITE_URL } from '../utils/email.js';

const router = express.Router();

const MANAGE_TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutes
const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000; // 60 minutes
const EDITABLE_FIELDS = ['firstName', 'lastName', 'linkedIn', 'profilePic', 'profession', 'company', 'bio'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function findProfileByToken(token) {
  if (!token) return null;
  return CommunityProfile.findOne({
    manageTokenHash: sha256(token),
    manageTokenExpiry: { $gt: new Date() },
  });
}

async function isAuthorized(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;
  const session = await AdminSession.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
  return !!session;
}

async function requireAdmin(req, res, next) {
  try {
    if (!(await isAuthorized(req))) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    next();
  } catch (error) {
    console.error('Auth check failed:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong' });
  }
}

// Applies the effects of accessing a profile via a valid magic link: verifies
// the email, marks it claimed, and (for a seeded-but-unconsented profile)
// records consent and publishes it. New self-submissions ('pending') stay
// pending until an admin approves.
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

/**
 * POST /api/community/submit — submit a new community member profile (pending).
 * New profiles require admin approval; email verification only proves ownership.
 */
router.post('/submit', async (req, res) => {
  try {
    const { firstName, lastName, email, linkedIn, profilePic, profession, company, bio } = req.body;

    if (!firstName || !lastName || !email || !linkedIn || !profilePic || !profession) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const existingProfile = await CommunityProfile.findOne({ email: email.toLowerCase() });
    if (existingProfile) {
      return res.status(409).json({
        success: false,
        message: 'A profile with this email already exists. Use the manage link to edit it.',
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
      status: 'pending',
      manageTokenHash: sha256(verifyToken),
      manageTokenExpiry: new Date(Date.now() + MANAGE_TOKEN_TTL_MS),
    });

    await profile.save();
    console.log(`✅ New community profile submitted (pending): ${profile.email}`);

    let emailSent = false;
    try {
      emailSent = await sendEmail({
        to: profile.email,
        subject: 'Verify your ITC community profile',
        html: magicLinkHtml({
          heading: 'Verify your profile — Italian Tech Club NYC',
          intro: `Ciao ${profile.firstName}! Click the link below to verify your email. Your profile will go live once our team approves it.`,
          link: `${SITE_URL}/community/manage?token=${verifyToken}`,
          buttonLabel: 'Verify My Email',
        }),
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Profile submitted! Verify your email, then our team will review and approve it.',
      emailSent,
      profileId: profile._id,
    });
  } catch (error) {
    console.error('❌ Error submitting community profile:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A profile with this email already exists.' });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

/**
 * GET /api/community/profiles — public list (approved only, no emails)
 */
router.get('/profiles', async (req, res) => {
  try {
    const profiles = await CommunityProfile.find({ status: 'approved' })
      .select('firstName lastName linkedIn profilePic profession company bio isFounder createdAt')
      .sort({ createdAt: -1 });
    res.json({ success: true, profiles, count: profiles.length });
  } catch (error) {
    console.error('Error fetching community profiles:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profiles' });
  }
});

/**
 * POST /api/community/manage
 *  - no token:  { email }              → email a manage link
 *  - ?token=:   { action: 'change-email', newEmail } → start a primary-email change
 */
router.post('/manage', async (req, res) => {
  try {
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

      await sendEmail({
        to: newEmail,
        subject: 'Confirm your new ITC profile email',
        html: magicLinkHtml({
          heading: 'Confirm your new email — Italian Tech Club NYC',
          intro: `Ciao ${profile.firstName}! Click below to make this address the primary email for your community profile. The link expires in 60 minutes.`,
          link: `${SITE_URL}/community/manage?emailToken=${emailToken}`,
          buttonLabel: 'Confirm New Email',
        }),
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

    await sendEmail({
      to: profile.email,
      subject: 'Manage your ITC community profile',
      html: magicLinkHtml({
        heading: 'Manage your profile — Italian Tech Club NYC',
        intro: `Ciao ${profile.firstName}! Click the link below to claim or edit your community profile. The link expires in 60 minutes.`,
        link: `${SITE_URL}/community/manage?token=${token}`,
        buttonLabel: 'Manage My Profile',
      }),
    });

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error('❌ Manage link error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

/**
 * GET /api/community/manage
 *  - ?emailToken= : confirm a pending primary-email change
 *  - ?token=      : fetch own profile (claims/verifies it on first use)
 */
router.get('/manage', async (req, res) => {
  try {
    // Confirm a primary-email change
    if (req.query.emailToken) {
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

      return res.json({ success: true, emailChanged: true, email: profile.email });
    }

    const profile = await findProfileByToken(req.query.token);
    if (!profile) {
      return res.status(401).json({ success: false, message: 'This link is invalid or has expired. Request a new one.' });
    }

    await applyClaim(profile);

    return res.json({
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
  } catch (error) {
    console.error('❌ Manage fetch error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

/**
 * PUT /api/community/manage?token= — update own profile
 */
router.put('/manage', async (req, res) => {
  try {
    const profile = await findProfileByToken(req.query.token);
    if (!profile) {
      return res.status(401).json({ success: false, message: 'This link is invalid or has expired. Request a new one.' });
    }

    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        profile[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
      }
    }
    await applyClaim(profile);
    await profile.save();

    return res.json({ success: true, message: 'Profile updated!' });
  } catch (error) {
    console.error('❌ Manage update error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

/**
 * DELETE /api/community/manage?token= — delete own profile
 */
router.delete('/manage', async (req, res) => {
  try {
    const profile = await findProfileByToken(req.query.token);
    if (!profile) {
      return res.status(401).json({ success: false, message: 'This link is invalid or has expired. Request a new one.' });
    }
    if (profile.isFounder) {
      return res.status(403).json({ success: false, message: 'Founder profiles cannot be deleted.' });
    }
    await profile.deleteOne();
    return res.json({ success: true, message: 'Profile deleted.' });
  } catch (error) {
    console.error('❌ Manage delete error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

/**
 * POST /api/community/claim-request
 * An existing member who lost access to their registered email asks to take
 * ownership of their profile with a new email. Admin approves in the panel.
 */
router.post('/claim-request', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('❌ Claim request error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

/**
 * GET /api/community/admin — pending profiles + email-claim requests (admin only)
 */
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const pendingProfiles = await CommunityProfile.find({ status: 'pending' })
      .select('firstName lastName email linkedIn profilePic profession company bio emailVerified createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const claimRequests = await EmailClaimRequest.find({ status: 'pending' })
      .populate('candidateProfileId', 'firstName lastName email status')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, pendingProfiles, claimRequests });
  } catch (error) {
    console.error('❌ Admin community fetch error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load community management data' });
  }
});

/**
 * POST /api/community/admin — approve/reject profiles and claim requests (admin only)
 */
router.post('/admin', requireAdmin, async (req, res) => {
  try {
    const { action } = req.body || {};

    if (action === 'approve-profile') {
      const profile = await CommunityProfile.findById(req.body.profileId);
      if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
      profile.status = 'approved';
      await profile.save();
      return res.json({ success: true, message: 'Profile approved.' });
    }

    if (action === 'reject-profile') {
      const profile = await CommunityProfile.findByIdAndDelete(req.body.profileId);
      if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
      return res.json({ success: true, message: 'Profile rejected.' });
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

      // Let the requester know they can now sign in with the new email
      await sendEmail({
        to: request.requestedEmail,
        subject: 'Your ITC profile claim was approved',
        html: magicLinkHtml({
          heading: 'Claim approved — Italian Tech Club NYC',
          intro: `Ciao ${target.firstName}! Your request to use this email for your community profile was approved. Click below to sign in and manage your profile.`,
          link: `${SITE_URL}/community/manage`,
          buttonLabel: 'Sign in to My Profile',
        }),
      });

      return res.json({ success: true, message: 'Claim approved and email reassigned.' });
    }

    if (action === 'reject-claim') {
      const request = await EmailClaimRequest.findById(req.body.requestId);
      if (!request || request.status !== 'pending') {
        return res.status(404).json({ success: false, message: 'Claim request not found' });
      }
      request.status = 'rejected';
      request.resolvedAt = new Date();
      await request.save();
      return res.json({ success: true, message: 'Claim request rejected.' });
    }

    return res.status(400).json({ success: false, message: 'Unknown action' });
  } catch (error) {
    console.error('❌ Admin community action error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

export default router;
