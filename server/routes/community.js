import express from 'express';
import crypto from 'crypto';
import CommunityProfile from '../models/CommunityProfile.js';
import EmailClaimRequest from '../models/EmailClaimRequest.js';
import { AdminSession } from '../models/AdminAuth.js';
import { MemberSession } from '../models/MemberAuth.js';
import { ConnectRequest } from '../models/ConnectRequest.js';
import { ProfileView } from '../models/ProfileView.js';
import { nextSequence } from '../models/Counter.js';
import { sendEmail, sendEmailBatch, magicLinkHtml, campaignHtml, fillTemplate, SITE_URL } from '../utils/email.js';

const router = express.Router();

const MANAGE_TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutes
const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000; // 60 minutes
const APPROVAL_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — sign-in link in the acceptance email
const MEMBER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CONNECT_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_PENDING_CONNECTS = 3; // outgoing pending requests per member
// Where new-application notifications are sent (the club's shared inbox).
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || 'ciao@italiantechclubnyc.com';
const EDITABLE_FIELDS = ['firstName', 'lastName', 'linkedIn', 'profilePic', 'profession', 'company', 'bio', 'roles', 'lookingFor', 'openToConnect'];
// Fields members see about each other in the directory.
const MEMBER_VIEW_FIELDS = 'firstName lastName linkedIn profilePic profession company bio isFounder roles lookingFor openToConnect memberNumber createdAt';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Defaults for the admin claim-email campaign (editable per-send in the UI).
const CLAIM_BUTTON_LABEL = 'Claim & Sign In';
const CLAIM_EMAIL_BATCH_SIZE = 100; // Resend batch endpoint hard limit
const DEFAULT_CLAIM_SUBJECT = 'Claim your Italian Tech Club profile 🇮🇹';
const DEFAULT_CLAIM_BODY = `Ciao {{firstName}}!

Your Italian Tech Club NYC profile is ready. We've set it up from our community roster — claim it to make it live, browse fellow members, and start connecting.

Click below to sign in and claim your profile. The link expires in 7 days.`;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Split an array into chunks of at most `size`.
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

async function findProfileByToken(token) {
  if (!token) return null;
  return CommunityProfile.findOne({
    manageTokenHash: sha256(token),
    manageTokenExpiry: { $gt: new Date() },
  });
}

// Resolve the member session from the Authorization header. Only approved
// profiles count as "inside" — a pending applicant's session (if any) doesn't
// unlock the directory.
async function findMemberSession(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const session = await MemberSession.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  const profile = await CommunityProfile.findById(session.profileId);
  if (!profile || profile.status !== 'approved') return null;
  return { session, profile };
}

// Approved members get a sequential member number and an invite code, assigned
// once (on approval, claim, or first sign-in after this feature shipped).
async function ensureMemberExtras(profile) {
  if (profile.status !== 'approved') return;
  let changed = false;
  if (profile.memberNumber == null) {
    profile.memberNumber = await nextSequence('memberNumber');
    changed = true;
  }
  if (!profile.inviteCode) {
    profile.inviteCode = crypto.randomBytes(6).toString('base64url');
    changed = true;
  }
  if (changed) await profile.save();
}

async function createMemberSession(profile) {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + MEMBER_SESSION_TTL_MS);
  await MemberSession.create({
    tokenHash: sha256(sessionToken),
    profileId: profile._id,
    email: profile.email,
    expiresAt,
  });
  return { sessionToken, expiresAt };
}

// Manage endpoints accept either a fresh magic-link token (claim/sign-in) or
// an existing member session (returning member editing later). Returns
// { profile, viaToken } or null.
async function resolveManageAuth(req) {
  if (req.query.token) {
    const profile = await findProfileByToken(req.query.token);
    return profile ? { profile, viaToken: true } : null;
  }
  const member = await findMemberSession(req);
  return member ? { profile: member.profile, viaToken: false } : null;
}

// Most-viewed profile of the day (🔥 badge). Falls back to yesterday while
// today has no views yet, so the badge is always someone's.
async function findHotProfileId() {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const day of [today, yesterday]) {
    const top = await ProfileView.aggregate([
      { $match: { day } },
      { $group: { _id: '$profileId', views: { $sum: 1 } } },
      { $sort: { views: -1 } },
      { $limit: 1 },
    ]);
    if (top.length) return top[0]._id;
  }
  return null;
}

const memberSummary = (profile) => ({
  profileId: profile._id,
  firstName: profile.firstName,
  lastName: profile.lastName,
  profilePic: profile.profilePic,
  isFounder: profile.isFounder,
  memberNumber: profile.memberNumber,
});

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
    const { firstName, lastName, email, linkedIn, profilePic, profession, company, bio, roles, lookingFor, ref } = req.body;

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

    // Referral: an invite link (/community/join?ref=<code>) ties the applicant
    // to the inviting member — surfaced to admins for faster approval.
    let referredBy = null;
    if (ref && typeof ref === 'string') {
      const inviter = await CommunityProfile.findOne({ inviteCode: ref.trim(), status: 'approved' }).select('_id');
      referredBy = inviter?._id || null;
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
      roles: Array.isArray(roles) ? roles : [],
      lookingFor: Array.isArray(lookingFor) ? lookingFor : [],
      referredBy,
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

    // Notify the club inbox so an admin can review + approve the new applicant.
    try {
      await sendEmail({
        to: ADMIN_NOTIFY_EMAIL,
        subject: `New community join request: ${profile.firstName} ${profile.lastName}`,
        replyTo: profile.email,
        html: magicLinkHtml({
          heading: 'New community join request',
          intro: `${profile.firstName} ${profile.lastName} (${profile.profession}${profile.company ? ` at ${profile.company}` : ''}) asked to join the community.<br/>Email: ${profile.email}<br/>LinkedIn: ${profile.linkedIn}${profile.bio ? `<br/>Bio: ${profile.bio}` : ''}<br/><br/>Review and approve them in the admin dashboard.`,
          link: `${SITE_URL}/admin`,
          buttonLabel: 'Review in Admin',
        }),
      });
    } catch (notifyError) {
      console.error('Failed to send admin notification email:', notifyError);
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
 * GET /api/community/profiles
 *  - member session → full directory (roles, lookingFor, member numbers, ids)
 *  - anonymous     → aggregate stats + anonymized teaser (founders stay visible
 *                    as the public face; other members are first name + initial,
 *                    no photos, no links)
 */
router.get('/profiles', async (req, res) => {
  try {
    const member = await findMemberSession(req);

    if (member) {
      const [profiles, hotProfileId] = await Promise.all([
        CommunityProfile.find({ status: 'approved' })
          .select(MEMBER_VIEW_FIELDS)
          .sort({ createdAt: -1 }),
        findHotProfileId(),
      ]);
      return res.json({
        success: true,
        memberView: true,
        viewer: memberSummary(member.profile),
        hotProfileId,
        profiles,
        count: profiles.length,
      });
    }

    const profiles = await CommunityProfile.find({ status: 'approved' })
      .select('firstName lastName profilePic profession isFounder roles lookingFor createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const stats = { total: profiles.length, founders: 0, roles: {}, lookingFor: {} };
    for (const p of profiles) {
      if (p.isFounder) stats.founders += 1;
      for (const r of p.roles || []) stats.roles[r] = (stats.roles[r] || 0) + 1;
      for (const l of p.lookingFor || []) stats.lookingFor[l] = (stats.lookingFor[l] || 0) + 1;
    }

    const teaser = profiles.map((p) => p.isFounder
      ? { firstName: p.firstName, lastName: p.lastName, profilePic: p.profilePic, profession: p.profession, isFounder: true, createdAt: p.createdAt }
      : { firstName: p.firstName, lastInitial: p.lastName?.[0] || '', profession: p.profession, lookingFor: p.lookingFor || [], isFounder: false, createdAt: p.createdAt });

    return res.json({ success: true, memberView: false, count: profiles.length, stats, teaser });
  } catch (error) {
    console.error('Error fetching community profiles:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profiles' });
  }
});

/**
 * GET    /api/community/session — validate the current member session
 * DELETE /api/community/session — sign out (revoke the session)
 */
router.get('/session', async (req, res) => {
  try {
    const member = await findMemberSession(req);
    if (!member) return res.status(401).json({ success: false, message: 'Not signed in' });
    return res.json({ success: true, member: memberSummary(member.profile) });
  } catch (error) {
    console.error('❌ Session check error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

router.delete('/session', async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (token) await MemberSession.deleteOne({ tokenHash: sha256(token) });
    return res.json({ success: true });
  } catch (error) {
    console.error('❌ Sign out error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
});

/**
 * POST /api/community/manage
 *  - no token:  { email }              → email a manage link
 *  - ?token=:   { action: 'change-email', newEmail } → start a primary-email change
 */
router.post('/manage', async (req, res) => {
  try {
    // Primary-email change (manage token or member session)
    if (req.body?.action === 'change-email') {
      const auth = await resolveManageAuth(req);
      if (!auth) {
        return res.status(401).json({ success: false, message: 'This link is invalid or has expired. Request a new one.' });
      }
      const profile = auth.profile;

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
      subject: 'Your ITC community sign-in link',
      html: magicLinkHtml({
        heading: 'Sign in — Italian Tech Club NYC',
        intro: `Ciao ${profile.firstName}! Click the link below to sign in to the community — browse members, connect, and edit your profile. The link expires in 60 minutes.`,
        link: `${SITE_URL}/community/manage?token=${token}`,
        buttonLabel: 'Sign In',
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

    const auth = await resolveManageAuth(req);
    if (!auth) {
      return res.status(401).json({ success: false, message: 'This link is invalid or has expired. Request a new one.' });
    }
    const { profile, viaToken } = auth;

    if (viaToken) await applyClaim(profile);
    await ensureMemberExtras(profile);

    // A magic link doubles as sign-in: approved members get a browser session
    // so the directory unlocks. Session-based visits already have one.
    let session = null;
    if (viaToken && profile.status === 'approved') {
      session = await createMemberSession(profile);
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const viewsLast7Days = await ProfileView.countDocuments({ profileId: profile._id, viewedAt: { $gte: since } });

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
        roles: profile.roles,
        lookingFor: profile.lookingFor,
        openToConnect: profile.openToConnect,
        memberNumber: profile.memberNumber,
        inviteCode: profile.inviteCode,
      },
      stats: { totalViews: profile.viewCount || 0, viewsLast7Days },
      ...(session ? {
        sessionToken: session.sessionToken,
        sessionExpiresAt: session.expiresAt,
        member: memberSummary(profile),
      } : {}),
    });
  } catch (error) {
    console.error('❌ Manage fetch error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

/**
 * PUT /api/community/manage — update own profile (token or member session)
 */
router.put('/manage', async (req, res) => {
  try {
    const auth = await resolveManageAuth(req);
    if (!auth) {
      return res.status(401).json({ success: false, message: 'This link is invalid or has expired. Request a new one.' });
    }
    const { profile, viaToken } = auth;

    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        profile[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
      }
    }
    if (viaToken) await applyClaim(profile);
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
 * DELETE /api/community/manage — delete own profile (token or member session)
 */
router.delete('/manage', async (req, res) => {
  try {
    const auth = await resolveManageAuth(req);
    if (!auth) {
      return res.status(401).json({ success: false, message: 'This link is invalid or has expired. Request a new one.' });
    }
    const profile = auth.profile;
    if (profile.isFounder) {
      return res.status(403).json({ success: false, message: 'Founder profiles cannot be deleted.' });
    }
    await MemberSession.deleteMany({ profileId: profile._id });
    await profile.deleteOne();
    return res.json({ success: true, message: 'Profile deleted.' });
  } catch (error) {
    console.error('❌ Manage delete error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

/**
 * POST /api/community/connect
 *  - member session, no token: { toProfileId, message } → create a request and
 *    email the target an accept/decline link (double opt-in; emails stay
 *    hidden until acceptance)
 *  - ?token=: { decision: 'accept' | 'decline' } → resolve it
 * GET /api/community/connect?token= — request details for the decision page
 */
router.post('/connect', async (req, res) => {
  try {
    // Resolve a request via the emailed decision link
    if (req.query.token) {
      const request = await ConnectRequest.findOne({
        decisionTokenHash: sha256(req.query.token),
        decisionTokenExpiry: { $gt: new Date() },
        status: 'pending',
      });
      if (!request) {
        return res.status(401).json({ success: false, message: 'This link is invalid, expired, or already used.' });
      }

      const decision = req.body?.decision;
      if (decision !== 'accept' && decision !== 'decline') {
        return res.status(400).json({ success: false, message: 'Decision must be accept or decline.' });
      }

      const [from, to] = await Promise.all([
        CommunityProfile.findById(request.fromProfileId),
        CommunityProfile.findById(request.toProfileId),
      ]);

      request.status = decision === 'accept' ? 'accepted' : 'declined';
      request.resolvedAt = new Date();
      request.decisionTokenHash = null;
      request.decisionTokenExpiry = null;
      await request.save();

      if (decision === 'accept' && from && to) {
        // Intro both ways — this is the moment emails are revealed.
        await sendEmail({
          to: from.email,
          subject: `${to.firstName} accepted your connect request 🎉`,
          html: magicLinkHtml({
            heading: `You're connected with ${to.firstName} ${to.lastName}!`,
            intro: `Ciao ${from.firstName}! ${to.firstName} (${to.profession}${to.company ? ` at ${to.company}` : ''}) accepted your request. Reach out at ${to.email}${to.linkedIn ? ` or on LinkedIn: ${to.linkedIn}` : ''}.`,
            link: `mailto:${to.email}`,
            buttonLabel: `Email ${to.firstName}`,
          }),
          replyTo: to.email,
        });
        await sendEmail({
          to: to.email,
          subject: `You're now connected with ${from.firstName} ${from.lastName}`,
          html: magicLinkHtml({
            heading: `You're connected with ${from.firstName} ${from.lastName}!`,
            intro: `Ciao ${to.firstName}! You accepted ${from.firstName}'s request (${from.profession}${from.company ? ` at ${from.company}` : ''}). Reach out at ${from.email}${from.linkedIn ? ` or on LinkedIn: ${from.linkedIn}` : ''}.`,
            link: `mailto:${from.email}`,
            buttonLabel: `Email ${from.firstName}`,
          }),
          replyTo: from.email,
        });
      }

      return res.json({ success: true, decision: request.status });
    }

    // Create a new request (member session required)
    const member = await findMemberSession(req);
    if (!member) {
      return res.status(401).json({ success: false, message: 'Sign in via your manage link to connect with members.' });
    }

    const { toProfileId } = req.body || {};
    const message = (req.body?.message || '').trim().slice(0, 500);
    if (!toProfileId) {
      return res.status(400).json({ success: false, message: 'Missing target profile.' });
    }
    if (String(toProfileId) === String(member.profile._id)) {
      return res.status(400).json({ success: false, message: "That's you!" });
    }

    const target = await CommunityProfile.findById(toProfileId);
    if (!target || target.status !== 'approved') {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }
    if (!target.openToConnect) {
      return res.status(403).json({ success: false, message: 'This member is not accepting connect requests right now.' });
    }

    const pendingCount = await ConnectRequest.countDocuments({ fromProfileId: member.profile._id, status: 'pending' });
    if (pendingCount >= MAX_PENDING_CONNECTS) {
      return res.status(429).json({ success: false, message: `You can have up to ${MAX_PENDING_CONNECTS} pending requests. Wait for replies before sending more.` });
    }

    const existing = await ConnectRequest.findOne({
      fromProfileId: member.profile._id,
      toProfileId: target._id,
      status: { $in: ['pending', 'accepted'] },
    });
    if (existing) {
      const msg = existing.status === 'accepted'
        ? "You're already connected with this member."
        : 'You already have a pending request to this member.';
      return res.status(409).json({ success: false, message: msg });
    }

    const decisionToken = crypto.randomBytes(32).toString('hex');
    await ConnectRequest.create({
      fromProfileId: member.profile._id,
      toProfileId: target._id,
      message,
      decisionTokenHash: sha256(decisionToken),
      decisionTokenExpiry: new Date(Date.now() + CONNECT_TOKEN_TTL_MS),
    });

    const from = member.profile;
    await sendEmail({
      to: target.email,
      subject: `${from.firstName} ${from.lastName} wants to connect with you`,
      html: magicLinkHtml({
        heading: 'New connect request — Italian Tech Club NYC',
        intro: `Ciao ${target.firstName}! ${from.firstName} ${from.lastName} (${from.profession}${from.company ? ` at ${from.company}` : ''}) would like to connect.${message ? ` Their message: “${message}”` : ''} Accept and we'll introduce you by email — decline and they won't be notified. The link expires in 7 days.`,
        link: `${SITE_URL}/community/connect?token=${decisionToken}`,
        buttonLabel: 'View Request',
      }),
    });

    return res.status(201).json({ success: true, message: `Request sent! ${target.firstName} will get an email — if they accept, we'll introduce you.` });
  } catch (error) {
    console.error('❌ Connect error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

router.get('/connect', async (req, res) => {
  try {
    const request = await ConnectRequest.findOne({
      decisionTokenHash: sha256(req.query.token || ''),
      decisionTokenExpiry: { $gt: new Date() },
      status: 'pending',
    }).populate('fromProfileId', 'firstName lastName profilePic profession company bio isFounder roles');
    if (!request || !request.fromProfileId) {
      return res.status(401).json({ success: false, message: 'This link is invalid, expired, or already used.' });
    }
    const from = request.fromProfileId;
    return res.json({
      success: true,
      request: {
        message: request.message,
        createdAt: request.createdAt,
        from: {
          firstName: from.firstName,
          lastName: from.lastName,
          profilePic: from.profilePic,
          profession: from.profession,
          company: from.company,
          bio: from.bio,
          isFounder: from.isFounder,
          roles: from.roles,
        },
      },
    });
  } catch (error) {
    console.error('❌ Connect fetch error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

/**
 * POST /api/community/view — record a profile view (member session required).
 * Deduped per viewer per day; owners see aggregates only, never who.
 */
router.post('/view', async (req, res) => {
  try {
    const member = await findMemberSession(req);
    if (!member) return res.status(401).json({ success: false, message: 'Not signed in' });

    const { profileId } = req.body || {};
    if (!profileId || String(profileId) === String(member.profile._id)) {
      return res.json({ success: true, counted: false });
    }

    const day = new Date().toISOString().slice(0, 10);
    const result = await ProfileView.updateOne(
      { profileId, viewerProfileId: member.profile._id, day },
      { $setOnInsert: { viewedAt: new Date() } },
      { upsert: true },
    );
    if (result.upsertedCount) {
      await CommunityProfile.updateOne({ _id: profileId }, { $inc: { viewCount: 1 } });
    }
    return res.json({ success: true, counted: !!result.upsertedCount });
  } catch (error) {
    // Duplicate upsert race is fine — the view is already counted.
    if (error.code === 11000) return res.json({ success: true, counted: false });
    console.error('❌ View tracking error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
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
      .select('firstName lastName email linkedIn profilePic profession company bio emailVerified roles lookingFor referredBy createdAt')
      .populate('referredBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();

    const claimRequests = await EmailClaimRequest.find({ status: 'pending' })
      .populate('candidateProfileId', 'firstName lastName email status')
      .sort({ createdAt: -1 })
      .lean();

    // Full roster for the members dashboard + claim campaign. Small collection,
    // so we compute stats in JS from the same array (no extra round-trip).
    const members = await CommunityProfile.find({})
      .select('firstName lastName email status seeded claimed emailVerified memberNumber viewCount lastClaimEmailAt claimEmailCount createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const stats = {
      total: members.length,
      claimed: members.filter((m) => m.claimed).length,
      unclaimed: members.filter((m) => !m.claimed).length,
      seeded: members.filter((m) => m.seeded).length,
      seededUnclaimed: members.filter((m) => m.seeded && !m.claimed).length,
      neverEmailed: members.filter((m) => !m.lastClaimEmailAt).length,
      byStatus: members.reduce((acc, m) => { acc[m.status] = (acc[m.status] || 0) + 1; return acc; }, {}),
    };

    return res.json({ success: true, pendingProfiles, claimRequests, members, stats });
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
      const alreadyApproved = profile.status === 'approved';
      profile.status = 'approved';
      // A fresh sign-in token makes the acceptance email one click into the
      // directory. Longer-lived than a normal magic link so it survives a day
      // or two in the inbox before they open it.
      const signInToken = crypto.randomBytes(32).toString('hex');
      profile.manageTokenHash = sha256(signInToken);
      profile.manageTokenExpiry = new Date(Date.now() + APPROVAL_TOKEN_TTL_MS);
      await profile.save();
      await ensureMemberExtras(profile);

      if (!alreadyApproved) {
        try {
          await sendEmail({
            to: profile.email,
            subject: "You're in! Welcome to the Italian Tech Club community 🎉",
            html: magicLinkHtml({
              heading: `Welcome to the community, ${profile.firstName}! 🇮🇹`,
              intro: `Ciao ${profile.firstName}! Your profile has been approved — you're now part of the Italian Tech Club NYC community. Click below to sign in, browse fellow members, and start connecting. This link expires in 7 days.`,
              link: `${SITE_URL}/community/manage?token=${signInToken}`,
              buttonLabel: 'Sign In to the Community',
            }),
          });
        } catch (approvalError) {
          console.error('Failed to send approval email:', approvalError);
        }
      }

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

    // Batch claim/welcome email to selected members. Each recipient gets a fresh
    // 7-day magic link; opening it signs them in and flips `claimed: true`.
    if (action === 'send-claim-emails') {
      const { profileIds, subject, bodyHtml } = req.body || {};
      if (!Array.isArray(profileIds) || profileIds.length === 0) {
        return res.status(400).json({ success: false, message: 'Select at least one member.' });
      }
      const subj = (typeof subject === 'string' && subject.trim()) || DEFAULT_CLAIM_SUBJECT;
      const rawBody = (typeof bodyHtml === 'string' && bodyHtml.trim()) || DEFAULT_CLAIM_BODY;

      const profiles = await CommunityProfile.find({ _id: { $in: profileIds } });
      if (profiles.length === 0) {
        return res.status(404).json({ success: false, message: 'No matching profiles found.' });
      }

      const now = new Date();
      const expiry = new Date(now.getTime() + APPROVAL_TOKEN_TTL_MS);
      const tokenOps = [];
      const messages = []; // parallel arrays: messages[i] ↔ meta[i]
      const meta = [];

      for (const p of profiles) {
        const token = crypto.randomBytes(32).toString('hex');
        const link = `${SITE_URL}/community/manage?token=${token}`;
        const ctx = { firstName: p.firstName, lastName: p.lastName, link };
        tokenOps.push({
          updateOne: {
            filter: { _id: p._id },
            update: { $set: { manageTokenHash: sha256(token), manageTokenExpiry: expiry } },
          },
        });
        messages.push({
          to: p.email,
          subject: fillTemplate(subj, ctx),
          html: campaignHtml({ bodyHtml: fillTemplate(rawBody, ctx), link, buttonLabel: CLAIM_BUTTON_LABEL }),
        });
        meta.push({ profileId: p._id, email: p.email });
      }

      // Persist tokens first so the links are valid before any email lands.
      await CommunityProfile.bulkWrite(tokenOps);

      // Send in Resend batches (<=100 each); collect which addresses succeeded.
      const sentOk = new Set();
      for (const group of chunk(messages, CLAIM_EMAIL_BATCH_SIZE)) {
        const { results } = await sendEmailBatch(group);
        for (const r of results) if (r.ok) sentOk.add(r.to);
      }

      // Record a send only for recipients whose email actually went out.
      const stampOps = meta
        .filter((m) => sentOk.has(m.email))
        .map((m) => ({
          updateOne: {
            filter: { _id: m.profileId },
            update: { $set: { lastClaimEmailAt: now }, $inc: { claimEmailCount: 1 } },
          },
        }));
      if (stampOps.length > 0) await CommunityProfile.bulkWrite(stampOps);

      const sent = sentOk.size;
      const failed = meta.length - sent;
      return res.json({
        success: true,
        sent,
        failed,
        message: `Sent ${sent} claim email${sent === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}.`,
        results: meta.map((m) => ({ profileId: m.profileId, email: m.email, ok: sentOk.has(m.email) })),
      });
    }

    // One-off test send to any address. Mirrors production (real link if the
    // address matches a member) but does NOT record a claim-email send.
    if (action === 'send-test-email') {
      const email = (req.body?.toEmail || '').toLowerCase().trim();
      if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
      }
      const subj = (typeof req.body?.subject === 'string' && req.body.subject.trim()) || DEFAULT_CLAIM_SUBJECT;
      const rawBody = (typeof req.body?.bodyHtml === 'string' && req.body.bodyHtml.trim()) || DEFAULT_CLAIM_BODY;

      const match = await CommunityProfile.findOne({ email });
      let link = `${SITE_URL}/community/manage`;
      let firstName = 'there';
      let lastName = '';
      if (match) {
        const token = crypto.randomBytes(32).toString('hex');
        match.manageTokenHash = sha256(token);
        match.manageTokenExpiry = new Date(Date.now() + APPROVAL_TOKEN_TTL_MS);
        await match.save();
        link = `${SITE_URL}/community/manage?token=${token}`;
        firstName = match.firstName;
        lastName = match.lastName;
      }
      const ctx = { firstName, lastName, link };
      const ok = await sendEmail({
        to: email,
        subject: fillTemplate(subj, ctx),
        html: campaignHtml({ bodyHtml: fillTemplate(rawBody, ctx), link, buttonLabel: CLAIM_BUTTON_LABEL }),
      });
      return res.json({
        success: ok,
        message: ok ? `Test email sent to ${email}.` : 'Send failed — check the email (Resend) configuration.',
      });
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
