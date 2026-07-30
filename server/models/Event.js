import mongoose from 'mongoose';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// One-off changes to a recurring series: move a gathering, change its venue or
// time, or cancel it — the "unless otherwise specified" part of a fixed cadence.
// `occurrence` is the date the rule generated and stays the stable identity.
const recurrenceOverrideSchema = new mongoose.Schema({
  occurrence: { type: String, required: true, trim: true, match: ISO_DATE },
  date: { type: String, trim: true, default: null },
  time: { type: String, trim: true, maxlength: 50, default: null },
  location: { type: String, trim: true, maxlength: 200, default: null },
  note: { type: String, trim: true, maxlength: 200, default: null },
  cancelled: { type: Boolean, default: false },
}, { _id: false });

// A recurring series is stored as a single event document carrying this rule;
// individual gatherings are expanded on the client (see src/lib/eventSchedule.js).
const recurrenceSchema = new mongoose.Schema({
  frequency: { type: String, enum: ['weekly'], default: 'weekly' },
  interval: { type: Number, min: 1, max: 52, default: 1 },
  startDate: { type: String, required: true, trim: true, match: ISO_DATE },
  until: { type: String, trim: true, default: null },
  skipDates: { type: [String], default: [] },
  overrides: { type: [recurrenceOverrideSchema], default: [] },
}, { _id: false });

const eventSchema = new mongoose.Schema({
  // For a recurring series this is the first gathering; the rule drives the rest.
  date: { type: String, required: true, trim: true, match: ISO_DATE },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  subtitle: { type: String, trim: true, maxlength: 300, default: '' },
  location: { type: String, required: true, trim: true, maxlength: 200 },
  time: { type: String, trim: true, maxlength: 50, default: null },
  type: { type: String, required: true, trim: true, maxlength: 50 },
  link: { type: String, trim: true, maxlength: 500, default: null },
  // poster and gallery entries hold either repo image paths or base64 data URLs
  poster: { type: String, trim: true, default: null },
  gallery: { type: [String], default: [] },
  recurrence: { type: recurrenceSchema, default: null },
  // Slug tying a one-off event to a series, so each night keeps its own poster
  // and photos while still belonging to the standing appointment.
  series: { type: String, trim: true, maxlength: 60, default: null },
}, {
  timestamps: true,
  collection: 'events',
});

eventSchema.index({ date: 1, title: 1 }, { unique: true });

const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);

export default Event;
