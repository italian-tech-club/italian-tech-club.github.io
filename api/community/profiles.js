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

// Schema definition (must match the submit.js schema)
const communityProfileSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  linkedIn: { type: String, required: true },
  profilePic: { type: String, required: true },
  profession: { type: String, required: true },
  company: { type: String, default: '' },
  bio: { type: String, default: '' },
  status: { type: String, default: 'pending' },
}, {
  timestamps: true,
  collection: 'community_profiles',
});

const CommunityProfile = mongoose.models.CommunityProfile || mongoose.model('CommunityProfile', communityProfileSchema);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    await connectDB();

    // Approved (email-verified) profiles only; exclude email for privacy
    const profiles = await CommunityProfile.find(
      { status: 'approved' }
    )
    .select('firstName lastName linkedIn profilePic profession company bio createdAt')
    .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      profiles,
      count: profiles.length,
    });

  } catch (error) {
    console.error('Error fetching profiles:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch profiles',
    });
  }
}
