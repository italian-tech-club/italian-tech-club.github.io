import { lumaEventUrl } from './marketingAnalytics.js';

const API_BASE = 'https://public-api.luma.com';
const MAX_PAGES = 50;

export async function listLumaAttendees(eventUrl, { apiKey = process.env.LUMA_API_KEY, fetcher = fetch } = {}) {
  if (!apiKey) throw new Error('Luma is not connected. Add a calendar API key to sync registrations (requires Luma Plus).');
  const canonicalUrl = lumaEventUrl(eventUrl);
  if (!canonicalUrl) throw new Error('Invalid Luma event URL');
  const deadline = Date.now() + 40000;

  async function* pages(path, params = {}) {
    const cursors = new Set();
    let cursor;
    for (let page = 0; page < MAX_PAGES; page++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('Luma sync timed out. Please retry.');
      const url = new URL(path, API_BASE);
      url.search = new URLSearchParams({ ...params, pagination_limit: '100', ...(cursor ? { pagination_cursor: cursor } : {}) }).toString();
      const response = await fetcher(url, { headers: { 'x-luma-api-key': apiKey }, signal: AbortSignal.timeout(Math.min(10000, remaining)) });
      if (!response.ok) throw new Error(`Luma could not load registrations (HTTP ${response.status}). Check the calendar API key and Luma Plus subscription.`);
      const body = await response.json();
      if (!Array.isArray(body.entries) || typeof body.has_more !== 'boolean') throw new Error('Unexpected Luma response.');
      yield body.entries;
      if (!body.has_more) return;
      if (!body.next_cursor || cursors.has(body.next_cursor)) throw new Error('Incomplete Luma pagination. Please retry.');
      cursor = body.next_cursor;
      cursors.add(cursor);
    }
    throw new Error('This calendar or event exceeds the registration sync limit.');
  }

  let event;
  for await (const entries of pages('/v1/calendars/events/list', { access: 'manage' })) {
    event = entries.find((entry) => lumaEventUrl(entry.url) === canonicalUrl);
    if (event) break;
  }
  if (!event?.id || event.access !== 'manage') throw new Error('This event is not managed by the connected Luma calendar. Check the calendar and event link.');
  const attendees = [];
  for await (const guests of pages('/v1/events/guests/list', { event_id: event.id, approval_status: 'approved' })) {
    for (const guest of guests) {
      if (!guest.id || typeof guest.user_email !== 'string' || typeof guest.approval_status !== 'string' || !Array.isArray(guest.event_tickets)) {
        throw new Error('Unexpected Luma guest response. Existing conversions were preserved.');
      }
      const confirmed = guest.approval_status === 'approved' && guest.event_tickets.some((ticket) => ticket.amount === 0 || ticket.is_captured === true);
      attendees.push({
        id: guest.id, email: guest.user_email, created_at: guest.registered_at,
        status: confirmed ? 'valid' : 'pending', reference: `luma:${event.id}:${guest.id}`,
      });
    }
  }
  return attendees;
}
