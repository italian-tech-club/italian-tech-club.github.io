import mongoose from 'mongoose';

const cofounderProfileSchema = new mongoose.Schema({
  // Personal Info
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: 50,
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: 50,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email'],
  },
  linkedIn: {
    type: String,
    required: [true, 'LinkedIn profile is required'],
    trim: true,
  },

  // Profile Picture (stored as base64 or URL)
  profilePic: {
    type: String,
    required: [true, 'Profile picture is required'],
  },

  // Selections
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: ['technical', 'non-technical', 'design', 'hybrid'],
  },
  stage: {
    type: String,
    required: [true, 'Stage is required'],
    enum: ['idea', 'exploring', 'building', 'experienced'],
  },
  commitment: {
    type: String,
    enum: ['fulltime', 'parttime', 'depends', ''],
    default: '',
  },
  industries: [{
    type: String,
    trim: true,
  }],

  // Hinge-style prompts
  prompts: {
    superpower: {
      type: String,
      maxlength: 300,
      default: '',
    },
    obsession: {
      type: String,
      maxlength: 300,
      default: '',
    },
    cofounder_type: {
      type: String,
      maxlength: 300,
      default: '',
    },
    looking_for: {
      type: String,
      maxlength: 300,
      default: '',
    },
    dealbreaker: {
      type: String,
      maxlength: 300,
      default: '',
    },
  },

  // Additional bio
  bio: {
    type: String,
    maxlength: 500,
    default: '',
  },

  // Metadata
  status: {
    type: String,
    enum: ['pending', 'approved', 'matched', 'inactive'],
    default: 'pending',
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  collection: 'cofounder_matching', // Explicit collection name as requested
});

// Index for faster queries (email index already created via unique: true)
cofounderProfileSchema.index({ role: 1, stage: 1 });
cofounderProfileSchema.index({ status: 1 });
cofounderProfileSchema.index({ industries: 1 });

const CofounderProfile = mongoose.model('CofounderProfile', cofounderProfileSchema);

export default CofounderProfile;
