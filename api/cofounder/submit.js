import mongoose from 'mongoose';

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

// Schema definition
const cofounderProfileSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 50 },
  lastName: { type: String, required: true, trim: true, maxlength: 50 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  linkedIn: { type: String, required: true, trim: true },
  profilePic: { type: String, required: true },
  role: { type: String, required: true, enum: ['technical', 'non-technical', 'design', 'hybrid'] },
  stage: { type: String, required: true, enum: ['idea', 'exploring', 'building', 'experienced'] },
  commitment: { type: String, enum: ['fulltime', 'parttime', 'depends', ''], default: '' },
  industries: [{ type: String, trim: true }],
  prompts: {
    superpower: { type: String, maxlength: 300, default: '' },
    obsession: { type: String, maxlength: 300, default: '' },
    cofounder_type: { type: String, maxlength: 300, default: '' },
    looking_for: { type: String, maxlength: 300, default: '' },
    dealbreaker: { type: String, maxlength: 300, default: '' },
  },
  bio: { type: String, maxlength: 500, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'matched', 'inactive'], default: 'pending' },
  submittedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
  collection: 'cofounder_matching',
});

// Get or create model
const CofounderProfile = mongoose.models.CofounderProfile || mongoose.model('CofounderProfile', cofounderProfileSchema);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    await connectDB();

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
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Validate prompts
    const filledPrompts = Object.values(prompts || {}).filter(p => p && p.trim().length > 0);
    if (filledPrompts.length < 3) {
      return res.status(400).json({ success: false, message: 'Please answer at least 3 prompts' });
    }

    // Check existing
    const existingProfile = await CofounderProfile.findOne({ email: email.toLowerCase() });
    if (existingProfile) {
      return res.status(409).json({ 
        success: false, 
        message: 'A profile with this email already exists.' 
      });
    }

    // Create profile
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

    return res.status(201).json({
      success: true,
      message: 'Profile submitted successfully!',
      profileId: profile._id,
    });

  } catch (error) {
    console.error('Error:', error);

    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A profile with this email already exists.' });
    }

    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
}
