import mongoose from 'mongoose';

// Who a campaign goes to. Every audience excludes the opted-out — that filter
// is applied at send time and is not selectable, which is the point of it.
export const AUDIENCES = ['all', 'claimed', 'unclaimed', 'approved'];

const recipientSchema = new mongoose.Schema({
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityProfile', required: true },
  email: { type: String, required: true, lowercase: true },
  sentAt: { type: Date, default: Date.now },
}, { _id: false });

const marketingCampaignSchema = new mongoose.Schema({
  // Internal label for the list in /admin — never shown to a recipient.
  name: { type: String, required: true, trim: true, maxlength: 120 },
  subject: { type: String, required: true, trim: true, maxlength: 200 },
  // The grey line inboxes show after the subject. Worth its own field: left
  // empty, clients fill it with the first words of the hidden preheader div.
  preheader: { type: String, trim: true, maxlength: 200, default: '' },
  eyebrow: { type: String, trim: true, maxlength: 60, default: '' },
  headline: { type: String, trim: true, maxlength: 140, default: '' },
  // Plain text: blank lines separate paragraphs, **bold** / _italic_ /
  // [label](url) are the only markup, {{firstName}} / {{lastName}} substitute.
  body: { type: String, default: '' },
  signoff: { type: String, maxlength: 300, default: '' },
  ctaLabel: { type: String, trim: true, maxlength: 60, default: '' },
  ctaUrl: { type: String, trim: true, maxlength: 500, default: '' },
  // Optional: pulls the poster, date, time and venue of a real event into the
  // layout, so the copy never has to repeat facts that are already in the db.
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
  promoTitle: { type: String, trim: true, maxlength: 80, default: '' },
  promoCode: { type: String, trim: true, maxlength: 60, default: '' },
  promoNote: { type: String, trim: true, maxlength: 200, default: '' },
  audience: { type: String, enum: AUDIENCES, default: 'all' },
  // draft → never sent; sent → at least one real send has happened. There is no
  // 'sending' state: a send is one request that either finishes or doesn't.
  status: { type: String, enum: ['draft', 'sent'], default: 'draft' },
  lastSentAt: { type: Date, default: null },
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  // Everyone this campaign has actually reached. Kept so a second send can skip
  // them — the common case is topping up a list that grew, not mailing again.
  recipients: { type: [recipientSchema], default: [] },
}, {
  timestamps: true,
  collection: 'marketing_campaigns',
});

const MarketingCampaign = mongoose.models.MarketingCampaign
  || mongoose.model('MarketingCampaign', marketingCampaignSchema);

export default MarketingCampaign;
