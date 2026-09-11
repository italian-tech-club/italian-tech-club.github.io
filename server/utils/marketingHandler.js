import { applyResendEvent, summarizeCampaign, verifyResendWebhook } from './marketingAnalytics.js';
import { listEventAttendees, syncRegistrationConversions, syncProfileConversions } from './marketingConversions.js';
import { listLumaAttendees } from './marketingLuma.js';

async function readRawBody(req) {
  // Vercel installs a lazy JSON getter on req.body and restores the original
  // bytes on the stream. Reading that getter would lose the signed formatting.
  // Express raw() instead sets an ordinary Buffer-valued property.
  const body = Object.getOwnPropertyDescriptor(req, 'body')?.value;
  if (Buffer.isBuffer(body) || typeof body === 'string') {
    if (Buffer.byteLength(body) > 256 * 1024) throw new Error('Webhook body too large');
    return body;
  }
  if (body != null) throw new Error('Webhook body was parsed before signature verification');
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > 256 * 1024) { reject(new Error('Webhook body too large')); return; }
      chunks.push(Buffer.from(chunk));
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
    req.on('aborted', () => reject(new Error('Webhook request aborted')));
  });
}

// Shared by Express and Vercel. Dependencies make the public signature boundary
// and the admin report boundary testable without touching production data.
export async function handleMarketingAnalytics(req, res, {
  Campaign, Delivery, Profile, connect = async () => {}, authorize,
  env = process.env, fetcher = fetch,
}) {
  res.setHeader('Cache-Control', 'no-store');
  const action = req.params?.action || req.query.action;
  if (action === 'resend-webhook') {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
    if (!env.RESEND_WEBHOOK_SECRET) return res.status(503).json({ success: false, message: 'Email tracking is not configured' });
    let event;
    try {
      event = verifyResendWebhook(await readRawBody(req), req.headers, env.RESEND_WEBHOOK_SECRET);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature or body' });
    }
    await connect();
    return res.json({ success: true, ...await applyResendEvent(event, Delivery) });
  }

  if (!['report', 'sync'].includes(action)) return res.status(404).json({ success: false, message: 'Not found' });
  if (req.method !== (action === 'report' ? 'GET' : 'POST')) return res.status(405).json({ success: false, message: 'Method not allowed' });
  await connect();
  if (!await authorize(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const campaignId = req.query.campaignId;
  if (typeof campaignId !== 'string' || !/^[a-f\d]{24}$/i.test(campaignId)) return res.status(400).json({ success: false, message: 'Invalid campaign id' });
  const campaign = await Campaign.findById(campaignId).lean();
  if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
  let deliveries = await Delivery.find({ campaignId }).sort({ createdAt: 1 }).lean();
  const eventIds = [...new Set(deliveries.filter((d) => d.conversionGoal === 'registration').map((d) => d.gomryEventId || d.lumaEventUrl).filter(Boolean))];

  if (action === 'sync') {
    // A separate request per event keeps each sync within the serverless limit.
    const eventId = req.query.eventId;
    if (typeof eventId !== 'string' || !eventIds.includes(eventId)) return res.status(400).json({ success: false, message: 'No matching event in this campaign’s send history.' });
    const source = eventId.startsWith('https://luma.com/') ? 'luma' : 'gomry';
    const attendees = source === 'luma'
      ? await listLumaAttendees(eventId, { apiKey: env.LUMA_API_KEY, fetcher })
      : await listEventAttendees(eventId, { apiKey: env.GOMRY_API_KEY, fetcher });
    const result = await syncRegistrationConversions({ eventId, Delivery, attendees, source });
    await Campaign.updateOne({ _id: campaignId }, { $set: { analyticsSyncedAt: new Date() } });
    return res.json({ success: true, ...result });
  }

  // Also recovers a claim when its click webhook arrived after the claim itself.
  await syncProfileConversions({ Delivery, Profile, deliveries });
  deliveries = await Delivery.find({ campaignId }).sort({ createdAt: 1 }).lean();
  return res.json({
    success: true,
    ...summarizeCampaign(campaign, deliveries),
    conversionGoal: campaign.conversionGoal || 'none',
    conversionGoals: [...new Set(deliveries.map((d) => d.conversionGoal).filter((goal) => goal && goal !== 'none'))],
    eventIds,
    syncedAt: campaign.analyticsSyncedAt || null,
    setup: { webhookConfigured: Boolean(env.RESEND_WEBHOOK_SECRET), gomryConfigured: Boolean(env.GOMRY_API_KEY), lumaConfigured: Boolean(env.LUMA_API_KEY) },
  });
}
