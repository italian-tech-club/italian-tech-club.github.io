import mongoose from 'mongoose';

const sponsorInquirySchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: 100,
  },
  contactName: {
    type: String,
    required: [true, 'Contact name is required'],
    trim: true,
    maxlength: 100,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email'],
  },
  website: {
    type: String,
    trim: true,
    default: '',
  },
  sponsorshipType: {
    type: String,
    enum: ['event', 'venue', 'food-drinks', 'prizes', 'recurring', 'other'],
    default: 'event',
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    maxlength: 2000,
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'closed'],
    default: 'new',
  },
}, {
  timestamps: true,
  collection: 'sponsor_inquiries',
});

const SponsorInquiry = mongoose.model('SponsorInquiry', sponsorInquirySchema);

export default SponsorInquiry;
