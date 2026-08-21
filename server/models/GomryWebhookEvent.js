import mongoose from 'mongoose';

// Raw Gomry webhook deliveries, stored verbatim before any interpretation.
//
// Gomry's dashboard (Impostazioni Organizzazione → Integrazioni) posts to any
// number of URLs on two separate channels — new/updated form applications, and
// contact updates — but publishes no payload schema and no signing secret. So
// the receiver authenticates on a shared secret in the query string and keeps
// the untouched body here; the member-sync mapping reads from these documents
// rather than trusting a shape we guessed.
//
// Doubles as an audit log and a replay source: if the sync has a bug, the
// deliveries are still on disk to re-run against.
const gomryWebhookEventSchema = new mongoose.Schema({
  // Which dashboard channel delivered this. Gomry does not label its payloads,
  // so the receiver takes it from the registered URL's ?channel= parameter.
  channel: {
    type: String,
    enum: ['application', 'contact', 'unknown'],
    default: 'unknown',
    index: true,
  },
  // The complete request body, whatever its shape.
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  // Request headers, minus anything bearing the shared secret. Kept because a
  // signing header may appear here later without warning.
  headers: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  // Best-effort identifiers lifted from the payload for querying. Null when the
  // payload doesn't carry them — these are conveniences, not a contract.
  applicationId: { type: String, default: null, index: true },
  contactId: { type: String, default: null, index: true },
  status: { type: String, default: null },
  // Set once the member sync has consumed this delivery, so a replay can skip
  // what it already applied.
  processedAt: { type: Date, default: null },
  processError: { type: String, default: null },
}, {
  timestamps: true,
  collection: 'gomry_webhook_events',
});

// Deliveries are only interesting while the sync is catching up; 90 days is
// plenty for debugging and keeps member PII from accumulating indefinitely.
gomryWebhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const GomryWebhookEvent = mongoose.models.GomryWebhookEvent
  || mongoose.model('GomryWebhookEvent', gomryWebhookEventSchema);

export default GomryWebhookEvent;
