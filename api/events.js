import mongoose from 'mongoose';
import crypto from 'crypto';

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
const eventSchema = new mongoose.Schema({
  date: { type: String, required: true, trim: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  subtitle: { type: String, trim: true, maxlength: 300, default: '' },
  location: { type: String, required: true, trim: true, maxlength: 200 },
  time: { type: String, trim: true, maxlength: 50, default: null },
  type: { type: String, required: true, trim: true, maxlength: 50 },
  link: { type: String, trim: true, maxlength: 500, default: null },
  // poster and gallery entries hold either repo image paths or base64 data URLs
  poster: { type: String, trim: true, default: null },
  gallery: { type: [String], default: [] },
}, {
  timestamps: true,
  collection: 'events',
});

eventSchema.index({ date: 1, title: 1 }, { unique: true });

// Get or create model
const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);

const EVENT_FIELDS = ['date', 'title', 'subtitle', 'location', 'time', 'type', 'link', 'poster', 'gallery'];

// Admin sessions created by /api/admin/auth (magic-link login)
const adminSessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  email: { type: String, required: true, lowercase: true },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: true,
  collection: 'admin_sessions',
});
adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AdminSession = mongoose.models.AdminSession || mongoose.model('AdminSession', adminSessionSchema);

async function isAuthorized(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const session = await AdminSession.findOne({ tokenHash, expiresAt: { $gt: new Date() } });
  return !!session;
}

function pickEventFields(body) {
  const data = {};
  for (const field of EVENT_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  if (data.gallery !== undefined && !Array.isArray(data.gallery)) {
    data.gallery = [];
  }
  return data;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await connectDB();

    // Public: single event with full gallery, or list of all events.
    // The list omits gallery contents (base64 images would blow up the
    // payload) and exposes galleryCount instead; galleries are fetched
    // per-event on demand.
    if (req.method === 'GET') {
      if (req.query.id) {
        const event = await Event.findById(req.query.id).lean();
        if (!event) {
          return res.status(404).json({ success: false, message: 'Event not found' });
        }
        return res.status(200).json({ success: true, event });
      }

      const events = await Event.aggregate([
        { $addFields: { galleryCount: { $size: { $ifNull: ['$gallery', []] } } } },
        { $project: { gallery: 0 } },
        { $sort: { date: -1 } },
      ]);
      return res.status(200).json({ success: true, events });
    }

    // Everything below requires a valid admin session
    if (!(await isAuthorized(req))) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (req.method === 'POST') {
      // Session validity check for the admin panel
      if (req.body?.action === 'verify') {
        return res.status(200).json({ success: true });
      }

      const data = pickEventFields(req.body);
      if (!data.date || !data.title || !data.location || !data.type) {
        return res.status(400).json({ success: false, message: 'Missing required fields: date, title, location, type' });
      }

      const event = new Event(data);
      await event.save();
      return res.status(201).json({ success: true, event });
    }

    if (req.method === 'PUT') {
      const data = pickEventFields(req.body);
      const event = await Event.findByIdAndUpdate(req.query.id, data, { new: true, runValidators: true });
      if (!event) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }
      return res.status(200).json({ success: true, event });
    }

    if (req.method === 'DELETE') {
      const event = await Event.findByIdAndDelete(req.query.id);
      if (!event) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });

  } catch (error) {
    console.error('Error:', error);

    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'An event with this date and title already exists' });
    }
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
}
