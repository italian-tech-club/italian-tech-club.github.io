/**
 * Event date + recurrence helpers.
 *
 * A recurring series (e.g. "Il Posto Fisso") is stored as ONE event document
 * carrying a `recurrence` rule instead of one row per gathering. The individual
 * gatherings are expanded here at render time, so the Upcoming list rolls
 * forward on its own with no database edits. Rule shape:
 *
 *   recurrence: {
 *     frequency: 'weekly',
 *     interval: 3,                 // every N weeks
 *     startDate: '2026-08-13',     // first gathering; also fixes the weekday
 *     until: null,                 // last possible date, or null for open-ended
 *     skipDates: ['2026-11-26'],   // gatherings that don't happen
 *     overrides: [                 // the "unless otherwise specified" escape hatch
 *       { occurrence: '2026-09-03', date: '2026-09-04', time: '7:00 PM', location: '…', note: 'Moved for Labor Day' }
 *     ],
 *   }
 *
 * Individual gatherings that already happened live on as ordinary event documents
 * tagged with the same `series` slug — that's how each date carries its own poster
 * and photos. A tagged event always wins over the date the rule would generate.
 */

const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Plural weekday for cadence copy: "every 3 weeks on Thursdays"
const WEEKDAYS_PLURAL = WEEKDAYS_LONG.map((day) => `${day}s`);

// Upper bound on rule expansion so an open-ended series can never spin forever.
const MAX_STEPS = 520;

const pad = (n) => String(n).padStart(2, '0');

// Dates are stored as plain YYYY-MM-DD; parse them as local days so a gathering
// never drifts a day backwards for anyone west of UTC.
export const parseLocalDate = (dateString) => {
  const [year, month, day] = String(dateString).split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const toISODate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

// Big date tile on the card: { date: '13', month: 'AUG' }
export const formatEventDate = (dateString) => {
  const date = parseLocalDate(dateString);
  return { date: pad(date.getDate()), month: MONTHS_SHORT[date.getMonth()] };
};

// "Sep 3" — used in the next-dates strip
export const formatShortDate = (dateString) => {
  const date = parseLocalDate(dateString);
  return `${MONTHS_LONG[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
};

// "THU" — the stamp above the big date numeral
export const weekdayShort = (dateString) =>
  WEEKDAYS_LONG[parseLocalDate(dateString).getDay()].slice(0, 3).toUpperCase();

// "Thursday, August 13" — the year is noise for an upcoming date
export const formatWeekdayDate = (dateString) => {
  const date = parseLocalDate(dateString);
  return `${WEEKDAYS_LONG[date.getDay()]}, ${MONTHS_LONG[date.getMonth()]} ${date.getDate()}`;
};

// "Thursday, August 13, 2026"
export const formatLongDate = (dateString) => {
  const date = parseLocalDate(dateString);
  return `${WEEKDAYS_LONG[date.getDay()]}, ${MONTHS_LONG[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

export const isRecurring = (event) =>
  !!event?.recurrence?.startDate && Number(event.recurrence.interval) >= 1;

// "Every 3 weeks" / "Every other week" / "Weekly"
export const describeCadence = (recurrence) => {
  const interval = Number(recurrence?.interval) || 1;
  if (interval === 1) return 'Weekly';
  if (interval === 2) return 'Every other week';
  return `Every ${interval} weeks`;
};

// "Every 3 weeks on Thursdays"
export const describeRecurrence = (recurrence) => {
  if (!recurrence?.startDate) return '';
  const weekday = WEEKDAYS_PLURAL[parseLocalDate(recurrence.startDate).getDay()];
  const interval = Number(recurrence.interval) || 1;
  if (interval === 1) return `Every ${weekday.slice(0, -1)}`;
  if (interval === 2) return `Every other ${weekday.slice(0, -1)}`;
  return `Every ${interval} weeks on ${weekday}`;
};

/**
 * Expand a recurring event into concrete gatherings, applying skips and overrides.
 * Each result is a shallow copy of the event with the occurrence's own date/time/
 * location merged in, plus `occurrence` (the date the rule generated, which stays
 * the stable identity even when an override moves the gathering).
 *
 * @param {object} event    event document carrying `recurrence`
 * @param {Date|null} from  earliest date to include; null includes past gatherings
 * @param {number} limit    how many gatherings to return
 */
export const expandOccurrences = (event, { from = startOfToday(), limit = 6, exclude } = {}) => {
  if (!isRecurring(event)) return [];

  const rule = event.recurrence;
  const interval = Number(rule.interval) || 1;
  const until = rule.until ? parseLocalDate(rule.until) : null;
  const skipped = new Set(rule.skipDates || []);
  const overrides = new Map((rule.overrides || []).filter((o) => o?.occurrence).map((o) => [o.occurrence, o]));

  const occurrences = [];
  // setDate() rather than millisecond arithmetic: DST-safe, keeps the weekday.
  const cursor = parseLocalDate(rule.startDate);

  for (let step = 0; step < MAX_STEPS && occurrences.length < limit; step += 1) {
    if (until && cursor > until) break;

    const generated = toISODate(cursor);
    const override = overrides.get(generated);

    if (!skipped.has(generated) && !override?.cancelled && !exclude?.has(generated)) {
      const date = override?.date || generated;
      if (!from || parseLocalDate(date) >= from) {
        occurrences.push({
          ...event,
          date,
          occurrence: generated,
          time: override?.time || event.time,
          location: override?.location || event.location,
          note: override?.note || null,
          isMoved: !!(override?.date && override.date !== generated),
        });
      }
    }

    cursor.setDate(cursor.getDate() + 7 * interval);
  }

  return occurrences;
};

export const nextOccurrence = (event, from = startOfToday(), options = {}) =>
  expandOccurrences(event, { ...options, from, limit: 1 })[0] || null;

/**
 * The gatherings of a series that exist as their own event documents — the ones
 * with a poster and photos of the night. Oldest first, so they read as a timeline.
 */
export const editionsOf = (events, slug) => {
  if (!slug) return [];
  return events
    .filter((event) => event.series === slug && !isRecurring(event))
    .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));
};

// Last gathering of a closed series — used to file a finished series under Past.
export const lastOccurrence = (event) => {
  if (!event?.recurrence?.until) return null;
  const all = expandOccurrences(event, { from: null, limit: MAX_STEPS });
  return all[all.length - 1] || null;
};
