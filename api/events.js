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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// One-off changes to a recurring series: move a gathering, change its venue or
// time, or cancel it — the "unless otherwise specified" part of a fixed cadence.
const recurrenceOverrideSchema = new mongoose.Schema({
  occurrence: { type: String, required: true, trim: true, match: ISO_DATE },
  date: { type: String, trim: true, default: null },
  time: { type: String, trim: true, maxlength: 50, default: null },
  location: { type: String, trim: true, maxlength: 200, default: null },
  note: { type: String, trim: true, maxlength: 200, default: null },
  cancelled: { type: Boolean, default: false },
}, { _id: false });

// A recurring series is stored as a single event document carrying this rule;
// individual gatherings are expanded on the client (see src/lib/eventSchedule.js).
const recurrenceSchema = new mongoose.Schema({
  frequency: { type: String, enum: ['weekly'], default: 'weekly' },
  interval: { type: Number, min: 1, max: 52, default: 1 },
  startDate: { type: String, required: true, trim: true, match: ISO_DATE },
  until: { type: String, trim: true, default: null },
  skipDates: { type: [String], default: [] },
  overrides: { type: [recurrenceOverrideSchema], default: [] },
}, { _id: false });

// Schema definition
const eventSchema = new mongoose.Schema({
  // For a recurring series this is the first gathering; the rule drives the rest.
  date: { type: String, required: true, trim: true, match: ISO_DATE },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  subtitle: { type: String, trim: true, maxlength: 300, default: '' },
  location: { type: String, required: true, trim: true, maxlength: 200 },
  time: { type: String, trim: true, maxlength: 50, default: null },
  type: { type: String, required: true, trim: true, maxlength: 50 },
  link: { type: String, trim: true, maxlength: 500, default: null },
  // poster and gallery entries hold either repo image paths or base64 data URLs
  poster: { type: String, trim: true, default: null },
  gallery: { type: [String], default: [] },
  recurrence: { type: recurrenceSchema, default: null },
  // Slug tying a one-off event to a series, so each night keeps its own poster
  // and photos while still belonging to the standing appointment.
  series: { type: String, trim: true, maxlength: 60, default: null },
}, {
  timestamps: true,
  collection: 'events',
});

eventSchema.index({ date: 1, title: 1 }, { unique: true });

// Get or create model
const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);

const EVENT_FIELDS = ['date', 'title', 'subtitle', 'location', 'time', 'type', 'link', 'poster', 'gallery', 'recurrence', 'series'];

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

// Member sessions issued by the community magic link — an admin who signed in
// there is an admin here too, so one sign-in covers both panels.
const memberSessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  email: { type: String, required: true, lowercase: true },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: true,
  collection: 'member_sessions',
});

const AdminSession = mongoose.models.AdminSession || mongoose.model('AdminSession', adminSessionSchema);
const MemberSession = mongoose.models.MemberSession || mongoose.model('MemberSession', memberSessionSchema);

// Mirrors the allowlist in /api/admin/auth — a member session only carries
// admin rights if its email is on it.
const ADMIN_EMAILS = [
  'giuseppe.concialdi@gmail.com',
  'noemi.gozzi@gmail.com',
  'enrico.fontana1997@gmail.com',
  'michela@tarantino.email',
  'nicole.bizzini@gmail.com',
];

async function isAuthorized(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const now = new Date();
  const adminSession = await AdminSession.findOne({ tokenHash, expiresAt: { $gt: now } });
  if (adminSession) return true;

  const memberSession = await MemberSession.findOne({ tokenHash, expiresAt: { $gt: now } });
  return !!memberSession && ADMIN_EMAILS.includes(memberSession.email);
}

function pickEventFields(body) {
  const data = {};
  for (const field of EVENT_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  if (data.gallery !== undefined && !Array.isArray(data.gallery)) {
    data.gallery = [];
  }
  // A rule without a start date is not a series — store null so the event is
  // treated as a one-off rather than half-configured.
  if (data.recurrence !== undefined && !data.recurrence?.startDate) {
    data.recurrence = null;
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
