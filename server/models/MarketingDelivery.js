import mongoose from 'mongoose';

// One immutable send snapshot. Provider callbacks update this document, never
// the campaign composer, so editing/saving a campaign cannot erase its metrics.
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  campaignId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  email: { type: String, required: true, lowercase: true },
  name: String,
  resendId: String,
  ctaUrl: String,
  conversionGoal: { type: String, enum: ['none', 'registration', 'profile_claim'], default: 'none' },
  gomryEventId: String,
  lumaEventUrl: String,
  acceptedAt: Date,
  deliveredAt: Date,
  openedAt: Date,
  lastOpenedAt: Date,
  clickedAt: Date,
  lastClickedAt: Date,
  ctaClickedAt: Date,
  lastCtaClickedAt: Date,
  ctaClickTimes: { type: [Date], default: [] },
  bouncedAt: Date,
  complainedAt: Date,
  failedAt: Date,
  delayedAt: Date,
  unsubscribedAt: Date,
  lastEventAt: Date,
  convertedAt: Date,
  conversionSource: String,
  conversionReference: String,
  conversionKey: String,
}, { timestamps: true, collection: 'marketing_deliveries' });

schema.index({ resendId: 1 }, { unique: true, sparse: true });
schema.index({ conversionKey: 1 }, { unique: true, sparse: true });
schema.index({ conversionReference: 1 }, { unique: true, sparse: true });
schema.index({ profileId: 1, conversionGoal: 1, ctaClickedAt: -1 });
schema.index({ gomryEventId: 1, email: 1, conversionGoal: 1 });
schema.index({ lumaEventUrl: 1, email: 1, conversionGoal: 1 });

export default mongoose.models.MarketingDelivery || mongoose.model('MarketingDelivery', schema);
