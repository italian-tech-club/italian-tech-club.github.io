import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * Consolidated community API. Vercel Hobby caps a deployment at 12 serverless
 * functions, so all community endpoints share this one dynamic route:
 *   GET    /api/community/profiles          (gated: full for members, teaser for visitors)
 *   POST   /api/community/submit
 *   GET|POST|PUT|DELETE /api/community/manage
 *   GET|DELETE /api/community/session       (member session check / sign-out)
 *   GET|POST /api/community/connect         (double-opt-in member intros)
 *   POST   /api/community/view              (profile view tracking, member only)
 *   POST   /api/community/claim-request
 *   GET|POST /api/community/admin           (admin session required)
 * The segment after /community/ arrives as req.query.action.
 * (Mirror of server/routes/community.js used by the local express server.)
 */

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

// Schema definitions (must match server/models/*)
const ROLE_OPTIONS = ['founder', 'engineer', 'investor', 'innovator', 'tech-enthusiast', 'researcher'];
const LOOKING_FOR_OPTIONS = ['cofounder', 'hiring', 'job', 'investors', 'beta-users', 'mentor'];

const communityProfileSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 50 },
  lastName: { type: String, required: true, trim: true, maxlength: 50 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  linkedIn: { type: String, trim: true, default: '' },
  profilePic: { type: String, default: null },
  profession: { type: String, required: true, trim: true, maxlength: 100 },
  company: { type: String, trim: true, maxlength: 100, default: '' },
  bio: { type: String, maxlength: 500, default: '' },
  roles: { type: [String], enum: ROLE_OPTIONS, default: [] },
  lookingFor: { type: [String], enum: LOOKING_FOR_OPTIONS, default: [] },
  openToConnect: { type: Boolean, default: true },
  memberNumber: { type: Number, default: null },
  viewCount: { type: Number, default: 0 },
  inviteCode: { type: String, default: null },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityProfile', default: null },
  status: { type: String, enum: ['unclaimed', 'pending', 'approved', 'inactive'], default: 'pending' },
  emailVerified: { type: Boolean, default: false },
  isFounder: { type: Boolean, default: false },
  seeded: { type: Boolean, default: false },
  claimed: { type: Boolean, default: false },
  lastClaimEmailAt: { type: Date, default: null },
  claimEmailCount: { type: Number, default: 0 },
  gdprConsent: { type: Boolean, default: false },
  manageTokenHash: { type: String, default: null },
  manageTokenExpiry: { type: Date, default: null },
  pendingEmail: { type: String, lowercase: true, trim: true, default: null },
  pendingEmailTokenHash: { type: String, default: null },
  pendingEmailTokenExpiry: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'community_profiles',
});
communityProfileSchema.index({ memberNumber: 1 }, { unique: true, partialFilterExpression: { memberNumber: { $type: 'number' } } });
communityProfileSchema.index({ inviteCode: 1 }, { unique: true, partialFilterExpression: { inviteCode: { $type: 'string' } } });

const emailClaimRequestSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  currentEmail: { type: String, lowercase: true, trim: true, default: '' },
  requestedEmail: { type: String, required: true, lowercase: true, trim: true },
  message: { type: String, maxlength: 1000, default: '' },
  candidateProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityProfile', default: null },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  resolvedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'email_claim_requests',
});

const adminSessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  email: { type: String, required: true, lowercase: true },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: true,
  collection: 'admin_sessions',
});
adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const memberSessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityProfile', required: true },
  email: { type: String, required: true, lowercase: true },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: true,
  collection: 'member_sessions',
});
memberSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
memberSessionSchema.index({ profileId: 1 });

const connectRequestSchema = new mongoose.Schema({
  fromProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityProfile', required: true },
  toProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityProfile', required: true },
  message: { type: String, maxlength: 500, default: '' },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  decisionTokenHash: { type: String, default: null },
  decisionTokenExpiry: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'connect_requests',
});
connectRequestSchema.index({ fromProfileId: 1, status: 1 });
connectRequestSchema.index({ toProfileId: 1, status: 1 });

const profileViewSchema = new mongoose.Schema({
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityProfile', required: true },
  viewerProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityProfile', required: true },
  day: { type: String, required: true }, // YYYY-MM-DD
  viewedAt: { type: Date, default: Date.now },
}, {
  collection: 'profile_views',
});
profileViewSchema.index({ profileId: 1, viewerProfileId: 1, day: 1 }, { unique: true });
profileViewSchema.index({ profileId: 1, viewedAt: 1 });

const counterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 },
}, {
  collection: 'counters',
});

const CommunityProfile = mongoose.models.CommunityProfile || mongoose.model('CommunityProfile', communityProfileSchema);
const EmailClaimRequest = mongoose.models.EmailClaimRequest || mongoose.model('EmailClaimRequest', emailClaimRequestSchema);
const AdminSession = mongoose.models.AdminSession || mongoose.model('AdminSession', adminSessionSchema);
const MemberSession = mongoose.models.MemberSession || mongoose.model('MemberSession', memberSessionSchema);
const ConnectRequest = mongoose.models.ConnectRequest || mongoose.model('ConnectRequest', connectRequestSchema);
const ProfileView = mongoose.models.ProfileView || mongoose.model('ProfileView', profileViewSchema);
const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

const MANAGE_TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutes
const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000; // 60 minutes
const APPROVAL_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — sign-in link in the acceptance email
const MEMBER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CONNECT_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_PENDING_CONNECTS = 3; // outgoing pending requests per member
const SITE_URL = process.env.SITE_URL || 'https://italiantechclubnyc.com';
const FROM_EMAIL = process.env.SPONSOR_FROM_EMAIL || 'ITC Website <onboarding@resend.dev>';
// Where new-application notifications are sent (the club's shared inbox).
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || 'ciao@italiantechclubnyc.com';
const EDITABLE_FIELDS = ['firstName', 'lastName', 'linkedIn', 'profilePic', 'profession', 'company', 'bio', 'roles', 'lookingFor', 'openToConnect'];
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

async function nextSequence(name) {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return doc.seq;
}

async function sendMail(to, subject, { heading, intro, link, buttonLabel, replyTo }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — email not sent:', subject);
    return false;
  }
  const html = `
    <h2>${heading}</h2>
    <p>${intro}</p>
    <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#ffffff;border-radius:9999px;text-decoration:none;font-weight:bold;">${buttonLabel}</a></p>
    <p style="color:#64748b;font-size:12px;">If the button doesn't work, copy this URL: ${link}</p>
    <p style="color:#64748b;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
  `;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!response.ok) {
    console.error('Resend API error:', response.status, await response.text());
    return false;
  }
  return true;
}

// Send a fully-rendered HTML email (custom body, no fixed template). Used by the
// admin claim campaign. Never throws.
async function sendRawEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — email not sent:', subject);
    return false;
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });
    if (!response.ok) {
      console.error('Resend API error:', response.status, await response.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('Resend exception:', e);
    return false;
  }
}

// Send many distinct emails in one Resend batch call (<=100 per request). Never
// throws; returns per-recipient ok flags.
async function sendEmailBatch(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return { ok: true, results: [] };
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — batch not sent:', messages.length);
    return { ok: false, results: messages.map((m) => ({ to: m.to, ok: false })) };
  }
  const payload = messages.map((m) => ({ from: FROM_EMAIL, to: [m.to], subject: m.subject, html: m.html }));
  try {
    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.error('Resend batch API error:', response.status, await response.text());
      return { ok: false, results: messages.map((m) => ({ to: m.to, ok: false })) };
    }
    return { ok: true, results: messages.map((m) => ({ to: m.to, ok: true })) };
  } catch (e) {
    console.error('Resend batch exception:', e);
    return { ok: false, results: messages.map((m) => ({ to: m.to, ok: false })) };
  }
}

// Substitute campaign placeholders: {{firstName}}, {{lastName}}, {{link}}.
function fillTemplate(str, { firstName = '', lastName = '', link = '' } = {}) {
  return String(str ?? '')
    .split('{{firstName}}').join(firstName)
    .split('{{lastName}}').join(lastName)
    .split('{{link}}').join(link);
}

// Wrap an admin-authored body (plain text w/ newlines) + always append a claim button.
function campaignHtml({ bodyHtml, link, buttonLabel }) {
  const body = String(bodyHtml ?? '').replace(/\n/g, '<br/>');
  return `
    <div style="font-size:15px;line-height:1.6;">${body}</div>
    <p style="margin-top:24px;"><a href="${link}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#ffffff;border-radius:9999px;text-decoration:none;font-weight:bold;">${buttonLabel}</a></p>
    <p style="color:#64748b;font-size:12px;">If the button doesn't work, copy this URL: ${link}</p>
  `;
}

async function findProfileByToken(token) {
  if (!token) return null;
  return CommunityProfile.findOne({
    manageTokenHash: sha256(token),
    manageTokenExpiry: { $gt: new Date() },
  });
}

// Verify + claim a profile accessed via a valid magic link. Seeded-but-
// unconsented profiles become approved (consent recorded); new self-submissions
// ('pending') stay pending until an admin approves.
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

async function isAuthorized(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;
  const session = await AdminSession.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
  return !!session;
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

const memberSummary = (profile) => ({
  profileId: profile._id,
  firstName: profile.firstName,
  lastName: profile.lastName,
  profilePic: profile.profilePic,
  isFounder: profile.isFounder,
  memberNumber: profile.memberNumber,
});

// ---- GET /api/community/profiles ----
// Member session → full directory; anonymous → aggregate stats + anonymized
// teaser (founders stay visible as the public face).
async function handleProfiles(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const member = await findMemberSession(req);

  if (member) {
    const [profiles, hotProfileId] = await Promise.all([
      CommunityProfile.find({ status: 'approved' })
        .select(MEMBER_VIEW_FIELDS)
        .sort({ createdAt: -1 }),
      findHotProfileId(),
    ]);
    return res.status(200).json({
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

  return res.status(200).json({ success: true, memberView: false, count: profiles.length, stats, teaser });
}

// ---- GET|DELETE /api/community/session ----
async function handleSession(req, res) {
  if (req.method === 'GET') {
    const member = await findMemberSession(req);
    if (!member) return res.status(401).json({ success: false, message: 'Not signed in' });
    return res.status(200).json({ success: true, member: memberSummary(member.profile) });
  }
  if (req.method === 'DELETE') {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (token) await MemberSession.deleteOne({ tokenHash: sha256(token) });
    return res.status(200).json({ success: true });
  }
  return res.status(405).json({ success: false, message: 'Method not allowed' });
}

// ---- GET|POST /api/community/connect ----
async function handleConnect(req, res) {
  // Decision page data (via emailed token)
  if (req.method === 'GET') {
    const request = await ConnectRequest.findOne({
      decisionTokenHash: sha256(req.query.token || ''),
      decisionTokenExpiry: { $gt: new Date() },
      status: 'pending',
    }).populate('fromProfileId', 'firstName lastName profilePic profession company bio isFounder roles');
    if (!request || !request.fromProfileId) {
      return res.status(401).json({ success: false, message: 'This link is invalid, expired, or already used.' });
    }
    const from = request.fromProfileId;
    return res.status(200).json({
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
  }

  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

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
      try {
        await sendMail(from.email, `${to.firstName} accepted your connect request 🎉`, {
          heading: `You're connected with ${to.firstName} ${to.lastName}!`,
          intro: `Ciao ${from.firstName}! ${to.firstName} (${to.profession}${to.company ? ` at ${to.company}` : ''}) accepted your request. Reach out at ${to.email}${to.linkedIn ? ` or on LinkedIn: ${to.linkedIn}` : ''}.`,
          link: `mailto:${to.email}`,
          buttonLabel: `Email ${to.firstName}`,
          replyTo: to.email,
        });
        await sendMail(to.email, `You're now connected with ${from.firstName} ${from.lastName}`, {
          heading: `You're connected with ${from.firstName} ${from.lastName}!`,
          intro: `Ciao ${to.firstName}! You accepted ${from.firstName}'s request (${from.profession}${from.company ? ` at ${from.company}` : ''}). Reach out at ${from.email}${from.linkedIn ? ` or on LinkedIn: ${from.linkedIn}` : ''}.`,
          link: `mailto:${from.email}`,
          buttonLabel: `Email ${from.firstName}`,
          replyTo: from.email,
        });
      } catch (e) {
        console.error('intro email failed', e);
      }
    }

    return res.status(200).json({ success: true, decision: request.status });
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
  try {
    await sendMail(target.email, `${from.firstName} ${from.lastName} wants to connect with you`, {
      heading: 'New connect request — Italian Tech Club NYC',
      intro: `Ciao ${target.firstName}! ${from.firstName} ${from.lastName} (${from.profession}${from.company ? ` at ${from.company}` : ''}) would like to connect.${message ? ` Their message: “${message}”` : ''} Accept and we'll introduce you by email — decline and they won't be notified. The link expires in 7 days.`,
      link: `${SITE_URL}/community/connect?token=${decisionToken}`,
      buttonLabel: 'View Request',
    });
  } catch (e) {
    console.error('connect email failed', e);
  }

  return res.status(201).json({ success: true, message: `Request sent! ${target.firstName} will get an email — if they accept, we'll introduce you.` });
}

// ---- POST /api/community/view ----
// Deduped per viewer per day; owners see aggregates only, never who.
async function handleView(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const member = await findMemberSession(req);
  if (!member) return res.status(401).json({ success: false, message: 'Not signed in' });

  const { profileId } = req.body || {};
  if (!profileId || String(profileId) === String(member.profile._id)) {
    return res.status(200).json({ success: true, counted: false });
  }

  const day = new Date().toISOString().slice(0, 10);
  try {
    const result = await ProfileView.updateOne(
      { profileId, viewerProfileId: member.profile._id, day },
      { $setOnInsert: { viewedAt: new Date() } },
      { upsert: true },
    );
    if (result.upsertedCount) {
      await CommunityProfile.updateOne({ _id: profileId }, { $inc: { viewCount: 1 } });
    }
    return res.status(200).json({ success: true, counted: !!result.upsertedCount });
  } catch (error) {
    // Duplicate upsert race is fine — the view is already counted.
    if (error.code === 11000) return res.status(200).json({ success: true, counted: false });
    throw error;
  }
}

// ---- POST /api/community/submit ----
async function handleSubmit(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { firstName, lastName, email, linkedIn, profilePic, profession, company, bio, roles, lookingFor, ref } = req.body;
  if (!firstName || !lastName || !email || !linkedIn || !profilePic || !profession) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email' });
  }

  const existingProfile = await CommunityProfile.findOne({ email: email.toLowerCase() });
  if (existingProfile) {
    return res.status(409).json({ success: false, message: 'A profile with this email already exists. Use the manage link to edit it.' });
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

  let emailSent = false;
  try {
    emailSent = await sendMail(profile.email, 'Verify your ITC community profile', {
      heading: 'Verify your profile — Italian Tech Club NYC',
      intro: `Ciao ${profile.firstName}! Click the link below to verify your email. Your profile will go live once our team approves it. The link expires in 60 minutes.`,
      link: `${SITE_URL}/community/manage?token=${verifyToken}`,
      buttonLabel: 'Verify My Email',
    });
  } catch (e) {
    console.error('Failed to send verification email:', e);
  }

  // Notify the club inbox so an admin can review + approve the new applicant.
  try {
    await sendMail(ADMIN_NOTIFY_EMAIL, `New community join request: ${profile.firstName} ${profile.lastName}`, {
      heading: 'New community join request',
      intro: `${profile.firstName} ${profile.lastName} (${profile.profession}${profile.company ? ` at ${profile.company}` : ''}) asked to join the community.<br/>Email: ${profile.email}<br/>LinkedIn: ${profile.linkedIn}${profile.bio ? `<br/>Bio: ${profile.bio}` : ''}<br/><br/>Review and approve them in the admin dashboard.`,
      link: `${SITE_URL}/admin`,
      buttonLabel: 'Review in Admin',
      replyTo: profile.email,
    });
  } catch (e) {
    console.error('Failed to send admin notification email:', e);
  }

  return res.status(201).json({
    success: true,
    message: emailSent
      ? 'Profile submitted! Verify your email, then our team will review and approve it.'
      : 'Profile submitted! It will appear once our team approves it.',
    emailSent,
    profileId: profile._id,
  });
}

// ---- GET|POST|PUT|DELETE /api/community/manage ----
async function handleManage(req, res) {
  if (req.method === 'POST') {
    // Primary-email change (manage token or member session)
    if (req.body?.action === 'change-email') {
      const auth = await resolveManageAuth(req);
      if (!auth) return res.status(401).json({ success: false, message: 'This link is invalid or has expired. Request a new one.' });
      const profile = auth.profile;

      const newEmail = (req.body.newEmail || '').toLowerCase().trim();
      if (!EMAIL_RE.test(newEmail)) return res.status(400).json({ success: false, message: 'Please enter a valid email.' });
      if (newEmail === profile.email) return res.status(400).json({ success: false, message: 'That is already your primary email.' });
      const taken = await CommunityProfile.findOne({ email: newEmail });
      if (taken) return res.status(409).json({ success: false, message: 'That email is already linked to another profile.' });

      const emailToken = crypto.randomBytes(32).toString('hex');
      profile.pendingEmail = newEmail;
      profile.pendingEmailTokenHash = sha256(emailToken);
      profile.pendingEmailTokenExpiry = new Date(Date.now() + EMAIL_CHANGE_TTL_MS);
      await profile.save();

      await sendMail(newEmail, 'Confirm your new ITC profile email', {
        heading: 'Confirm your new email — Italian Tech Club NYC',
        intro: `Ciao ${profile.firstName}! Click below to make this address the primary email for your community profile. The link expires in 60 minutes.`,
        link: `${SITE_URL}/community/manage?emailToken=${emailToken}`,
        buttonLabel: 'Confirm New Email',
      });

      return res.status(200).json({ success: true, message: `Check ${newEmail} to confirm the change.` });
    }

    // Request a manage link by email
    const email = (req.body?.email || '').toLowerCase().trim();
    const genericResponse = { success: true, message: 'If a profile with this email exists, a manage link is on its way.' };
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const profile = await CommunityProfile.findOne({ email });
    if (!profile) return res.status(200).json(genericResponse);

    const token = crypto.randomBytes(32).toString('hex');
    profile.manageTokenHash = sha256(token);
    profile.manageTokenExpiry = new Date(Date.now() + MANAGE_TOKEN_TTL_MS);
    await profile.save();

    await sendMail(profile.email, 'Your ITC community sign-in link', {
      heading: 'Sign in — Italian Tech Club NYC',
      intro: `Ciao ${profile.firstName}! Click the link below to sign in to the community — browse members, connect, and edit your profile. The link expires in 60 minutes.`,
      link: `${SITE_URL}/community/manage?token=${token}`,
      buttonLabel: 'Sign In',
    });

    return res.status(200).json(genericResponse);
  }

  // Confirm a primary-email change
  if (req.method === 'GET' && req.query.emailToken) {
    const profile = await CommunityProfile.findOne({
      pendingEmailTokenHash: sha256(req.query.emailToken),
      pendingEmailTokenExpiry: { $gt: new Date() },
    });
    if (!profile) return res.status(401).json({ success: false, message: 'This confirmation link is invalid or has expired.' });

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

    return res.status(200).json({ success: true, emailChanged: true, email: profile.email });
  }

  // Everything below requires a manage token or a member session
  const auth = await resolveManageAuth(req);
  if (!auth) return res.status(401).json({ success: false, message: 'This link is invalid or has expired. Request a new one.' });
  const { profile, viaToken } = auth;

  if (req.method === 'GET') {
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
  }

  if (req.method === 'PUT') {
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        profile[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
      }
    }
    if (viaToken) await applyClaim(profile);
    await profile.save();
    return res.status(200).json({ success: true, message: 'Profile updated!' });
  }

  if (req.method === 'DELETE') {
    if (profile.isFounder) return res.status(403).json({ success: false, message: 'Founder profiles cannot be deleted.' });
    await MemberSession.deleteMany({ profileId: profile._id });
    await profile.deleteOne();
    return res.status(200).json({ success: true, message: 'Profile deleted.' });
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}

// ---- POST /api/community/claim-request ----
async function handleClaimRequest(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

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
}

// ---- GET|POST /api/community/admin (admin session required) ----
async function handleAdmin(req, res) {
  if (!(await isAuthorized(req))) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  if (req.method === 'GET') {
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

    return res.status(200).json({ success: true, pendingProfiles, claimRequests, members, stats });
  }

  if (req.method === 'POST') {
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
          await sendMail(profile.email, "You're in! Welcome to the Italian Tech Club community 🎉", {
            heading: `Welcome to the community, ${profile.firstName}! 🇮🇹`,
            intro: `Ciao ${profile.firstName}! Your profile has been approved — you're now part of the Italian Tech Club NYC community. Click below to sign in, browse fellow members, and start connecting. This link expires in 7 days.`,
            link: `${SITE_URL}/community/manage?token=${signInToken}`,
            buttonLabel: 'Sign In to the Community',
          });
        } catch (e) {
          console.error('Failed to send approval email:', e);
        }
      }

      return res.status(200).json({ success: true, message: 'Profile approved.' });
    }

    if (action === 'reject-profile') {
      const profile = await CommunityProfile.findByIdAndDelete(req.body.profileId);
      if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
      return res.status(200).json({ success: true, message: 'Profile rejected.' });
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

      try {
        await sendMail(request.requestedEmail, 'Your ITC profile claim was approved', {
          heading: 'Claim approved — Italian Tech Club NYC',
          intro: `Ciao ${target.firstName}! Your request to use this email for your community profile was approved. Click below to sign in and manage your profile.`,
          link: `${SITE_URL}/community/manage`,
          buttonLabel: 'Sign in to My Profile',
        });
      } catch (e) {
        console.error('claim email failed', e);
      }

      return res.status(200).json({ success: true, message: 'Claim approved and email reassigned.' });
    }

    if (action === 'reject-claim') {
      const request = await EmailClaimRequest.findById(req.body.requestId);
      if (!request || request.status !== 'pending') {
        return res.status(404).json({ success: false, message: 'Claim request not found' });
      }
      request.status = 'rejected';
      request.resolvedAt = new Date();
      await request.save();
      return res.status(200).json({ success: true, message: 'Claim request rejected.' });
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
      const messages = [];
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

      const sentOk = new Set();
      for (const group of chunk(messages, CLAIM_EMAIL_BATCH_SIZE)) {
        const { results } = await sendEmailBatch(group);
        for (const r of results) if (r.ok) sentOk.add(r.to);
      }

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
      return res.status(200).json({
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
      const ok = await sendRawEmail(
        email,
        fillTemplate(subj, ctx),
        campaignHtml({ bodyHtml: fillTemplate(rawBody, ctx), link, buttonLabel: CLAIM_BUTTON_LABEL }),
      );
      return res.status(200).json({
        success: ok,
        message: ok ? `Test email sent to ${email}.` : 'Send failed — check the email (Resend) configuration.',
      });
    }

    return res.status(400).json({ success: false, message: 'Unknown action' });
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await connectDB();

    const action = req.query.action;

    switch (action) {
      case 'profiles': return await handleProfiles(req, res);
      case 'submit': return await handleSubmit(req, res);
      case 'manage': return await handleManage(req, res);
      case 'session': return await handleSession(req, res);
      case 'connect': return await handleConnect(req, res);
      case 'view': return await handleView(req, res);
      case 'claim-request': return await handleClaimRequest(req, res);
      case 'admin': return await handleAdmin(req, res);
      default: return res.status(404).json({ success: false, message: 'Not found' });
    }
  } catch (error) {
    console.error('Error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A profile with this email already exists.' });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
}
