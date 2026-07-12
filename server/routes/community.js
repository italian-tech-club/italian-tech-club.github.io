import express from 'express';
import crypto from 'crypto';
import CommunityProfile from '../models/CommunityProfile.js';
import { sendEmail, magicLinkHtml, SITE_URL } from '../utils/email.js';

const router = express.Router();

const MANAGE_TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutes
const EDITABLE_FIELDS = ['firstName', 'lastName', 'linkedIn', 'profilePic', 'profession', 'company', 'bio'];

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function findProfileByToken(token) {
  if (!token) return null;
  return CommunityProfile.findOne({
    manageTokenHash: sha256(token),
    manageTokenExpiry: { $gt: new Date() },
  });
}

/**
 * POST /api/community/submit
 * Submit a new community member profile
 */
router.post('/submit', async (req, res) => {
  try {
    const { firstName, lastName, email, linkedIn, profilePic, profession, company, bio } = req.body;

    if (!firstName || !lastName || !email || !linkedIn || !profilePic || !profession) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const existingProfile = await CommunityProfile.findOne({ email: email.toLowerCase() });
    if (existingProfile) {
      return res.status(409).json({
        success: false,
        message: 'A profile with this email already exists. Contact us if you need to update it.',
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

    console.log(`✅ New community profile submitted: ${email}`);

    let emailSent = false;
    try {
      emailSent = await sendEmail({
        to: profile.email,
        subject: 'Verify your ITC community profile',
        html: magicLinkHtml({
          heading: 'Verify your profile — Italian Tech Club NYC',
          intro: `Ciao ${profile.firstName}! Click the link below to verify your email and publish your community profile. The link expires in 60 minutes.`,
          link: `${SITE_URL}/community/manage?token=${verifyToken}`,
          buttonLabel: 'Verify & Publish My Profile',
        }),
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: emailSent
        ? 'Almost done! Check your email to verify and publish your profile.'
        : 'Profile submitted! It will appear once approved.',
      emailSent,
      profileId: profile._id,
    });

  } catch (error) {
    console.error('❌ Error submitting community profile:', error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A profile with this email already exists.',
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }

    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
});

/**
 * GET /api/community/profiles
 * Get all community profiles (excluding email for privacy)
 */
router.get('/profiles', async (req, res) => {
  try {
    const profiles = await CommunityProfile.find(
      { status: 'approved' }
    )
    .select('firstName lastName linkedIn profilePic profession company bio createdAt')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      profiles,
      count: profiles.length,
    });
  } catch (error) {
    console.error('Error fetching community profiles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profiles',
    });
  }
});

/**
 * POST /api/community/manage
 * Request a manage link by email
 */
router.post('/manage', async (req, res) => {
  try {
    const email = (req.body?.email || '').toLowerCase().trim();

    // Identical response whether or not the profile exists (no enumeration)
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
        intro: `Ciao ${profile.firstName}! Click the link below to edit or remove your community profile. The link expires in 60 minutes.`,
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
 * GET /api/community/manage?token=  — fetch own profile (verifies email on first use)
 */
router.get('/manage', async (req, res) => {
  try {
    const profile = await findProfileByToken(req.query.token);
    if (!profile) {
      return res.status(401).json({ success: false, message: 'This link is invalid or has expired. Request a new one.' });
    }

    if (!profile.emailVerified) {
      profile.emailVerified = true;
      if (profile.status === 'pending') profile.status = 'approved';
      await profile.save();
    }

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
    if (!profile.emailVerified) {
      profile.emailVerified = true;
      if (profile.status === 'pending') profile.status = 'approved';
    }
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

    await profile.deleteOne();
    return res.json({ success: true, message: 'Profile deleted.' });
  } catch (error) {
    console.error('❌ Manage delete error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

export default router;
