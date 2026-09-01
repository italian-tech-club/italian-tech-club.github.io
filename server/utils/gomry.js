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
 *  - GOMRY_MCP_TOKEN → MCP (https://www.gomry.com/api/mcp). Needed only for
 *    `add_contacts_to_list`; REST's PATCH /contacts rejects a `lists` field, so
 *    chapter-list membership has no REST equivalent. MCP tokens have been observed
 *    getting revoked without notice, so callers must treat list-add as best-effort
 *    and never let it block profile creation.
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
    bio: '',
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
 * Every accepted submission to the membership form, following pagination.
 * `submittedAfter` (ISO string) narrows an incremental run.
 */
export async function listAcceptedApplications({ submittedAfter = null, formId = MEMBERSHIP_FORM_ID } = {}) {
  const applications = [];
  let page = 1;
  let totalPages = 1;

  do {
    const body = await restGet('/applications', {
      form_id: formId,
      status: 'Accepted',
      page,
      page_size: 100,
      submitted_after: submittedAfter,
    });
    applications.push(...(body.data || []));
    totalPages = body.pagination?.total_pages ?? 1;
    page += 1;
  } while (page <= totalPages);

  // Someone can submit the form twice; the newest accepted submission wins.
  const byId = new Map();
  for (const application of applications) byId.set(application.id, application);
  return [...byId.values()];
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
 * Put contacts on the New York Chapter list. MCP-only (REST has no equivalent),
 * so this is the one call that can fail on a revoked token — callers should log
 * and carry on rather than abort the sync.
 */
export async function addContactsToNycList(contactIds) {
  const ids = [...new Set(contactIds.filter(Boolean))];
  if (!ids.length) return { contactsUpdated: 0 };
  return mcpCall('add_contacts_to_list', { listId: NYC_LIST_ID, contactIds: ids.join(',') });
}
