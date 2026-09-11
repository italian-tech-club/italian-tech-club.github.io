import { recordConversion } from './marketingAnalytics.js';

// Separate from the membership client: analytics must finish inside Vercel's
// request budget, and an unavailable ticket provider must not hide email stats.
export async function listEventAttendees(eventId, { apiKey = process.env.GOMRY_API_KEY, fetcher = fetch } = {}) {
  if (!apiKey) throw new Error('Gomry is not connected. Set GOMRY_API_KEY to sync registrations.');
  if (!/^[a-zA-Z0-9_-]+$/.test(eventId)) throw new Error('Invalid Gomry event id');
  const attendees = [];
  const deadline = Date.now() + 40000;
  for (let page = 1; page <= 50; page++) {
    if (Date.now() >= deadline) throw new Error('Gomry sync timed out. Please retry.');
    const url = new URL(`https://www.gomry.com/api/v1/events/${eventId}/attendees`);
    url.search = new URLSearchParams({ page: String(page), page_size: '200', status: 'valid,checked_in' }).toString();
    const response = await fetcher(url, { headers: { 'X-API-KEY': apiKey }, signal: AbortSignal.timeout(Math.min(10000, deadline - Date.now())) });
    if (!response.ok) throw new Error(`Gomry could not load registrations (HTTP ${response.status}). Check the event and API key permissions.`);
    const body = await response.json();
    if (!Array.isArray(body.data) || !Number.isInteger(body.pagination?.total_pages)) throw new Error('Unexpected Gomry registration response.');
    attendees.push(...body.data);
    if (page >= body.pagination.total_pages) return attendees;
  }
  throw new Error('This event exceeds the registration sync limit.');
}

export async function syncRegistrationConversions({ eventId, Delivery, attendees, source = 'gomry' }) {
  const eventField = source === 'luma' ? 'lumaEventUrl' : 'gomryEventId';
  const valid = attendees.filter((a) => ['valid', 'checked_in'].includes(a.status) && a.email && a.id && a.created_at);
  const reference = (a) => a.reference || `${source}:${eventId}:${a.id}`;
  const references = valid.map(reference);
  // A refunded/cancelled ticket no longer represents a current registration.
  // Only reconcile after every page was fetched successfully.
  await Delivery.updateMany({ [eventField]: eventId, conversionSource: source, conversionReference: { $nin: references } }, {
    $unset: { convertedAt: 1, conversionSource: 1, conversionReference: 1, conversionKey: 1 },
  });
  let converted = 0;
  const candidates = await Delivery.find({ [eventField]: eventId, conversionGoal: 'registration', 'ctaClickTimes.0': { $exists: true } }).select('email').lean();
  const eligibleEmails = new Set(candidates.map((d) => d.email));
  for (const attendee of valid.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))) {
    if (!eligibleEmails.has(attendee.email.trim().toLowerCase())) continue;
    if (await recordConversion({ Delivery, email: attendee.email, goal: 'registration',
      occurredAt: attendee.created_at, source, reference: reference(attendee), eventId })) converted++;
  }
  return { registrations: valid.length, newConversions: converted };
}

export async function syncProfileConversions({ Delivery, Profile, deliveries }) {
  const profileIds = [...new Set(deliveries.filter((d) => d.conversionGoal === 'profile_claim' && d.ctaClickedAt).map((d) => String(d.profileId)))];
  if (!profileIds.length) return;
  const profiles = await Profile.find({ _id: { $in: profileIds }, claimedAt: { $ne: null }, claimed: true }).select('_id claimedAt').lean();
  for (const profile of profiles) {
    if (!profile.claimedAt) continue;
    await recordConversion({ Delivery, profileId: profile._id, goal: 'profile_claim',
      occurredAt: profile.claimedAt, source: 'profile_claim', reference: `claim:${profile._id}` });
  }
}
