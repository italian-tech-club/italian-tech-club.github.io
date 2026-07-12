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
  // Email delivery is optional: without RESEND_API_KEY the inquiry is still stored in MongoDB
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — sponsor inquiry saved to DB only');
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

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { companyName, contactName, email, website, sponsorshipTypes, sponsorshipType, message } = req.body;

    if (!companyName || !contactName || !email || !message) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email' });
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

    // Best-effort email; the inquiry is already persisted
    let emailSent = false;
    try {
      emailSent = await sendNotificationEmail(inquiry);
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
    }

    return res.status(201).json({
      success: true,
      message: 'Thanks! We received your inquiry and will get back to you soon.',
      emailSent,
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
}
