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

// Schema definition (must match submit.js)
const sponsorInquirySchema = new mongoose.Schema({
  companyName: { type: String, required: true, trim: true, maxlength: 100 },
  contactName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true },
  website: { type: String, trim: true, default: '' },
  sponsorshipTypes: [{ type: String, enum: ['event', 'venue', 'food-drinks', 'prizes', 'recurring', 'other'] }],
  message: { type: String, required: true, maxlength: 2000 },
  status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new' },
}, {
  timestamps: true,
  collection: 'sponsor_inquiries',
});

const SponsorInquiry = mongoose.models.SponsorInquiry || mongoose.model('SponsorInquiry', sponsorInquirySchema);

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

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await connectDB();

    if (!(await isAuthorized(req))) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (req.method === 'GET') {
      const inquiries = await SponsorInquiry.find().sort({ createdAt: -1 }).lean();
      return res.status(200).json({ success: true, inquiries, count: inquiries.length });
    }

    if (req.method === 'PUT') {
      const { status } = req.body || {};
      if (!['new', 'contacted', 'closed'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }

      const inquiry = await SponsorInquiry.findByIdAndUpdate(
        req.query.id,
        { status },
        { new: true, runValidators: true }
      );
      if (!inquiry) {
        return res.status(404).json({ success: false, message: 'Inquiry not found' });
      }
      return res.status(200).json({ success: true, inquiry });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });

  } catch (error) {
    console.error('Error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid inquiry id' });
    }
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
}
