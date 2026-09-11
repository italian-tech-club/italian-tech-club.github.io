import mongoose from 'mongoose';
import Campaign from '../../server/models/MarketingCampaign.js';
import Delivery from '../../server/models/MarketingDelivery.js';
import Profile from '../../server/models/CommunityProfile.js';
import { resolveAdmin } from '../../server/utils/adminAccess.js';
import { handleMarketingAnalytics } from '../../server/utils/marketingHandler.js';

async function connect() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    await handleMarketingAnalytics(req, res, { Campaign, Delivery, Profile, connect, authorize: resolveAdmin });
  } catch (error) {
    console.error('Marketing analytics:', error.message);
    return res.status(500).json({ success: false, message: req.query.action === 'sync' ? error.message : 'Could not load email tracking. Please retry.' });
  }
}
