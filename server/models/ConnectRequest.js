import mongoose from 'mongoose';

// Double-opt-in intro between two members. The target decides via a tokenized
// email link; emails are only revealed to each other after acceptance.
const connectRequestSchema = new mongoose.Schema({
  fromProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityProfile', required: true },
  toProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityProfile', required: true },
  message: { type: String, maxlength: 500, default: '' },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  decisionTokenHash: { type: String, default: null },
  decisionTokenExpiry: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'connect_requests',
});
connectRequestSchema.index({ fromProfileId: 1, status: 1 });
connectRequestSchema.index({ toProfileId: 1, status: 1 });

export const ConnectRequest = mongoose.models.ConnectRequest || mongoose.model('ConnectRequest', connectRequestSchema);
