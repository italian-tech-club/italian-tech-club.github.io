import mongoose from 'mongoose';

let cachedConnection = null;

async function connectDB() {
  if (cachedConnection) return cachedConnection;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not defined');
  cachedConnection = await mongoose.connect(process.env.MONGODB_URI);
  return cachedConnection;
}

// Interaction schema for tracking views and likes
const interactionSchema = new mongoose.Schema({
  profileId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'CofounderProfile' },
  visitorIp: { type: String, required: true },
  type: { type: String, enum: ['view', 'like'], required: true },
  createdAt: { type: Date, default: Date.now },
}, {
  collection: 'cofounder_interactions',
});

interactionSchema.index({ profileId: 1, visitorIp: 1, type: 1 });
interactionSchema.index({ profileId: 1, type: 1 });

const Interaction = mongoose.models.Interaction || mongoose.model('Interaction', interactionSchema);

// Profile schema (minimal, just for updating)
const profileSchema = new mongoose.Schema({
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
}, { collection: 'cofounder_matching' });

const Profile = mongoose.models.CofounderProfile || mongoose.model('CofounderProfile', profileSchema);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await connectDB();

    // Get visitor IP
    const visitorIp = req.headers['x-forwarded-for']?.split(',')[0] || 
                      req.headers['x-real-ip'] || 
                      'unknown';

    if (req.method === 'POST') {
      const { profileId, type } = req.body;

      if (!profileId || !type || !['view', 'like'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Invalid request' });
      }

      // Check if this IP already interacted with this profile for this type
      const existing = await Interaction.findOne({ 
        profileId, 
        visitorIp, 
        type 
      });

      if (existing) {
        // For likes, allow toggle (unlike)
        if (type === 'like') {
          await Interaction.deleteOne({ _id: existing._id });
          await Profile.findByIdAndUpdate(profileId, { $inc: { likes: -1 } });
          return res.json({ success: true, action: 'unliked' });
        }
        // For views, just return success (already viewed)
        return res.json({ success: true, action: 'already_viewed' });
      }

      // Create new interaction
      await Interaction.create({ profileId, visitorIp, type });
      
      // Update profile counts
      const updateField = type === 'view' ? 'views' : 'likes';
      await Profile.findByIdAndUpdate(profileId, { $inc: { [updateField]: 1 } });

      return res.json({ success: true, action: type === 'view' ? 'viewed' : 'liked' });
    }

    if (req.method === 'GET') {
      const { profileId } = req.query;

      if (!profileId) {
        return res.status(400).json({ success: false, message: 'Profile ID required' });
      }

      // Check if this IP has liked this profile
      const hasLiked = await Interaction.exists({ 
        profileId, 
        visitorIp, 
        type: 'like' 
      });

      return res.json({ success: true, hasLiked: !!hasLiked });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });

  } catch (error) {
    console.error('Interaction error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong' });
  }
}
