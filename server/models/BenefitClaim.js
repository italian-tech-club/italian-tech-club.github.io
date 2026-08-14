import mongoose from 'mongoose';

// A member's personal code for one partner benefit. The code is the handshake:
// the member sends it to the partner, the partner checks it at /verify, and the
// verify page confirms the person is a current ITC member without either side
// needing an API integration.
const benefitClaimSchema = new mongoose.Schema({
  // Matches an id in src/data/partners.js. Kept as a plain string so retiring a
  // benefit from the catalog never orphans a code that's already in circulation.
  benefitId: { type: String, required: true },
  partnerSlug: { type: String, required: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityProfile', required: true },
  // Display form, dashed for readability: ITC-TIH-7QK9-AX2M
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  // Same code stripped of separators. Lookups go through this so a partner can
  // paste "itc tih 7qk9ax2m" or "ITCTIH7QK9AX2M" and still land on the claim.
  codeKey: { type: String, required: true, unique: true, uppercase: true, trim: true },
  // active   → good to use
  // redeemed → one-time benefit already used (partner marked it)
  // revoked  → pulled by an admin (member left, abuse)
  status: { type: String, enum: ['active', 'redeemed', 'revoked'], default: 'active' },
  redeemedAt: { type: Date, default: null },
  // Free-text note the partner leaves when marking a code redeemed.
  redeemedNote: { type: String, maxlength: 200, default: '' },
  // Verification telemetry — how often the partner has looked this code up. Also
  // the signal for "is anyone actually using this benefit".
  verifyCount: { type: Number, default: 0 },
  lastVerifiedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'benefit_claims',
});

// One code per member per benefit — makes claiming idempotent.
benefitClaimSchema.index({ profileId: 1, benefitId: 1 }, { unique: true });
benefitClaimSchema.index({ partnerSlug: 1 });

const BenefitClaim = mongoose.models.BenefitClaim || mongoose.model('BenefitClaim', benefitClaimSchema);

export default BenefitClaim;
