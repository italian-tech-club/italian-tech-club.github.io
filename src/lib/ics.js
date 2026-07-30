/**
 * Minimal iCalendar (.ics) builder — no dependency.
 *
 * Recurring events export as a single VEVENT with an RRULE, so subscribing once
 * puts every future gathering in the guest's calendar. Skipped dates become
 * EXDATEs; a moved gathering becomes an EXDATE plus its own one-off VEVENT.
 */
import { parseLocalDate, toISODate } from './eventSchedule';

// The club is NYC-based; all gatherings are local to it.
const TZID = 'America/New_York';
const ICS_WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const DEFAULT_DURATION_HOURS = 2;

const pad = (n) => String(n).padStart(2, '0');

// RFC 5545 §3.3.11: backslash, semicolon, comma and newlines must be escaped.
const escapeText = (value = '') =>
  String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

const slugify = (value = 'event') =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'event';

const compactDate = (dateString) => dateString.replace(/-/g, '');

const encoder = new TextEncoder();

// RFC 5545 §3.1: content lines are folded at 75 octets, continuations start with
// a space. Measured in UTF-8 bytes, and never split mid-character.
const foldLine = (line) => {
  if (encoder.encode(line).length <= 75) return line;

  const chunks = [];
  let chunk = '';
  let bytes = 0;
  // Continuation lines carry a leading space, so they fit one byte less.
  let limit = 75;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      chunks.push(chunk);
      chunk = '';
      bytes = 0;
      limit = 74;
    }
    chunk += char;
    bytes += size;
  }
  chunks.push(chunk);

  return chunks.join('\r\n ');
};

/**
 * Pull start/end out of the free-text `time` field.
 * Handles "6:30 PM - 8:30 PM", "7:00 PM", "18:30", "6 PM – 8 PM".
 * Returns null when nothing parses, which makes the export all-day.
 */
export const parseTimeRange = (time) => {
  if (!time) return null;

  const matches = [...String(time).matchAll(/(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?/gi)];
  if (matches.length === 0) return null;

  const toMinutes = (match) => {
    let hours = Number(match[1]);
    const minutes = Number(match[2] || 0);
    const meridiem = (match[3] || '').toLowerCase().replace(/\./g, '');
    if (hours > 23 || minutes > 59) return null;
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const start = toMinutes(matches[0]);
  if (start === null) return null;
  const end = matches[1] ? toMinutes(matches[1]) : null;

  return {
    start,
    end: end !== null && end > start ? end : start + DEFAULT_DURATION_HOURS * 60,
  };
};

const localStamp = (dateString, minutes) => {
  const date = parseLocalDate(dateString);
  date.setMinutes(minutes);
  return `${compactDate(toISODate(date))}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
};

// A single gathering's DTSTART/DTEND lines, timed or all-day.
const timingLines = (dateString, range) => {
  if (!range) {
    const endDate = parseLocalDate(dateString);
    endDate.setDate(endDate.getDate() + 1); // DTEND is exclusive for all-day events
    return [
      `DTSTART;VALUE=DATE:${compactDate(dateString)}`,
      `DTEND;VALUE=DATE:${compactDate(toISODate(endDate))}`,
    ];
  }
  return [
    `DTSTART;TZID=${TZID}:${localStamp(dateString, range.start)}`,
    `DTEND;TZID=${TZID}:${localStamp(dateString, range.end)}`,
  ];
};

const vevent = ({ uid, stamp, dateString, range, title, description, location, extraLines = [] }) => [
  'BEGIN:VEVENT',
  `UID:${uid}`,
  `DTSTAMP:${stamp}`,
  ...timingLines(dateString, range),
  `SUMMARY:${escapeText(title)}`,
  ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
  ...(location ? [`LOCATION:${escapeText(location)}`] : []),
  ...extraLines,
  'END:VEVENT',
];

/**
 * Build the .ics body for one event. Pass the series document (with `recurrence`)
 * to get the whole cadence; pass a single occurrence to get just that date.
 */
export const buildEventIcs = ({ title, subtitle, location, date, time, url, recurrence }) => {
  const range = parseTimeRange(time);
  const stamp = `${compactDate(toISODate(new Date()))}T000000Z`;
  const slug = slugify(title);
  const description = [subtitle, url].filter(Boolean).join('\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Italian Tech Club//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  if (recurrence?.startDate) {
    const seriesStart = recurrence.startDate;
    const weekday = ICS_WEEKDAYS[parseLocalDate(seriesStart).getDay()];
    const interval = Number(recurrence.interval) || 1;
    const moved = (recurrence.overrides || []).filter((o) => o?.occurrence && o.date && o.date !== o.occurrence);
    const excluded = [
      ...(recurrence.skipDates || []),
      ...(recurrence.overrides || []).filter((o) => o?.cancelled).map((o) => o.occurrence),
      ...moved.map((o) => o.occurrence),
    ];

    const rrule = [`FREQ=WEEKLY`, `INTERVAL=${interval}`, `BYDAY=${weekday}`];
    if (recurrence.until) rrule.push(`UNTIL=${compactDate(recurrence.until)}T235959Z`);

    lines.push(...vevent({
      uid: `${slug}-series@italiantechclub.com`,
      stamp,
      dateString: seriesStart,
      range,
      title,
      description,
      location,
      extraLines: [
        `RRULE:${rrule.join(';')}`,
        ...excluded.map((iso) =>
          range
            ? `EXDATE;TZID=${TZID}:${localStamp(iso, range.start)}`
            : `EXDATE;VALUE=DATE:${compactDate(iso)}`
        ),
      ],
    }));

    // Moved gatherings ride along as one-off events on their new date.
    moved.forEach((override) => {
      lines.push(...vevent({
        uid: `${slug}-${compactDate(override.occurrence)}@italiantechclub.com`,
        stamp,
        dateString: override.date,
        range: parseTimeRange(override.time || time),
        title,
        description: [override.note, description].filter(Boolean).join('\n'),
        location: override.location || location,
      }));
    });
  } else {
    lines.push(...vevent({
      uid: `${slug}-${compactDate(date)}@italiantechclub.com`,
      stamp,
      dateString: date,
      range,
      title,
      description,
      location,
    }));
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
};

export const downloadIcs = (title, content) => {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slugify(title)}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};
