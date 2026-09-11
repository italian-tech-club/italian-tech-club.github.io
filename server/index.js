import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cofounderRoutes from './routes/cofounder.js';
import communityRoutes from './routes/community.js';
import sponsorRoutes from './routes/sponsor.js';
import eventsRoutes from './routes/events.js';
import adminAuthRoutes from './routes/adminAuth.js';
import partnersRoutes from './routes/partners.js';
import marketingRoutes from './routes/marketing.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
// Resend signs raw bytes. Mount its router before the JSON parser.
app.use('/api/marketing', express.raw({ type: '*/*', limit: '256kb' }), marketingRoutes);
app.use(express.json({ limit: '10mb' })); // Increased limit for base64 images

// Routes
app.use('/api/cofounder', cofounderRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/sponsor', sponsorRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/partners', partnersRoutes);

// The pretty poster URL marketing email points at. Rewritten in vercel.json in
// production; declared here so a locally-pointed SITE_URL resolves the same way.
app.get('/e/:id/poster.jpg', (req, res, next) => {
  // The events router matches on req.url, so hand it the path it expects —
  // req.query is derived from req.url and follows.
  req.url = `/?id=${encodeURIComponent(req.params.id)}&format=poster`;
  eventsRoutes(req, res, next);
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    console.log('✅ Connected to MongoDB');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
