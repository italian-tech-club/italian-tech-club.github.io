import mongoose from 'mongoose';

const communityProfileSchema = new mongoose.Schema({
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
  profilePic: {
    type: String,
    required: [true, 'Profile picture is required'],
  },
  profession: {
    type: String,
    required: [true, 'Profession is required'],
    trim: true,
    maxlength: 100,
  },
  company: {
    type: String,
    trim: true,
    maxlength: 100,
    default: '',
  },
  bio: {
    type: String,
    maxlength: 500,
    default: '',
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'inactive'],
    default: 'pending',
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  manageTokenHash: {
    type: String,
    default: null,
  },
  manageTokenExpiry: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
  collection: 'community_profiles',
});

communityProfileSchema.index({ status: 1 });

const CommunityProfile = mongoose.model('CommunityProfile', communityProfileSchema);

export default CommunityProfile;
