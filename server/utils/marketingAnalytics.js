import crypto from 'node:crypto';

export const CONVERSION_GOALS = ['none', 'registration', 'profile_claim'];
const DAY = 86400000;
export const ATTRIBUTION_DAYS = 30;

export function gomryEventId(url) {
  try {
    const parsed = new URL(url);
    if (!['gomry.com', 'www.gomry.com', 'app.gomry.com'].includes(parsed.hostname)) return '';
    return parsed.pathname.match(/^\/event\/([a-zA-Z0-9_-]+)\/?$/)?.[1] || '';
  } catch { return ''; }
}

export function lumaEventUrl(url) {
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol) || !['luma.com', 'lu.ma', 'www.luma.com'].includes(parsed.hostname)) return '';
    const slug = parsed.pathname.match(/^\/([a-zA-Z0-9_-]+)\/?$/)?.[1];
    return slug ? `https://luma.com/${slug}` : '';
  } catch { return ''; }
}

export function campaignCtaUrl(url, campaignId, deliveryId) {
  if (!url) return '';
  let parsed;
  try {
    parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error();
  } catch {
    const error = new Error('The button link must be a valid https:// or http:// URL.');
    error.status = 400;
    throw error;
  }
  parsed.searchParams.set('utm_source', 'itc');
  parsed.searchParams.set('utm_medium', 'email');
  parsed.searchParams.set('utm_campaign', String(campaignId));
  parsed.searchParams.set('utm_content', deliveryId);
  return parsed.toString();
}

// Raw bytes are required. JSON.parse/stringify changes the signed content.
// Protocol: https://docs.svix.com/receiving/verifying-payloads/how-manual
export function verifyResendWebhook(rawBody, headers, secret, now = Date.now()) {
  if (!secret?.startsWith('whsec_')) throw new Error('Webhook signing secret is missing');
  if (!Buffer.isBuffer(rawBody) && typeof rawBody !== 'string') throw new Error('Raw request body required');
  const id = headers['svix-id'];
  const timestamp = headers['svix-timestamp'];
  const signatures = headers['svix-signature'];
  if (typeof id !== 'string' || typeof timestamp !== 'string' || typeof signatures !== 'string'
    || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) {
    throw new Error('Invalid webhook headers');
  }
  const key = Buffer.from(secret.slice(6), 'base64');
  if (!key.length) throw new Error('Invalid signing secret');
  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.`).update(rawBody).digest();
  const valid = signatures.split(' ').some((signature) => {
    const [version, value] = signature.split(',');
    if (version !== 'v1' || !value) return false;
    const actual = Buffer.from(value, 'base64');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  });
  if (!valid) throw new Error('Invalid webhook signature');
  return JSON.parse(rawBody.toString());
}

const eventFields = {
  'email.sent': 'acceptedAt',
  'email.delivered': 'deliveredAt',
  'email.bounced': 'bouncedAt',
  'email.complained': 'complainedAt',
  'email.failed': 'failedAt',
  'email.suppressed': 'failedAt',
  'email.delivery_delayed': 'delayedAt',
  'email.opened': 'openedAt',
  'email.clicked': 'clickedAt',
};

export function resendEventUpdate(event, delivery) {
  const field = eventFields[event.type];
  if (!field) return null;
  const at = new Date(event.type === 'email.clicked' ? event.data?.click?.timestamp || event.created_at : event.created_at);
  if (!Number.isFinite(at.getTime())) throw new Error('Missing event timestamp');
  // min/max are both order-independent and idempotent: retries never inflate a
  // rate, and a late delivery event cannot overwrite an open or a click.
  const update = { $min: { [field]: at }, $max: { lastEventAt: at } };
  if (event.type === 'email.opened') update.$max.lastOpenedAt = at;
  if (event.type === 'email.clicked') {
    update.$max.lastClickedAt = at;
    if (delivery.ctaUrl && event.data?.click?.link === delivery.ctaUrl) {
      update.$min.ctaClickedAt = at;
      update.$max.lastCtaClickedAt = at;
      update.$addToSet = { ctaClickTimes: at };
    }
  }
  return update;
}

export async function applyResendEvent(event, Delivery) {
  if (!eventFields[event?.type] || typeof event.data?.email_id !== 'string') return { ignored: true };
  const tags = Array.isArray(event.data.tags)
    ? Object.fromEntries(event.data.tags.map((tag) => [tag.name, tag.value])) : event.data.tags || {};
  const tagged = typeof tags.itc_delivery === 'string' && /^[a-f0-9]{32}$/.test(tags.itc_delivery);
  const filter = tagged ? { _id: tags.itc_delivery } : { resendId: event.data.email_id };
  const delivery = await Delivery.findOne(filter).lean();
  if (!delivery) return { ignored: true };
  // Tags let a callback find its pre-created send even before the send request
  // has returned. Refuse to attach a second provider message to the same send.
  if (delivery.resendId && delivery.resendId !== event.data.email_id) return { ignored: true };
  const update = resendEventUpdate(event, delivery);
  update.$set = { resendId: event.data.email_id };
  await Delivery.updateOne({ _id: delivery._id, $or: [{ resendId: { $exists: false } }, { resendId: event.data.email_id }] }, update);
  return { received: true };
}

const first = (a, b) => !a || (b && new Date(b) < new Date(a)) ? b : a;
const last = (a, b) => !a || (b && new Date(b) > new Date(a)) ? b : a;
const rate = (n, d) => d ? Math.round(n / d * 1000) / 10 : null;

export function summarizeCampaign(campaign, deliveries) {
  const people = new Map();
  // Old sends remain visible, but have unknown engagement, rather than being
  // silently included in the denominator of newly instrumented sends.
  for (const r of campaign.recipients || []) {
    const key = String(r.profileId);
    people.set(key, { profileId: key, email: r.email, sentAt: r.sentAt, tracked: false });
  }
  for (const d of deliveries) {
    const key = String(d.profileId);
    const person = people.get(key) || { profileId: key, email: d.email };
    person.name = d.name;
    person.tracked = true;
    person.sentAt = last(person.sentAt, d.acceptedAt);
    for (const field of ['acceptedAt', 'deliveredAt', 'openedAt', 'clickedAt', 'ctaClickedAt', 'bouncedAt', 'complainedAt', 'failedAt', 'delayedAt', 'unsubscribedAt', 'convertedAt']) {
      person[field] = first(person[field], d[field]);
    }
    for (const field of ['lastOpenedAt', 'lastClickedAt', 'lastCtaClickedAt']) person[field] = last(person[field], d[field]);
    people.set(key, person);
  }
  const recipients = [...people.values()];
  const tracked = recipients.filter((p) => p.tracked);
  const delivered = tracked.filter((p) => p.deliveredAt);
  const count = (field) => tracked.filter((p) => p[field]).length;
  const stats = {
    recipients: recipients.length,
    accepted: count('acceptedAt'),
    untracked: recipients.filter((p) => !p.tracked).length,
    delivered: delivered.length,
    opened: count('openedAt'),
    clicked: count('clickedAt'),
    ctaClicked: count('ctaClickedAt'),
    bounced: count('bouncedAt'),
    complained: count('complainedAt'),
    failed: count('failedAt'),
    unsubscribed: count('unsubscribedAt'),
    converted: count('convertedAt'),
    // Numerators share the denominator's cohort, even when callbacks arrive
    // out of order. The raw counts still show events awaiting delivery data.
    openRate: rate(delivered.filter((p) => p.openedAt).length, delivered.length),
    clickRate: rate(delivered.filter((p) => p.ctaClickedAt).length, delivered.length),
    conversionRate: rate(delivered.filter((p) => p.convertedAt).length, delivered.length),
    clickToConversionRate: rate(tracked.filter((p) => p.ctaClickedAt && p.convertedAt).length, count('ctaClickedAt')),
    lastEventAt: deliveries.reduce((at, d) => last(at, d.lastEventAt), null),
  };
  return { stats, recipients };
}

// Last observed CTA click, within 30 days and before the completed action.
// One conversion per campaign/member. This is attribution, not proof of cause.
export async function recordConversion({ Delivery, profileId, email, goal, occurredAt, source, reference, eventId }) {
  const at = new Date(occurredAt);
  if (!Number.isFinite(at.getTime()) || at.getTime() > Date.now() + 300000) return false;
  const filter = {
    conversionGoal: goal,
    ctaClickTimes: { $elemMatch: { $gte: new Date(at.getTime() - ATTRIBUTION_DAYS * DAY), $lte: at } },
    ...(profileId ? { profileId } : { email: String(email || '').trim().toLowerCase() }),
    ...(eventId ? { [source === 'luma' ? 'lumaEventUrl' : 'gomryEventId']: eventId } : {}),
  };
  const candidates = await Delivery.find(filter).lean();
  const latestClick = (d) => Math.max(...d.ctaClickTimes.map((t) => new Date(t).getTime())
    .filter((t) => t <= at.getTime() && t >= at.getTime() - ATTRIBUTION_DAYS * DAY));
  const delivery = candidates.sort((a, b) => latestClick(b) - latestClick(a))[0];
  if (!delivery) return false;
  try {
    const result = await Delivery.updateOne({ _id: delivery._id, convertedAt: { $exists: false } }, {
      $set: {
        convertedAt: at, conversionSource: source, conversionReference: reference,
        conversionKey: `${delivery.campaignId}:${delivery.profileId}`,
      },
    });
    return result.modifiedCount > 0;
  } catch (error) {
    if (error.code === 11000) return false;
    throw error;
  }
}

export async function recordCampaignUnsubscribe({ Delivery, profileId, deliveryId, optOut }) {
  if (typeof deliveryId !== 'string' || !/^[a-f0-9]{32}$/.test(deliveryId)) return;
  // The caller has already verified the member's unsubscribe token. Bind the
  // delivery too: a link cannot mark a different member as opted out.
  await Delivery.updateOne({ _id: deliveryId, profileId }, optOut
    ? { $min: { unsubscribedAt: new Date() } }
    : { $unset: { unsubscribedAt: 1 } });
}
