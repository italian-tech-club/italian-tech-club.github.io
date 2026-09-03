/**
 * Gomry client for the NYC member sync.
 *
 * Approval on the Gomry application form is what makes someone an ITC member,
 * so this module is the single place that knows how to read that verdict and
 * turn it into community-profile fields.
 *
 * Two credentials, because Gomry splits the capability:
 *  - GOMRY_API_KEY   → REST (https://www.gomry.com/api/v1). The only surface that
 *    returns an applicant's email: `GET /applications` embeds
 *    `applicant: {email, first_name, last_name}`, and `GET /contacts` backfills
 *    those from the linked user account. Everything the sync reads comes from here.
 *  - GOMRY_MCP_TOKEN → MCP (https://www.gomry.com/api/mcp). The only surface that
 *    can WRITE the two things the admin panel needs: `add_contacts_to_list`
 *    (REST's PATCH /contacts rejects a `lists` field) and `set_application_status`
 *    (REST's PATCH /applications writes `metadata` only and refuses `status`,
 *    because status drives acceptance emails and list membership). MCP tokens have
 *    been observed getting revoked without notice, so list-add is best-effort and
 *    must never block profile creation — but an approval genuinely cannot happen
 *    without a live token, and says so rather than failing quietly.
 *
 * Deliberately free of mongoose so both the express route and the Vercel function
 * can import it — the question-id map below must not exist in two copies.
 */

const REQUEST_TIMEOUT_MS = 45000;
const MAX_ATTEMPTS = 4;
const RETRY_BASE_MS = 1500;

const REST_BASE = 'https://www.gomry.com/api/v1';
const MCP_URL = 'https://www.gomry.com/api/mcp';

// "Italian Tech Club - General application form" — the single membership funnel
// for every chapter.
export const MEMBERSHIP_FORM_ID = '68uJSn7PbLmevuO2T0c5';

// Answer keys are addressed by question_id, never by question text: Gomry
// localises the prompts (the same id reads "Job Title" or "Posizione Lavorativa"
// depending on the applicant's locale) while the ids stay put.
export const QUESTION_IDS = {
  whatsapp: '9y5vnkzd35fm5nwzbav1r',
  city: 'h4a4mff1ytdsurtx0jdo9k',
  company: '44k9ad6sjotx592gaqw9jd',
  jobTitle: 'g8dpb5v1vgf62eckvq1nz7',
  linkedin: '9xjsbpbv50w7dcf8r0ad5h',
  expertise: '9rahpdbw6tpd5wm8353g5',
  hub: '4vlnpyl6b59mcyabdkdu7',
  special: 'avb6f6e3owodbelte5w27s',
  motivation: '8yrtwd19utjmmhlz1glgpd',
  referral: 'y3oik8wcwkujqnb65j5qd',
  gdpr: '5pitvloisff53n0da65608',
};

// The chapter this site is the directory for. Matched against the hub answer,
// which is stated intent — not the applicant's city, which disagrees often
// enough to matter (NYC-hub applicants have listed Chicago, London and Boston).
export const NYC_HUB = 'New York';

// "New York Chapter" (All members in New York). Overridable so a staging org can
// point somewhere harmless.
export const NYC_LIST_ID = process.env.GOMRY_NYC_LIST_ID || 'py32np2ddjXjTUyauxKz';

// "All Members (Approved)" — Gomry adds a contact to this on acceptance, which
// is the only signal an approval actually emits. The application webhook fires
// on submission, not on approval, so this list is the real trigger.
export const APPROVED_LIST_ID = process.env.GOMRY_APPROVED_LIST_ID || '5I5JVBIDqLUgKwyPLbwp';

// The three states `set_application_status` moves a submission between. "Draft"
// exists on Gomry too but is the applicant's own unfinished form, not a verdict.
export const APPLICATION_STATUSES = ['Pending', 'Accepted', 'Rejected'];

// Gomry has accepted all of these for the same consent question over time.
// Anything else — including a blank answer — is treated as consent withheld.
const GDPR_CONSENT_VALUES = new Set(['accetto', 'true', 'yes', 'accept', 'i accept']);

const truncate = (value, max) => {
  const text = String(value ?? '').trim();
  return text.length > max ? text.slice(0, max).trim() : text;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GET from the REST API, retrying timeouts and 5xx.
 *
 * Gomry's response times swing hard — the same contacts page has answered in
 * 2.5s and in 13s, and whole requests do time out — so a single slow response
 * must not fail a sync. 4xx is returned as-is: a bad key or a missing record
 * won't improve on a second attempt.
 */
async function restGet(path, params = {}) {
  const apiKey = process.env.GOMRY_API_KEY;
  if (!apiKey) throw new Error('GOMRY_API_KEY is not set');

  const url = new URL(`${REST_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      // fetch has no default timeout; one stalled request would hang the caller.
      const response = await fetch(url, {
        headers: { 'X-API-KEY': apiKey },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.ok) return response.json();

      const body = await response.text().catch(() => '');
      const error = new Error(`Gomry REST ${path} → ${response.status} ${body.slice(0, 200)}`);
      if (response.status < 500) throw error;
      lastError = error;
    } catch (error) {
      // A caller-side abort is ours to retry; anything else non-transient rethrows.
      if (error.name !== 'TimeoutError' && !/→ 5\d\d/.test(error.message)) throw error;
      lastError = error;
    }

    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_BASE_MS * attempt);
  }

  throw lastError;
}

async function mcpCall(tool, args) {
  const token = process.env.GOMRY_MCP_TOKEN;
  if (!token) throw new Error('GOMRY_MCP_TOKEN is not set');

  const response = await fetch(`${MCP_URL}?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: tool, arguments: args },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const body = await response.json();
  // A revoked token answers with a bare {error} rather than a JSON-RPC envelope.
  if (body.error) throw new Error(`Gomry MCP ${tool} → ${JSON.stringify(body.error).slice(0, 200)}`);
  const text = body.result?.content?.[0]?.text;
  return text ? JSON.parse(text) : body.result;
}

/** Raw answer for one question id, or null when unanswered. */
export function answerOf(application, key) {
  const questionId = QUESTION_IDS[key];
  const found = (application.answers || []).find((a) => a.question_id === questionId);
  return found ? (found.answer ?? null) : null;
}

/** True when this accepted application belongs to the New York chapter. */
export function isNycApplication(application) {
  return String(answerOf(application, 'hub') || '').trim() === NYC_HUB;
}

export function hasGdprConsent(application) {
  const answer = answerOf(application, 'gdpr');
  return GDPR_CONSENT_VALUES.has(String(answer ?? '').trim().toLowerCase());
}

// Directory bios come from the form's own prose questions. `special` ("cosa
// dovremmo sapere su di te che ti rende speciale?") is the one written as a
// self-description, so it leads; `motivation` is about joining ITC and only
// stands in when `special` is blank. Several answers are a lone space, hence the
// length floor rather than a truthiness check.
const MIN_BIO_LENGTH = 3;
const MAX_BIO_LENGTH = 500;

/** Bio text for one application, truncated on a word boundary. Never null. */
export function bioFromApplication(application) {
  const candidates = [answerOf(application, 'special'), answerOf(application, 'motivation')];

  for (const candidate of candidates) {
    const text = String(candidate ?? '').replace(/\s+/g, ' ').trim();
    if (text.length < MIN_BIO_LENGTH) continue;
    if (text.length <= MAX_BIO_LENGTH) return text;

    // Cut at the last space before the cap so a bio never ends mid-word.
    const clipped = text.slice(0, MAX_BIO_LENGTH - 1);
    const lastSpace = clipped.lastIndexOf(' ');
    return `${(lastSpace > MAX_BIO_LENGTH * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
  }

  return '';
}

/**
 * Community-profile fields for one accepted application, or null when it can't
 * identify a member. `contact` is optional and only supplies the avatar, which
 * lives on the contact record rather than the submission.
 *
 * Shaped for `$setOnInsert`: every value is a first-write default that a member
 * is free to overwrite once they claim the profile.
 */
export function profileFromApplication(application, contact = null) {
  const applicant = application.applicant || {};
  const email = String(applicant.email || '').trim().toLowerCase();
  if (!email) return null;

  const consented = hasGdprConsent(application);
  // The company answer arrives as {value, logo, type} with type varying across
  // clearbit / manual / gomry_organization; only `value` is dependable.
  const companyAnswer = answerOf(application, 'company');
  const company = companyAnswer && typeof companyAnswer === 'object' ? companyAnswer.value : companyAnswer;
  const avatar = contact?.img || contact?.profile_pic || null;

  return {
    email,
    firstName: truncate(applicant.first_name, 50) || 'Member',
    // lastName is required by the schema; a space stands in, matching seed-community.js.
    lastName: truncate(applicant.last_name, 50) || ' ',
    linkedIn: String(answerOf(application, 'linkedin') || '').trim(),
    profilePic: typeof avatar === 'string' && avatar.startsWith('http') ? avatar : null,
    profession: truncate(answerOf(application, 'jobTitle'), 100) || 'Member',
    company: truncate(company, 100),
    bio: bioFromApplication(application),
    isFounder: false,
    // Without consent the profile exists but stays out of the public directory
    // until the member claims it, which records consent.
    status: consented ? 'approved' : 'unclaimed',
    gdprConsent: consented,
    emailVerified: false,
    claimed: false,
    seeded: true,
    gomryApplicationId: application.id,
    gomryContactId: application.contact_id || null,
  };
}

/**
 * One answer as display text.
 *
 * Gomry types an answer by its question widget, so the same `answer` field is a
 * string, an array (multi-select custom fields), an organization
 * `{value, logo, type}`, or a Google Places blob for a location question. The
 * review screen wants one line for each, and nothing else in this module has
 * ever needed the location or expertise answers — the sync reads only the four
 * that map onto profile fields.
 */
export function plainAnswer(application, key) {
  const answer = answerOf(application, key);
  if (answer === null || answer === undefined) return '';
  if (Array.isArray(answer)) return answer.map((item) => String(item ?? '').trim()).filter(Boolean).join(', ');
  if (typeof answer === 'object') {
    return String(answer.value ?? answer.formattedAddress ?? answer.city ?? '').trim();
  }
  return String(answer).trim();
}

/**
 * One application flattened for the admin review screen — every answer the
 * reviewer reads before deciding, plus the identifiers the decision needs.
 *
 * Distinct from `profileFromApplication`, which produces the member record. This
 * one is lossless-ish and read-only: it keeps `motivation` and `special`
 * separate (the profile mapping collapses them into one bio), carries the
 * referral and WhatsApp answers the directory has no field for, and surfaces
 * `gdprConsent` because a "Non accetto" applicant becomes an `unclaimed` profile
 * that stays out of the directory — worth knowing before you approve.
 */
export function reviewFromApplication(application) {
  const applicant = application.applicant || {};
  return {
    id: application.id,
    contactId: application.contact_id || null,
    status: application.status || null,
    submittedAt: application.submitted_at || application.created_at || null,
    email: String(applicant.email || '').trim().toLowerCase(),
    firstName: String(applicant.first_name || '').trim(),
    lastName: String(applicant.last_name || '').trim(),
    hub: plainAnswer(application, 'hub'),
    city: plainAnswer(application, 'city'),
    company: plainAnswer(application, 'company'),
    jobTitle: plainAnswer(application, 'jobTitle'),
    linkedIn: plainAnswer(application, 'linkedin'),
    whatsapp: plainAnswer(application, 'whatsapp'),
    expertise: plainAnswer(application, 'expertise'),
    referral: plainAnswer(application, 'referral'),
    special: plainAnswer(application, 'special'),
    motivation: plainAnswer(application, 'motivation'),
    bio: bioFromApplication(application),
    gdprConsent: hasGdprConsent(application),
  };
}

/**
 * Every submission to the membership form with one status, following pagination.
 * `submittedAfter` (ISO string) narrows an incremental run.
 */
export async function listApplications({ status, submittedAfter = null, formId = MEMBERSHIP_FORM_ID } = {}) {
  const applications = [];
  let page = 1;
  let totalPages = 1;

  do {
    const body = await restGet('/applications', {
      form_id: formId,
      status,
      page,
      page_size: 100,
      submitted_after: submittedAfter,
    });
    applications.push(...(body.data || []));
    totalPages = body.pagination?.total_pages ?? 1;
    page += 1;
  } while (page <= totalPages);

  // Someone can submit the form twice; the newest submission wins.
  const byId = new Map();
  for (const application of applications) byId.set(application.id, application);
  return [...byId.values()];
}

export const listAcceptedApplications = (options = {}) => listApplications({ ...options, status: 'Accepted' });

/**
 * The webhook payloads, normalised.
 *
 * Gomry's webhook bodies share no field names with its REST resources:
 * `applicationID` not `id`, `responseStatus` not `status`, `user` not
 * `applicant`, and `applicationAnswers` is an object keyed by LOCALISED
 * question text rather than an array carrying `question_id`. That last part is
 * why nothing here tries to read answers from a delivery — the id is extracted
 * and the authoritative application is fetched from REST instead.
 */
export function normalizeApplicationDelivery(payload = {}) {
  const body = payload.data || payload.application || payload;
  return {
    applicationId: body.applicationID || body.application_id || body.id || null,
    // "Pending" on a fresh submission, "Accepted" once an admin approves.
    status: body.responseStatus || body.status || null,
    contactId: body.user?.contactID || body.contact_id || null,
    email: (body.user?.email || body.applicant?.email || '').toLowerCase() || null,
    isNewApplication: Boolean(body.isNewApplication),
    updatedByAdmin: Boolean(body.updatedByAdmin),
  };
}

export function normalizeContactDelivery(payload = {}) {
  const body = payload.data || payload.contact || payload;
  return {
    contactId: body.id || body.contact_id || null,
    email: (body.userEmail || body.email || '').toLowerCase() || null,
    lists: Array.isArray(body.lists) ? body.lists : [],
    img: body.img || null,
  };
}

/** True when a contact delivery says this contact is now an approved member. */
export function isApprovedMemberDelivery(payload) {
  return normalizeContactDelivery(payload).lists.includes(APPROVED_LIST_ID);
}

/**
 * The contact's accepted submission to the membership form, or null.
 *
 * One REST call, and it returns the full application with `question_id`s and
 * `applicant.email` — everything the member mapping needs.
 */
export async function acceptedApplicationForContact(contactId, { formId = MEMBERSHIP_FORM_ID } = {}) {
  if (!contactId) return null;
  const body = await restGet('/applications', {
    contact_id: contactId,
    status: 'Accepted',
    form_id: formId,
    page_size: 100,
  });
  const applications = body.data || [];
  if (!applications.length) return null;
  // Newest wins if someone applied more than once.
  return applications.sort((a, b) => new Date(b.submitted_at ?? 0) - new Date(a.submitted_at ?? 0))[0];
}

export async function getApplication(applicationId) {
  const body = await restGet(`/applications/${applicationId}`);
  return body.data || body;
}

export async function getContact(contactId) {
  const body = await restGet(`/contacts/${contactId}`);
  return body.data || body;
}

/**
 * Contact records for one list, straight from MCP.
 *
 * MCP only, because REST's contact resource has no `img` field at all — the
 * exact mirror of the email gap that sends everything else through REST.
 */
export async function listContactsWithImages(listId = NYC_LIST_ID) {
  const contacts = [];
  let page = 1;
  let totalPages = 1;

  do {
    const body = await mcpCall('get_contacts', { listIds: listId, page, pageSize: 50 });
    contacts.push(...(body.contacts || []));
    totalPages = body.pagination?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return contacts;
}

/**
 * Approve, reject, or return submissions to review — the write that used to
 * require the Gomry dashboard.
 *
 * `notify_applicant` has no default on Gomry's side precisely so a batch can
 * never mail people by omission, and this keeps that contract: the flag must be
 * passed explicitly or the call is refused before it leaves the process. True
 * sends the form's own acceptance/rejection template (and, on acceptance, adds
 * the contact to the form's accepted lists, which is what fires our contact
 * webhook); false moves the status silently.
 *
 * Per-id problems come back in `failed` ([{applicationId, reason}]) rather than
 * throwing, so a caller acting on one application must check that a resolved
 * promise actually moved it — `updated` is the list that did.
 */
export async function setApplicationStatus(applicationIds, status, { notifyApplicant } = {}) {
  const ids = [...new Set((applicationIds || []).filter(Boolean))];
  if (!ids.length) return { updated: [], failed: [] };
  if (!APPLICATION_STATUSES.includes(status)) throw new Error(`Unsupported application status: ${status}`);
  if (typeof notifyApplicant !== 'boolean') throw new Error('notifyApplicant must be an explicit boolean');

  const body = await mcpCall('set_application_status', {
    application_ids: ids,
    status,
    notify_applicant: notifyApplicant,
  });

  // This tool nests its result under `data`, unlike add_contacts_to_list — so
  // unwrap here rather than leaving every caller to remember which is which.
  const result = body?.data || body || {};
  return { updated: result.updated || [], failed: result.failed || [] };
}

/**
 * Move ONE application and say whether it actually moved.
 *
 * The bulk call reports per-id problems in `failed` rather than throwing, so
 * "the promise resolved" is not the same as "the status changed". This collapses
 * that into the yes/no a single decision needs, and keeps the shape of Gomry's
 * bulk reply in this module rather than in every caller.
 */
export async function setOneApplicationStatus(applicationId, status, options) {
  const { updated, failed } = await setApplicationStatus([applicationId], status, options);

  const failure = failed.find((f) => (f?.applicationId || f?.id) === applicationId) || failed[0];
  if (failure) return { ok: false, reason: failure.reason || failure.error || failure.message || 'no reason given' };
  // Every id comes back in one list or the other, so an empty `updated` here
  // means Gomry accepted the call and did nothing.
  if (!updated.length) return { ok: false, reason: 'Gomry reported no change' };

  return { ok: true, reason: null };
}

/**
 * Put contacts on the New York Chapter list. MCP-only (REST has no equivalent),
 * so this is the one call that can fail on a revoked token — callers should log
 * and carry on rather than abort the sync.
 */
export async function addContactsToNycList(contactIds) {
  const ids = [...new Set(contactIds.filter(Boolean))];
  if (!ids.length) return { contactsUpdated: 0 };
  return mcpCall('add_contacts_to_list', { listId: NYC_LIST_ID, contactIds: ids.join(',') });
}
