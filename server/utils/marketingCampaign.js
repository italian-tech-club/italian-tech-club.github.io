/**
 * Sending side of the Marketing tab: who a campaign goes to, and what happens
 * to the roster when it does.
 *
 * Takes its mongoose models as arguments rather than importing them, for the
 * same reason server/utils/memberWelcome.js does — the Vercel function
 * registers its own copy of every schema, and importing server/models here
 * would double-register them.
 */
import crypto from 'crypto';
import { sendEmail, sendEmailBatch, SITE_URL } from './email.js';
import { renderMarketingEmail, eventFacts } from './marketingEmail.js';

const BATCH_SIZE = 100; // Resend batch endpoint hard limit

// Stand-in for {{firstName}} in a preview, or in a test sent to an address that
// isn't on the roster. Its unsubscribe link is deliberately inert.
export const PREVIEW_RECIPIENT = { firstName: 'Mario', lastName: 'Rossi', unsubscribeToken: 'preview' };

// Fields the admin composer owns. Anything else on a campaign (status, counts,
// recipients) is written by a send, never by a save.
export const CAMPAIGN_FIELDS = [
  'name', 'subject', 'preheader', 'eyebrow', 'headline', 'body', 'signoff',
  'ctaLabel', 'ctaUrl', 'eventId', 'promoTitle', 'promoCode', 'promoNote', 'audience',
];

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export function pickCampaignFields(body = {}) {
  const data = {};
  for (const field of CAMPAIGN_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  // An empty select is "no event", not a cast error on ''.
  if (data.eventId !== undefined && !data.eventId) data.eventId = null;
  return data;
}

/**
 * Who gets a campaign.
 *
 * Two exclusions apply to every audience and are not selectable, which is the
 * point of them: anyone who opted out, and anyone whose profile is `inactive`
 * (kept for records, not a person we still write to).
 */
export function audienceFilter(audience) {
  const base = {
    marketingOptOut: { $ne: true },
    status: { $ne: 'inactive' },
    email: { $nin: [null, ''] },
  };
  if (audience === 'claimed') return { ...base, claimed: true };
  if (audience === 'unclaimed') return { ...base, claimed: { $ne: true } };
  if (audience === 'approved') return { ...base, status: 'approved' };
  return base;
}

/** Headcount per audience, for the composer's "this will reach N people". */
export async function audienceCounts(CommunityProfile) {
  const [all, claimed, unclaimed, approved, optedOut] = await Promise.all([
    CommunityProfile.countDocuments(audienceFilter('all')),
    CommunityProfile.countDocuments(audienceFilter('claimed')),
    CommunityProfile.countDocuments(audienceFilter('unclaimed')),
    CommunityProfile.countDocuments(audienceFilter('approved')),
    CommunityProfile.countDocuments({ marketingOptOut: true }),
  ]);
  return { all, claimed, unclaimed, approved, optedOut };
}

export const unsubscribeUrl = (token, siteUrl = SITE_URL) => `${siteUrl}/unsubscribe?u=${token}`;

/**
 * Give every one of these profiles an unsubscribe token, minting the missing
 * ones. Written before anything is sent, so the link in the email already works
 * when it lands.
 */
async function ensureUnsubscribeTokens(profiles, CommunityProfile) {
  const missing = profiles.filter((p) => !p.unsubscribeToken);
  if (missing.length === 0) return;

  const ops = missing.map((profile) => {
    profile.unsubscribeToken = crypto.randomBytes(24).toString('hex');
    return {
      updateOne: {
        filter: { _id: profile._id },
        update: { $set: { unsubscribeToken: profile.unsubscribeToken } },
      },
    };
  });
  await CommunityProfile.bulkWrite(ops);
}

/** The linked event's poster and facts, or null when a campaign has no event. */
export async function campaignFacts(campaign, Event, siteUrl = SITE_URL) {
  if (!campaign.eventId) return null;
  const event = await Event.findById(campaign.eventId).select('title date time location link poster').lean();
  return eventFacts(event, siteUrl);
}

/**
 * Exactly what one person receives. The preview, the test send and the real
 * send all go through here, so what an admin approves is what ships.
 */
export function renderForRecipient({ campaign, facts, profile, siteUrl = SITE_URL }) {
  return renderMarketingEmail({
    campaign,
    facts,
    recipient: { firstName: profile.firstName, lastName: profile.lastName },
    unsubscribeUrl: unsubscribeUrl(profile.unsubscribeToken || 'preview', siteUrl),
    siteUrl,
  });
}

/**
 * Send one campaign to its audience.
 *
 * `skipAlreadySent` is the default because the ordinary second send is a top-up
 * of a list that grew since the first, not a re-mail of everyone.
 */
export async function sendCampaign({ campaign, CommunityProfile, Event, siteUrl = SITE_URL, skipAlreadySent = true }) {
  const already = new Set((campaign.recipients || []).map((r) => String(r.profileId)));
  const audience = await CommunityProfile.find(audienceFilter(campaign.audience))
    .select('firstName lastName email unsubscribeToken');

  const profiles = skipAlreadySent
    ? audience.filter((p) => !already.has(String(p._id)))
    : audience;

  if (profiles.length === 0) {
    return { sent: 0, failed: 0, skipped: audience.length, total: audience.length };
  }

  await ensureUnsubscribeTokens(profiles, CommunityProfile);
  const facts = await campaignFacts(campaign, Event, siteUrl);

  const messages = profiles.map((profile) => {
    const { subject, html, headers } = renderForRecipient({ campaign, facts, profile, siteUrl });
    return { to: profile.email, subject, html, headers };
  });

  const sentOk = new Set();
  for (const group of chunk(messages, BATCH_SIZE)) {
    const { results } = await sendEmailBatch(group);
    for (const result of results) if (result.ok) sentOk.add(result.to);
  }

  const now = new Date();
  const delivered = profiles.filter((p) => sentOk.has(p.email));

  if (delivered.length > 0) {
    await CommunityProfile.bulkWrite(delivered.map((p) => ({
      updateOne: {
        filter: { _id: p._id },
        update: { $set: { lastMarketingEmailAt: now }, $inc: { marketingEmailCount: 1 } },
      },
    })));
  }

  campaign.recipients.push(...delivered.map((p) => ({ profileId: p._id, email: p.email, sentAt: now })));
  campaign.sentCount += delivered.length;
  campaign.failedCount = profiles.length - delivered.length;
  campaign.lastSentAt = now;
  campaign.status = 'sent';
  await campaign.save();

  return {
    sent: delivered.length,
    failed: profiles.length - delivered.length,
    skipped: audience.length - profiles.length,
    total: audience.length,
  };
}

/**
 * One test copy to an arbitrary address. Renders through the same path as a
 * real send — including a live unsubscribe link when the address belongs to a
 * member — but records nothing on the campaign or the profile.
 */
export async function sendCampaignTest({ campaign, toEmail, CommunityProfile, Event, siteUrl = SITE_URL }) {
  const match = await CommunityProfile.findOne({ email: toEmail }).select('firstName lastName unsubscribeToken');
  if (match) await ensureUnsubscribeTokens([match], CommunityProfile);

  const facts = await campaignFacts(campaign, Event, siteUrl);
  const profile = match || PREVIEW_RECIPIENT;
  const { subject, html, headers } = renderForRecipient({ campaign, facts, profile, siteUrl });

  return sendEmail({ to: toEmail, subject: `[TEST] ${subject}`, html, headers });
}
