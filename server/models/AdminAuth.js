import mongoose from 'mongoose';

// One-time login tokens (consumed on exchange)
const adminLoginTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  email: { type: String, required: true, lowercase: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'admin_login_tokens',
});
adminLoginTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Active admin sessions (Bearer token for the events API)
const adminSessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  email: { type: String, required: true, lowercase: true },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: true,
  collection: 'admin_sessions',
});
adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AdminLoginToken = mongoose.models.AdminLoginToken || mongoose.model('AdminLoginToken', adminLoginTokenSchema);
export const AdminSession = mongoose.models.AdminSession || mongoose.model('AdminSession', adminSessionSchema);
