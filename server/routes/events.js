import express from 'express';
import crypto from 'crypto';
import Event from '../models/Event.js';

const router = express.Router();

const EVENT_FIELDS = ['date', 'title', 'subtitle', 'location', 'time', 'type', 'link', 'poster', 'gallery'];

function isAuthorized(req) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;

  // Hash both sides so timingSafeEqual gets equal-length buffers
  const a = crypto.createHash('sha256').update(token).digest();
  const b = crypto.createHash('sha256').update(adminPassword).digest();
  return crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res, next) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
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

/**
 * GET /api/events
 * Public list of all events, newest first
 */
router.get('/', async (_req, res) => {
  try {
    const events = await Event.find().sort({ date: -1 }).lean();
    return res.json({ success: true, events });
  } catch (error) {
    console.error('Error fetching events:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
});

/**
 * POST /api/events
 * With body { action: 'verify' }: check admin password.
 * Otherwise: create a new event (admin only).
 */
router.post('/', requireAdmin, async (req, res) => {
  if (req.body?.action === 'verify') {
    return res.json({ success: true });
  }

  try {
    const data = pickEventFields(req.body);
    if (!data.date || !data.title || !data.location || !data.type) {
      return res.status(400).json({ success: false, message: 'Missing required fields: date, title, location, type' });
    }

    const event = new Event(data);
    await event.save();
    return res.status(201).json({ success: true, event });
  } catch (error) {
    console.error('Error creating event:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'An event with this date and title already exists' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Failed to create event' });
  }
});

/**
 * PUT /api/events?id=<id>
 * Update an event (admin only)
 */
router.put('/', requireAdmin, async (req, res) => {
  try {
    const data = pickEventFields(req.body);
    const event = await Event.findByIdAndUpdate(req.query.id, data, { new: true, runValidators: true });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    return res.json({ success: true, event });
  } catch (error) {
    console.error('Error updating event:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'An event with this date and title already exists' });
    }
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Failed to update event' });
  }
});

/**
 * DELETE /api/events?id=<id>
 * Delete an event (admin only)
 */
router.delete('/', requireAdmin, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.query.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid event id' });
    }
    return res.status(500).json({ success: false, message: 'Failed to delete event' });
  }
});

export default router;
