import express from 'express';
import Campaign from '../models/MarketingCampaign.js';
import Delivery from '../models/MarketingDelivery.js';
import Profile from '../models/CommunityProfile.js';
import { resolveAdmin } from '../utils/adminAccess.js';
import { handleMarketingAnalytics } from '../utils/marketingHandler.js';

const router = express.Router();
router.all('/:action', async (req, res) => {
  try {
    await handleMarketingAnalytics(req, res, { Campaign, Delivery, Profile, authorize: resolveAdmin });
  } catch (error) {
    console.error('Marketing analytics:', error.message);
    res.status(500).json({ success: false, message: req.params.action === 'sync' ? error.message : 'Could not load email tracking. Please retry.' });
  }
});
export default router;
