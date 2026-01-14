import express from 'express';
import CofounderProfile from '../models/CofounderProfile.js';

const router = express.Router();

/**
 * POST /api/cofounder/submit
 * Submit a new co-founder matching profile
 */
router.post('/submit', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      linkedIn,
      profilePic,
      role,
      stage,
      commitment,
      industries,
      prompts,
      bio,
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !linkedIn || !profilePic || !role || !stage) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    // Validate at least 3 prompts are filled
    const filledPrompts = Object.values(prompts || {}).filter(p => p && p.trim().length > 0);
    if (filledPrompts.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Please answer at least 3 prompts',
      });
    }

    // Check if email already exists
    const existingProfile = await CofounderProfile.findOne({ email: email.toLowerCase() });
    if (existingProfile) {
      return res.status(409).json({
        success: false,
        message: 'A profile with this email already exists. Contact us if you need to update it.',
      });
    }

    // Create new profile
    const profile = new CofounderProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      linkedIn: linkedIn.trim(),
      profilePic,
      role,
      stage,
      commitment: commitment || '',
      industries: industries || [],
      prompts: {
        superpower: prompts?.superpower?.trim() || '',
        obsession: prompts?.obsession?.trim() || '',
        cofounder_type: prompts?.cofounder_type?.trim() || '',
        looking_for: prompts?.looking_for?.trim() || '',
        dealbreaker: prompts?.dealbreaker?.trim() || '',
      },
      bio: bio?.trim() || '',
    });

    await profile.save();

    console.log(`✅ New co-founder profile submitted: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Profile submitted successfully!',
      profileId: profile._id,
    });

  } catch (error) {
    console.error('❌ Error submitting profile:', error);

    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A profile with this email already exists.',
      });
    }

    // Handle validation errors
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
 * GET /api/cofounder/check-email/:email
 * Check if an email is already registered
 */
router.get('/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const exists = await CofounderProfile.exists({ email: email.toLowerCase() });
    
    res.json({
      exists: !!exists,
    });
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({ error: 'Failed to check email' });
  }
});

export default router;
