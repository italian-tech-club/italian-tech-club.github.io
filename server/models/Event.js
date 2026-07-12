import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  date: { type: String, required: true, trim: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  subtitle: { type: String, trim: true, maxlength: 300, default: '' },
  location: { type: String, required: true, trim: true, maxlength: 200 },
  time: { type: String, trim: true, maxlength: 50, default: null },
  type: { type: String, required: true, trim: true, maxlength: 50 },
  link: { type: String, trim: true, maxlength: 500, default: null },
  poster: { type: String, trim: true, maxlength: 500, default: null },
  gallery: { type: [String], default: [] },
}, {
  timestamps: true,
  collection: 'events',
});

eventSchema.index({ date: 1, title: 1 }, { unique: true });

const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);

export default Event;
