import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import Delivery from '../server/models/MarketingDelivery.js';
import Campaign from '../server/models/MarketingCampaign.js';
import Profile from '../server/models/CommunityProfile.js';
import { applyResendEvent, campaignCtaUrl, gomryEventId, lumaEventUrl, recordCampaignUnsubscribe, recordConversion, summarizeCampaign, verifyResendWebhook } from '../server/utils/marketingAnalytics.js';
import { listEventAttendees, syncRegistrationConversions, syncProfileConversions } from '../server/utils/marketingConversions.js';
import { listLumaAttendees } from '../server/utils/marketingLuma.js';
import { handleMarketingAnalytics } from '../server/utils/marketingHandler.js';
import { pickCampaignFields, sendCampaign, sendCampaignTest } from '../server/utils/marketingCampaign.js';

let mongo;
const now = Date.now();
const day = 86400000;
const secret = `whsec_${Buffer.from('marketing-test-secret-only').toString('base64')}`;
const date = (offset) => new Date(now + offset * day);
const profileId = new mongoose.Types.ObjectId();
const campaignId = new mongoose.Types.ObjectId();
const id = 'a'.repeat(32);
const url = 'https://www.gomry.com/event/event123?utm_source=website#tickets';
const seed = (extra = {}) => Delivery.create({ _id: id, campaignId, profileId, email: 'mario@example.com', ctaUrl: campaignCtaUrl(url, campaignId, id), ...extra });
const event = (type, at, extra = {}) => ({ type, created_at: at.toISOString(), data: {
  email_id: 'resend-123', tags: { itc_delivery: id }, ...extra,
} });
const sign = (body, timestamp = String(Math.floor(Date.now() / 1000))) => {
  const headers = { 'svix-id': 'msg_test', 'svix-timestamp': timestamp };
  headers['svix-signature'] = `v1,${crypto.createHmac('sha256', Buffer.from(secret.slice(6), 'base64')).update(`msg_test.${timestamp}.${body}`).digest('base64')}`;
  return headers;
};
const response = () => ({ statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(s) { this.statusCode = s; return this; }, json(body) { this.body = body; return this; } });

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([Delivery.init(), Campaign.init(), Profile.init()]);
});
beforeEach(async () => { await Promise.all([Delivery.deleteMany({}), Campaign.deleteMany({}), Profile.deleteMany({})]); });
after(async () => { await mongoose.disconnect(); await mongo?.stop(); });

test('Svix official signature vector and byte-exact verification', () => {
  const body = '{"event_type":"ping","data":{"success":true}}';
  const headers = { 'svix-id': 'msg_loFOjxBNrRLzqYUf', 'svix-timestamp': '1731705121', 'svix-signature': 'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=' };
  const key = 'whsec_plJ3nmyCDGBKInavdOK15jsl';
  assert.equal(verifyResendWebhook(Buffer.from(body), headers, key, 1731705121000).event_type, 'ping');
  assert.throws(() => verifyResendWebhook(body + ' ', headers, key, 1731705121000));
  assert.throws(() => verifyResendWebhook(JSON.parse(body), headers, key, 1731705121000));
  assert.throws(() => verifyResendWebhook(body, headers, key, 1731705422000));
  assert.throws(() => verifyResendWebhook(body, headers, key, 1731704819000));
});

test('tracking URLs preserve destination parameters and fragments and reject executable URLs', () => {
  const result = new URL(campaignCtaUrl(url, campaignId, id));
  assert.equal(result.hash, '#tickets');
  assert.equal(result.searchParams.get('utm_medium'), 'email');
  assert.equal(result.searchParams.get('utm_content'), id);
  assert.equal(gomryEventId(result), 'event123');
  assert.equal(gomryEventId('https://gomry.com.evil.com/event/123'), '');
  assert.throws(() => campaignCtaUrl('javascript:alert(1)', campaignId, id));
});

test('incomplete conversion drafts can preview but cannot be saved without a supported event destination', () => {
  assert.equal(pickCampaignFields({ conversionGoal: 'registration' }).conversionGoal, 'registration');
  assert.throws(() => pickCampaignFields({ conversionGoal: 'registration' }, { validateGoal: true }), /Gomry/);
  assert.throws(() => pickCampaignFields({ ctaUrl: 'javascript:alert(1)' }), /valid https/);
  assert.equal(pickCampaignFields({ conversionGoal: 'registration', ctaUrl: url }, { validateGoal: true }).ctaUrl, url);
  assert.equal(lumaEventUrl('https://lu.ma/supper?utm_source=email#tickets'), 'https://luma.com/supper');
  assert.equal(lumaEventUrl('https://luma.com.evil.com/supper'), '');
  assert.equal(lumaEventUrl('https://luma.com/calendar/manage'), '');
  assert.equal(pickCampaignFields({ conversionGoal: 'registration', ctaUrl: 'https://luma.com/supper' }, { validateGoal: true }).ctaUrl, 'https://luma.com/supper');
});

test('Luma finds the calendar event, follows guest pages, and excludes incomplete payments', async () => {
  const calls = [];
  const guest = (id, approval_status, amount, is_captured, registered_at = date(-1).toISOString()) => ({
    id, user_email: `${id}@example.com`, approval_status, registered_at, event_tickets: [{ amount, is_captured }],
  });
  const responses = [
    { entries: [{ id: 'evt-other', url: 'https://luma.com/other', access: 'manage' }], has_more: true, next_cursor: 'calendar-next' },
    { entries: [{ id: 'evt-supper', url: 'https://lu.ma/supper', access: 'manage' }], has_more: false },
    { entries: [guest('free', 'approved', 0, false), guest('paid', 'approved', 2500, true)], has_more: true, next_cursor: 'guests-next' },
    { entries: [guest('unpaid', 'approved', 2500, false), guest('waiting', 'waitlist', 0, false), guest('invited', 'invited', 0, false, null)], has_more: false },
  ];
  const attendees = await listLumaAttendees('https://luma.com/supper', { apiKey: 'test-only', fetcher: async (url, options) => {
    calls.push(url); assert.equal(options.headers['x-luma-api-key'], 'test-only');
    assert.equal(url.origin, 'https://public-api.luma.com');
    return { ok: true, json: async () => responses.shift() };
  } });
  assert.equal(calls[1].searchParams.get('pagination_cursor'), 'calendar-next');
  assert.equal(calls[2].searchParams.get('event_id'), 'evt-supper');
  assert.equal(calls[3].searchParams.get('pagination_cursor'), 'guests-next');
  assert.deepEqual(attendees.filter((a) => a.status === 'valid').map((a) => a.id), ['free', 'paid']);
  assert.equal(attendees[0].reference, 'luma:evt-supper:free');
  await assert.rejects(listLumaAttendees('https://luma.com/supper', { apiKey: '' }), /not connected/);
});

test('Luma conversion attribution stays within its event and removes cancelled registrations', async () => {
  await seed({ conversionGoal: 'registration', lumaEventUrl: 'https://luma.com/supper', ctaClickTimes: [date(-2)] });
  await seed({ _id: 'b'.repeat(32), campaignId: new mongoose.Types.ObjectId(), gomryEventId: 'supper', ctaClickTimes: [date(-1.5)], conversionGoal: 'registration' });
  const attendees = [{ id: 'gst-one', email: 'mario@example.com', status: 'valid', created_at: date(-1), reference: 'luma:evt-supper:gst-one' }];
  const args = { Delivery, eventId: 'https://luma.com/supper', source: 'luma', attendees };
  assert.equal((await syncRegistrationConversions(args)).newConversions, 1);
  assert.equal((await syncRegistrationConversions(args)).newConversions, 0);
  assert.equal((await Delivery.findById(id)).conversionSource, 'luma');
  assert.equal((await Delivery.findById('b'.repeat(32))).convertedAt, undefined);
  await syncRegistrationConversions({ ...args, attendees: [] });
  assert.equal((await Delivery.findById(id)).convertedAt, undefined);
});

test('Luma sync rejects incomplete pagination before changing existing conversions', async () => {
  await Campaign.create({ _id: campaignId, name: 'Luma campaign', subject: 'Supper', conversionGoal: 'registration' });
  await seed({ conversionGoal: 'registration', lumaEventUrl: 'https://luma.com/supper', convertedAt: date(-1), conversionSource: 'luma', conversionReference: 'luma:evt-supper:gst-one' });
  const responses = [
    { entries: [{ id: 'evt-supper', url: 'https://luma.com/supper', access: 'manage' }], has_more: false },
    { entries: [], has_more: true },
  ];
  const deps = { Campaign, Delivery, Profile, authorize: async () => true, env: { LUMA_API_KEY: 'test-only' }, fetcher: async () => ({ ok: true, json: async () => responses.shift() }) };
  await assert.rejects(handleMarketingAnalytics({ method: 'POST', query: { action: 'sync', campaignId: String(campaignId), eventId: 'https://luma.com/supper' } }, response(), deps), /Incomplete Luma/);
  assert.equal(+(await Delivery.findById(id)).convertedAt, +date(-1));
  const res = response();
  await handleMarketingAnalytics({ method: 'GET', query: { action: 'report', campaignId: String(campaignId) } }, res, deps);
  assert.deepEqual(res.body.eventIds, ['https://luma.com/supper']);
  assert.equal(res.body.setup.lumaConfigured, true);
  const denied = response();
  await handleMarketingAnalytics({ method: 'POST', query: { action: 'sync', campaignId: String(campaignId), eventId: 'https://luma.com/unrelated' } }, denied, deps);
  assert.equal(denied.statusCode, 400);
});

test('duplicate and reordered provider callbacks preserve first/last timestamps without inflating results', async () => {
  const delivery = await seed();
  const clicked = event('email.clicked', date(-1), { click: { link: delivery.ctaUrl, timestamp: date(-1).toISOString() } });
  await Promise.all([applyResendEvent(clicked, Delivery), applyResendEvent(clicked, Delivery)]);
  await applyResendEvent(event('email.opened', date(-2)), Delivery);
  await applyResendEvent(event('email.opened', date(-3)), Delivery);
  await applyResendEvent(event('email.delivered', date(-4)), Delivery);
  const saved = await Delivery.findById(id).lean();
  assert.equal(+saved.openedAt, +date(-3));
  assert.equal(+saved.lastOpenedAt, +date(-2));
  assert.equal(+saved.ctaClickedAt, +date(-1));
  assert.equal(saved.ctaClickTimes.length, 1);
  assert.equal(saved.resendId, 'resend-123');
  const report = summarizeCampaign({ recipients: [] }, [saved]);
  assert.equal(report.stats.ctaClicked, 1);
  assert.equal(report.stats.clickRate, 100);
});

test('clicks on other links do not count as CTA clicks, and transactional events are ignored', async () => {
  await seed();
  await applyResendEvent(event('email.clicked', date(-1), { click: { link: 'https://example.com/unsubscribe' } }), Delivery);
  const saved = await Delivery.findById(id).lean();
  assert.ok(saved.clickedAt);
  assert.equal(saved.ctaClickedAt, undefined);
  assert.deepEqual(await applyResendEvent(event('email.opened', date(-1), { email_id: 'transactional', tags: {} }), Delivery), { ignored: true });
  assert.deepEqual(await applyResendEvent(event('email.opened', date(-1), { email_id: 'different-message' }), Delivery), { ignored: true });
});

test('reports deduplicate repeat recipients and exclude untracked/missing-delivery recipients from rates', () => {
  const campaign = { recipients: [{ profileId: 'old', email: 'old@example.com', sentAt: date(-5) }] };
  const report = summarizeCampaign(campaign, [
    { profileId: 'one', email: 'one@example.com', acceptedAt: date(-5), deliveredAt: date(-4), openedAt: date(-3) },
    { profileId: 'one', email: 'one@example.com', openedAt: date(-2) },
    { profileId: 'two', email: 'two@example.com', openedAt: date(-2), ctaClickedAt: date(-1), convertedAt: date(0) },
  ]);
  assert.equal(report.stats.untracked, 1);
  assert.equal(report.stats.opened, 2);
  assert.equal(report.stats.delivered, 1);
  assert.equal(report.stats.openRate, 100);
  assert.equal(report.stats.clickRate, 0);
  assert.equal(report.stats.conversionRate, 0);
  assert.equal(report.stats.clickToConversionRate, 100);
  assert.equal(summarizeCampaign({}, []).stats.openRate, null);
});

test('conversion attribution selects the latest click BEFORE registration, across campaigns', async () => {
  await seed({ conversionGoal: 'registration', gomryEventId: 'event123', ctaClickTimes: [date(-5), date(-1)] });
  const second = await seed({ _id: 'b'.repeat(32), campaignId: new mongoose.Types.ObjectId(), conversionGoal: 'registration', gomryEventId: 'event123', ctaClickTimes: [date(-4)] });
  const args = { Delivery, email: 'Mario@Example.com', goal: 'registration', occurredAt: date(-3), source: 'gomry', reference: 'ticket-123', eventId: 'event123' };
  assert.equal(await recordConversion(args), true);
  assert.equal((await Delivery.findById(id)).convertedAt, undefined);
  assert.ok((await Delivery.findById(second._id)).convertedAt);
  assert.equal(await recordConversion(args), false);
});

test('conversions reject pre-existing registrations, expired clicks and unrelated events/goals', async () => {
  await seed({ conversionGoal: 'registration', gomryEventId: 'event123', ctaClickTimes: [date(-31)] });
  const args = { Delivery, email: 'mario@example.com', goal: 'registration', occurredAt: date(0), source: 'gomry', reference: 'ticket-123', eventId: 'event123' };
  assert.equal(await recordConversion(args), false);
  await Delivery.updateOne({ _id: id }, { $set: { ctaClickTimes: [date(-1)] } });
  assert.equal(await recordConversion({ ...args, occurredAt: date(-2) }), false);
  assert.equal(await recordConversion({ ...args, eventId: 'other-event' }), false);
  assert.equal(await recordConversion({ ...args, goal: 'profile_claim' }), false);
});

test('concurrent registration notifications count once per campaign/member', async () => {
  await seed({ conversionGoal: 'registration', gomryEventId: 'event123', ctaClickTimes: [date(-1)] });
  const args = { Delivery, email: 'mario@example.com', goal: 'registration', occurredAt: date(0), source: 'gomry', reference: 'ticket-123', eventId: 'event123' };
  const results = await Promise.all([recordConversion(args), recordConversion(args)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await Delivery.countDocuments({ convertedAt: { $exists: true } }), 1);
});

test('Gomry sync handles pagination and excludes pending registrations', async () => {
  const pages = [];
  const attendees = await listEventAttendees('event123', { apiKey: 'test', fetcher: async (url) => {
    pages.push(url.searchParams.get('page'));
    assert.equal(url.searchParams.get('status'), 'valid,checked_in');
    return { ok: true, json: async () => ({ data: [{ id: `ticket-${pages.length}` }], pagination: { total_pages: 2 } }) };
  } });
  assert.deepEqual(pages, ['1', '2']);
  assert.equal(attendees.length, 2);
  await seed({ conversionGoal: 'registration', gomryEventId: 'event123', ctaClickTimes: [date(-1)] });
  const result = await syncRegistrationConversions({ Delivery, eventId: 'event123', attendees: [
    { id: 'pending', email: 'mario@example.com', status: 'pending_approval', created_at: date(0).toISOString() },
  ] });
  assert.equal(result.newConversions, 0);
  await assert.rejects(listEventAttendees('event123', { apiKey: 'test', fetcher: async () => ({ ok: false, status: 403 }) }), /HTTP 403/);
});

test('cancelled Gomry tickets remove conversions only after a complete successful sync', async () => {
  await seed({ conversionGoal: 'registration', gomryEventId: 'event123', ctaClickTimes: [date(-1)] });
  const attendee = { id: 'ticket-123', email: 'mario@example.com', status: 'valid', created_at: date(0).toISOString() };
  await syncRegistrationConversions({ Delivery, eventId: 'event123', attendees: [attendee] });
  assert.ok((await Delivery.findById(id)).convertedAt);
  await syncRegistrationConversions({ Delivery, eventId: 'event123', attendees: [] });
  assert.equal((await Delivery.findById(id)).convertedAt, undefined);
});

test('delayed click webhooks can recover first profile claim conversions', async () => {
  await seed({ conversionGoal: 'profile_claim', ctaClickedAt: date(-1), ctaClickTimes: [date(-1)] });
  await Profile.create({ _id: profileId, firstName: 'Mario', lastName: 'Rossi', profession: 'Engineer', email: 'mario@example.com', claimed: true, claimedAt: date(0) });
  await syncProfileConversions({ Delivery, Profile, deliveries: await Delivery.find({}).lean() });
  assert.equal((await Delivery.findById(id)).conversionSource, 'profile_claim');
});

test('unsubscribe attribution is bound to the authenticated member and supports undo', async () => {
  await seed();
  await recordCampaignUnsubscribe({ Delivery, profileId: new mongoose.Types.ObjectId(), deliveryId: id, optOut: true });
  assert.equal((await Delivery.findById(id)).unsubscribedAt, undefined);
  await recordCampaignUnsubscribe({ Delivery, profileId, deliveryId: id, optOut: true });
  assert.ok((await Delivery.findById(id)).unsubscribedAt);
  await recordCampaignUnsubscribe({ Delivery, profileId, deliveryId: id, optOut: false });
  assert.equal((await Delivery.findById(id)).unsubscribedAt, undefined);
});

test('public webhook verifies signatures before database access and accepts raw request streams', async () => {
  let connects = 0;
  const deps = { Campaign, Delivery, Profile, connect: async () => { connects++; }, authorize: async () => false, env: { RESEND_WEBHOOK_SECRET: secret } };
  const invalid = response();
  await handleMarketingAnalytics({ method: 'POST', query: { action: 'resend-webhook' }, headers: {}, body: '{}' }, invalid, deps);
  assert.equal(invalid.statusCode, 400);
  assert.equal(connects, 0);
  await seed();
  const body = JSON.stringify(event('email.delivered', date(0)), null, 2);
  const req = Object.assign(Readable.from([Buffer.from(body)]), { method: 'POST', query: { action: 'resend-webhook' }, headers: sign(body) });
  Object.defineProperty(req, 'body', { get() { throw new Error('Vercel’s lazy body parser must not be accessed'); } });
  const res = response();
  await handleMarketingAnalytics(req, res, deps);
  assert.equal(res.statusCode, 200);
  assert.equal(connects, 1);
  assert.ok((await Delivery.findById(id)).deliveredAt);
});

test('reports require admin access and validate campaign ids', async () => {
  const deps = { Campaign, Delivery, Profile, authorize: async () => false, env: {} };
  const req = { method: 'GET', query: { action: 'report', campaignId: String(campaignId) }, headers: {} };
  const denied = response();
  await handleMarketingAnalytics(req, denied, deps);
  assert.equal(denied.statusCode, 401);
  const malformed = response();
  await handleMarketingAnalytics({ ...req, query: { ...req.query, campaignId: { $ne: null } } }, malformed, { ...deps, authorize: async () => true });
  assert.equal(malformed.statusCode, 400);
});

test('batch sending persists attribution before Resend and preserves callbacks arriving during send', async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 'test-only';
  const campaign = await Campaign.create({ _id: campaignId, name: 'Test', subject: 'Hi', ctaUrl: url, ctaLabel: 'RSVP', conversionGoal: 'registration' });
  await Profile.create({ _id: profileId, firstName: 'Mario', lastName: 'Rossi', profession: 'Engineer', email: 'mario@example.com', status: 'approved' });
  globalThis.fetch = async (_url, options) => {
    const [message] = JSON.parse(options.body);
    const tags = Object.fromEntries(message.tags.map((t) => [t.name, t.value]));
    assert.ok(await Delivery.findById(tags.itc_delivery));
    assert.match(message.html, /utm_medium=email/);
    assert.match(message.html, new RegExp(`&amp;d=${tags.itc_delivery}`));
    await applyResendEvent(event('email.opened', date(0), { tags }), Delivery);
    return { ok: true, json: async () => ({ data: [{ id: 'resend-123' }] }) };
  };
  try {
    const result = await sendCampaign({ campaign, CommunityProfile: Profile, Event: {}, Delivery, siteUrl: 'https://example.com' });
    assert.equal(result.sent, 1);
    const delivery = await Delivery.findOne({ campaignId });
    assert.ok(delivery.openedAt);
    assert.ok(delivery.acceptedAt);
    assert.equal(delivery.resendId, 'resend-123');
    assert.equal(campaign.recipients.length, 1);
    const again = await sendCampaign({ campaign, CommunityProfile: Profile, Event: {}, Delivery });
    assert.equal(again.sent, 0);
  } finally { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey; }
});

test('test emails never create delivery records or campaign attribution tags', async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 'test-only';
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.tags, undefined);
    assert.ok(!body.html.includes('utm_campaign='));
    return { ok: true };
  };
  try {
    await sendCampaignTest({ campaign: { subject: 'test', ctaUrl: url, ctaLabel: 'RSVP' }, toEmail: 'test@example.com', CommunityProfile: Profile, Event: {} });
    assert.equal(await Delivery.countDocuments({}), 0);
  } finally { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey; }
});
