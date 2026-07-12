import express from 'express';
import crypto from 'crypto';
import SponsorInquiry from '../models/SponsorInquiry.js';
import { AdminSession } from '../models/AdminAuth.js';

const router = express.Router();

async function requireAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const session = await AdminSession.findOne({ tokenHash, expiresAt: { $gt: new Date() } });
      if (session) return next();
    }
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  } catch (error) {
    console.error('Auth check failed:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong' });
  }
}

const SPONSOR_TO_EMAIL = process.env.SPONSOR_TO_EMAIL || 'ciao@italiantechclubnyc.com';
const SPONSOR_FROM_EMAIL = process.env.SPONSOR_FROM_EMAIL || 'ITC Website <onboarding@resend.dev>';

const TYPE_LABELS = {
  event: 'Sponsor an event',
  venue: 'Provide a venue',
  'food-drinks': 'Food & drinks',
  prizes: 'Prizes / swag',
  recurring: 'Recurring partnership',
  other: 'Other',
};

async function sendNotificationEmail(inquiry) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY not set — sponsor inquiry saved to DB only');
    return false;
  }

  const escapeHtml = (str = '') => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const html = `
    <h2>New sponsorship inquiry 🇮🇹</h2>
    <p><strong>Company:</strong> ${escapeHtml(inquiry.companyName)}</p>
    <p><strong>Contact:</strong> ${escapeHtml(inquiry.contactName)}</p>
    <p><strong>Email:</strong> ${escapeHtml(inquiry.email)}</p>
    ${inquiry.website ? `<p><strong>Website:</strong> ${escapeHtml(inquiry.website)}</p>` : ''}
    <p><strong>Interested in:</strong> ${(inquiry.sponsorshipTypes || []).map(t => TYPE_LABELS[t] || t).join(', ') || '—'}</p>
    <p><strong>Message:</strong></p>
    <p style="white-space: pre-wrap;">${escapeHtml(inquiry.message)}</p>
    <hr />
    <p style="color: #64748b; font-size: 12px;">Sent from the sponsor form on italiantechclubnyc.com</p>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: SPONSOR_FROM_EMAIL,
      to: [SPONSOR_TO_EMAIL],
      reply_to: inquiry.email,
      subject: `Sponsorship inquiry from ${inquiry.companyName}`,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('Resend API error:', response.status, body);
    return false;
  }

  return true;
}

/**
 * POST /api/sponsor/submit
 * Submit a sponsorship inquiry (stored in DB + emailed to the team)
 */
router.post('/submit', async (req, res) => {
  try {
    const { companyName, contactName, email, website, sponsorshipTypes, sponsorshipType, message } = req.body;

    if (!companyName || !contactName || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const inquiry = new SponsorInquiry({
      companyName: companyName.trim(),
      contactName: contactName.trim(),
      email: email.toLowerCase().trim(),
      website: website?.trim() || '',
      // Accept the legacy single value from clients on the old bundle
      sponsorshipTypes: Array.isArray(sponsorshipTypes)
        ? sponsorshipTypes
        : (sponsorshipType ? [sponsorshipType] : ['event']),
      message: message.trim(),
    });

    await inquiry.save();

    console.log(`✅ New sponsor inquiry from: ${inquiry.companyName} (${inquiry.email})`);

    let emailSent = false;
    try {
      emailSent = await sendNotificationEmail(inquiry);
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Thanks! We received your inquiry and will get back to you soon.',
      emailSent,
    });

  } catch (error) {
    console.error('❌ Error submitting sponsor inquiry:', error);

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
 * GET /api/sponsor/inquiries — list all inquiries (admin only)
 */
router.get('/inquiries', requireAdmin, async (_req, res) => {
  try {
    const inquiries = await SponsorInquiry.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, inquiries, count: inquiries.length });
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch inquiries' });
  }
});

/**
 * PUT /api/sponsor/inquiries?id= — update inquiry status (admin only)
 */
router.put('/inquiries', requireAdmin, async (req, res) => {
  try {
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
    res.json({ success: true, inquiry });
  } catch (error) {
    console.error('Error updating inquiry:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid inquiry id' });
    }
    res.status(500).json({ success: false, message: 'Failed to update inquiry' });
  }
});

export default router;
