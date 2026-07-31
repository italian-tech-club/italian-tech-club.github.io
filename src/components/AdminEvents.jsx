import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Plus, Pencil, Trash2, X, LogOut, Loader2, Upload,
  Calendar, MapPin, Clock, Link as LinkIcon, Image as ImageIcon, AlertCircle, CheckCircle2, Repeat, Images,
} from 'lucide-react';
import { fileToResizedDataUrl } from '../utils/image';
import { describeCadence, expandOccurrences, formatShortDate, isRecurring, nextOccurrence } from '../lib/eventSchedule';
import AdminInquiries from './AdminInquiries';
import AdminCommunity from './AdminCommunity';
import { getAdminSession, setAdminSession, clearAdminSession } from '../lib/adminSession';
import { getMemberSession, clearMemberSession } from '../lib/memberSession';

const API_URL = import.meta.env.VITE_API_URL || '';

// Best-effort server-side revoke — the local session is cleared either way.
const postSignOut = (token) => fetch(`${API_URL}/api/admin/auth`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ action: 'signout' }),
}).catch(() => {});

const EVENT_TYPES = ['Networking', 'Talk', 'Launch Party', "Members' Dinner", "Members' Brunch", "Members' Aperitivo"];

// The club's standing series runs every 3 weeks, so that's the default cadence.
const DEFAULT_INTERVAL_WEEKS = 3;

// How many upcoming gatherings the form previews.
const PREVIEW_OCCURRENCES = 5;

const EMPTY_RECURRENCE = {
  interval: DEFAULT_INTERVAL_WEEKS,
  until: '',
  skipDates: [],
  overrides: [],
};

const EMPTY_FORM = {
  date: '',
  title: '',
  subtitle: '',
  location: '',
  time: '',
  type: '',
  link: '',
  poster: '',
  gallery: [],
  recurrence: null,
  series: '',
  // Ids of the past nights tagged into this series — the photo carousel's source.
  editionIds: [],
};

// A series starts life with the cadence already switched on.
const NEW_SERIES_FORM = { ...EMPTY_FORM, recurrence: { ...EMPTY_RECURRENCE } };

const NEW_EVENT = 'new';
const NEW_SERIES = 'new-series';
const isDraft = (editing) => editing === NEW_EVENT || editing === NEW_SERIES;

// Series slugs are typed by hand into past events too, so keep them boring:
// lowercase, dashes, no accents.
const slugify = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

// Same shape, but a trailing dash survives: otherwise typing a space between two
// words would glue them together as you type.
const slugifyWhileTyping = (value) => slugify(value) + (/[^a-z0-9]$/i.test(value) ? '-' : '');

const photoCountOf = (event) => event.galleryCount ?? event.gallery?.length ?? 0;

// Vercel caps request bodies at ~4.5MB; leave headroom
const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;

const inputClass =
  'w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-itc-green/50 focus:border-itc-green transition-colors text-sm';

const labelClass = 'block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

const eventToForm = (event, allEvents = []) => ({
  date: event.date || '',
  title: event.title || '',
  subtitle: event.subtitle || '',
  location: event.location || '',
  time: event.time || '',
  type: event.type || '',
  link: event.link || '',
  poster: event.poster || '',
  gallery: event.gallery || [],
  series: event.series || '',
  recurrence: event.recurrence
    ? {
        interval: event.recurrence.interval || DEFAULT_INTERVAL_WEEKS,
        until: event.recurrence.until || '',
        skipDates: event.recurrence.skipDates || [],
        overrides: event.recurrence.overrides || [],
      }
    : null,
  editionIds: event.series
    ? allEvents.filter((other) => other.series === event.series && !isRecurring(other)).map((other) => other._id)
    : [],
});

// The Date field doubles as the series' first gathering, so the rule's startDate
// always mirrors it — one date to keep straight instead of two.
const formToRecurrence = (recurrence, startDate) => {
  if (!recurrence || !startDate) return null;
  return {
    frequency: 'weekly',
    interval: Number(recurrence.interval) || 1,
    startDate,
    until: recurrence.until?.trim() || null,
    skipDates: (recurrence.skipDates || []).filter(Boolean),
    overrides: (recurrence.overrides || [])
      .filter((override) => override.occurrence)
      .map((override) => ({
        occurrence: override.occurrence,
        date: override.date?.trim() || null,
        time: override.time?.trim() || null,
        location: override.location?.trim() || null,
        note: override.note?.trim() || null,
        cancelled: !!override.cancelled,
      })),
  };
};

const formToPayload = (form) => ({
  date: form.date.trim(),
  title: form.title.trim(),
  subtitle: form.subtitle.trim(),
  location: form.location.trim(),
  time: form.time.trim() || null,
  type: form.type.trim(),
  link: form.link.trim() || null,
  poster: form.poster.trim() || null,
  gallery: form.gallery.map((entry) => entry.trim()).filter(Boolean),
  recurrence: formToRecurrence(form.recurrence, form.date.trim()),
  series: slugify(form.series) || null,
});

const LoginGate = ({ error: externalError }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || loading) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email }),
      });

      if (response.ok) {
        setSent(true);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="w-full max-w-sm p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl"
      >
        <div className="w-12 h-12 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center mx-auto mb-6">
          <Lock className="w-5 h-5 text-white dark:text-slate-900" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-1">Admin Panel</h1>

        {sent ? (
          <div className="text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
              If <span className="font-medium text-slate-700 dark:text-slate-300">{email}</span> is authorized,
              a login link is on its way. Check your inbox — the link expires in 15 minutes.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
              Enter your admin email to receive a login link
            </p>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
              className={inputClass}
            />

            {(error || externalError) && (
              <p className="flex items-center gap-2 text-sm text-itc-red mt-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error || externalError}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full mt-6 px-6 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Email Me a Login Link'}
            </button>
          </>
        )}
      </motion.form>
    </div>
  );
};

/**
 * Recurring-series editor. The series is one event document plus a rule; skipped
 * dates and overrides cover the "unless otherwise specified" cases (holiday
 * weeks, a venue change, a gathering moved by a day).
 */
const RecurrenceFields = ({ recurrence, startDate, onChange }) => {
  const [skipDraft, setSkipDraft] = useState('');
  const enabled = !!recurrence;

  const rule = useMemo(() => formToRecurrence(recurrence, startDate), [recurrence, startDate]);

  const preview = useMemo(
    () => (rule ? expandOccurrences({ recurrence: rule }, { from: null, limit: PREVIEW_OCCURRENCES }) : []),
    [rule]
  );

  const patch = (changes) => onChange({ ...recurrence, ...changes });

  const addSkipDate = () => {
    const date = skipDraft.trim();
    if (!date || recurrence.skipDates.includes(date)) return;
    patch({ skipDates: [...recurrence.skipDates, date].sort() });
    setSkipDraft('');
  };

  const patchOverride = (index, changes) =>
    patch({
      overrides: recurrence.overrides.map((override, i) => (i === index ? { ...override, ...changes } : override)),
    });

  return (
    <div className="md:col-span-2 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked ? { ...EMPTY_RECURRENCE } : null)}
          className="mt-0.5 w-4 h-4 rounded accent-itc-green"
        />
        <span>
          <span className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Repeat className="w-4 h-4" /> Recurring series
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            The date above becomes the first gathering; the site always shows the next one.
          </span>
        </span>
      </label>

      {enabled && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Repeats every … weeks</label>
              <input
                type="number"
                min="1"
                max="52"
                value={recurrence.interval}
                onChange={(e) => patch({ interval: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Ends on (optional)</label>
              <input
                type="date"
                value={recurrence.until}
                onChange={(e) => patch({ until: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          {preview.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-bold uppercase tracking-wider">{describeCadence(rule)}</span>
              {' — '}
              {preview.map((occurrence) => formatShortDate(occurrence.date)).join(' · ')} …
            </p>
          )}

          <div>
            <label className={labelClass}>Skipped dates</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {recurrence.skipDates.map((date) => (
                <span
                  key={date}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  {date}
                  <button
                    type="button"
                    onClick={() => patch({ skipDates: recurrence.skipDates.filter((d) => d !== date) })}
                    className="text-slate-400 hover:text-itc-red transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={skipDraft}
                onChange={(e) => setSkipDraft(e.target.value)}
                className={inputClass}
              />
              <button
                type="button"
                onClick={addSkipDate}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
              >
                Skip
              </button>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
              Use the generated date (the one the cadence lands on), not the replacement.
            </p>
          </div>

          <div>
            <label className={labelClass}>Exceptions ({recurrence.overrides.length})</label>
            <div className="space-y-3">
              {recurrence.overrides.map((override, index) => (
                <div key={index} className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Scheduled date</span>
                      <input
                        type="date"
                        value={override.occurrence || ''}
                        onChange={(e) => patchOverride(index, { occurrence: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Moved to</span>
                      <input
                        type="date"
                        value={override.date || ''}
                        onChange={(e) => patchOverride(index, { date: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    value={override.time || ''}
                    onChange={(e) => patchOverride(index, { time: e.target.value })}
                    placeholder="Different time (optional)"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={override.location || ''}
                    onChange={(e) => patchOverride(index, { location: e.target.value })}
                    placeholder="Different venue (optional)"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={override.note || ''}
                    onChange={(e) => patchOverride(index, { note: e.target.value })}
                    placeholder="Note shown on the card, e.g. Moved for Thanksgiving"
                    className={inputClass}
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!override.cancelled}
                        onChange={(e) => patchOverride(index, { cancelled: e.target.checked })}
                        className="w-3.5 h-3.5 rounded accent-itc-red"
                      />
                      Cancelled
                    </label>
                    <button
                      type="button"
                      onClick={() => patch({ overrides: recurrence.overrides.filter((_, i) => i !== index) })}
                      className="text-xs font-medium text-slate-400 hover:text-itc-red transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => patch({ overrides: [...recurrence.overrides, { occurrence: '' }] })}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add exception
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Picks which already-run nights belong to this series. A series document has no
 * photos of its own — the carousel on its card is the galleries of the nights
 * tagged here, kept grouped by date. Checking a night writes the series slug onto
 * that event; unchecking clears it. Its own Past Events card is unaffected.
 */
const EditionPicker = ({ slug, candidates, selectedIds, onChange }) => {
  const selected = new Set(selectedIds);
  const photoTotal = candidates
    .filter((event) => selected.has(event._id))
    .reduce((sum, event) => sum + photoCountOf(event), 0);

  const toggle = (id) =>
    onChange(selected.has(id) ? selectedIds.filter((other) => other !== id) : [...selectedIds, id]);

  return (
    <div className="md:col-span-2 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
      <span className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
        <Images className="w-4 h-4" /> Nights in this series
      </span>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
        Their photos become the series&apos; carousel, grouped by night. Each night keeps its own Past Events card.
      </p>

      {!slug && (
        <p className="text-xs text-itc-red mt-3">Give the series a slug above before linking nights.</p>
      )}

      {slug && candidates.length === 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">No other events to link yet.</p>
      )}

      {slug && candidates.length > 0 && (
        <>
          <div className="mt-3 max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {candidates.map((event) => {
              const photos = photoCountOf(event);
              const otherSeries = event.series && event.series !== slug;
              return (
                <label
                  key={event._id}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-itc-green/40 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(event._id)}
                    onChange={() => toggle(event._id)}
                    className="w-4 h-4 rounded accent-itc-green flex-shrink-0"
                  />
                  <span className="flex-grow min-w-0">
                    <span className="block text-sm font-medium text-slate-900 dark:text-white truncate">{event.title}</span>
                    <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      {event.date}
                      <span className="flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" /> {photos}
                      </span>
                      {otherSeries && (
                        <span className="font-mono text-[11px] text-itc-red">in {event.series}</span>
                      )}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5">
            <span className="font-bold">{selectedIds.length}</span> night{selectedIds.length === 1 ? '' : 's'} linked
            {' · '}
            <span className="font-bold">{photoTotal}</span> photo{photoTotal === 1 ? '' : 's'} in the carousel
          </p>
        </>
      )}
    </div>
  );
};

const EventForm = ({ initialForm, saving, error, onSubmit, onCancel, isEdit, seriesOptions = [], candidates = [] }) => {
  const [form, setForm] = useState(initialForm);
  const [uploading, setUploading] = useState(false);
  const [manualPath, setManualPath] = useState('');
  // A hand-edited slug is never overwritten by the title autofill.
  const [slugTouched, setSlugTouched] = useState(!!initialForm.series);

  const isSeries = !!form.recurrence;

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // A series with no slug can't gather its nights, so derive one from the title
  // until the slug is edited by hand.
  useEffect(() => {
    if (!isSeries || slugTouched) return;
    setForm((f) => ({ ...f, series: slugify(f.title) }));
  }, [form.title, isSeries, slugTouched]);

  const handlePosterFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file, 1000, 0.8);
      setForm((f) => ({ ...f, poster: dataUrl }));
    } finally {
      setUploading(false);
    }
  };

  const handleGalleryFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        urls.push(await fileToResizedDataUrl(file, 1600, 0.8));
      }
      setForm((f) => ({ ...f, gallery: [...f.gallery, ...urls] }));
    } finally {
      setUploading(false);
    }
  };

  const removeGalleryImage = (idx) =>
    setForm((f) => ({ ...f, gallery: f.gallery.filter((_, i) => i !== idx) }));

  const addManualPath = () => {
    const path = manualPath.trim();
    if (!path) return;
    setForm((f) => ({ ...f, gallery: [...f.gallery, path] }));
    setManualPath('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.form
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
      >
        <div className="flex-shrink-0 flex items-center justify-between gap-2 px-5 md:px-8 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {isEdit ? 'Edit ' : 'New '}{isSeries ? 'Series' : 'Event'}
          </h2>
          <button type="button" onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 md:px-8 py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Date *</label>
              <input type="date" required value={form.date} onChange={set('date')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Type *</label>
              <input
                type="text"
                required
                list="event-types"
                value={form.type}
                onChange={set('type')}
                placeholder="e.g. Networking"
                className={inputClass}
              />
              <datalist id="event-types">
                {EVENT_TYPES.map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Title *</label>
              <input type="text" required value={form.title} onChange={set('title')} placeholder="Event title" className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Subtitle</label>
              <input type="text" value={form.subtitle} onChange={set('subtitle')} placeholder="Short description shown under the title" className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Location *</label>
              <input type="text" required value={form.location} onChange={set('location')} placeholder="Venue, street address, city" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Time</label>
              <input type="text" value={form.time} onChange={set('time')} placeholder="e.g. 6:30 PM - 8:30 PM" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Registration Link</label>
              <input type="url" value={form.link} onChange={set('link')} placeholder="https://..." className={inputClass} />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>Series {isSeries && '*'}</label>
              <input
                type="text"
                list="series-slugs"
                required={isSeries}
                value={form.series}
                onChange={(e) => { setSlugTouched(true); setForm((f) => ({ ...f, series: slugifyWhileTyping(e.target.value) })); }}
                placeholder="e.g. posto-fisso — leave empty for a standalone event"
                className={`${inputClass} font-mono text-xs`}
              />
              <datalist id="series-slugs">
                {seriesOptions.map((slug) => <option key={slug} value={slug} />)}
              </datalist>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                {isSeries
                  ? 'The slug that ties this series to its nights. Taken from the title — change it if you like.'
                  : 'Tag a night with the same slug as its series and its poster and photos show up on the series card.'}
              </p>
            </div>

            <RecurrenceFields
              recurrence={form.recurrence}
              startDate={form.date}
              onChange={(recurrence) => setForm((f) => ({ ...f, recurrence }))}
            />

            {isSeries && (
              <EditionPicker
                slug={form.series}
                candidates={candidates}
                selectedIds={form.editionIds}
                onChange={(editionIds) => setForm((f) => ({ ...f, editionIds }))}
              />
            )}

            <div className="md:col-span-2">
              <label className={labelClass}>Poster</label>
              <div className="flex items-start gap-3">
                {form.poster && (
                  <div className="relative w-24 h-24 flex-shrink-0">
                    <img
                      src={form.poster}
                      alt="Poster preview"
                      className="w-full h-full object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, poster: '' }))}
                      className="absolute -top-2 -right-2 p-1 rounded-full bg-itc-red text-white shadow"
                      title="Remove poster"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className="flex-grow space-y-2">
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Upload image
                    <input type="file" accept="image/*" className="hidden" onChange={handlePosterFile} />
                  </label>
                  {!form.poster.startsWith('data:') && (
                    <input
                      type="text"
                      value={form.poster}
                      onChange={set('poster')}
                      placeholder="…or a repo path / URL: /images/events/my-event/poster.png"
                      className={inputClass}
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Gallery ({form.gallery.length} photo{form.gallery.length === 1 ? '' : 's'})</label>
              <div className="flex flex-wrap gap-3">
                {form.gallery.map((src, idx) => (
                  <div key={idx} className="relative w-20 h-20">
                    <img
                      src={src}
                      alt={`Gallery ${idx + 1}`}
                      className="w-full h-full object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => removeGalleryImage(idx)}
                      className="absolute -top-2 -right-2 p-1 rounded-full bg-itc-red text-white shadow"
                      title="Remove photo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 hover:border-itc-green hover:text-itc-green cursor-pointer transition-colors">
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryFiles} />
                </label>
              </div>
              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={manualPath}
                  onChange={(e) => setManualPath(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManualPath(); } }}
                  placeholder="…or add a repo path / URL: /images/events/my-event/img1.jpg"
                  className={`${inputClass} font-mono text-xs`}
                />
                <button
                  type="button"
                  onClick={addManualPath}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
                >
                  Add
                </button>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                Uploaded photos are compressed and stored in the database — no repo commit needed.
              </p>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 px-5 md:px-8 py-4 border-t border-slate-200 dark:border-slate-800">
          {error && (
            <p className="flex items-center gap-2 text-sm text-itc-red mb-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2.5 rounded-full text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="px-6 py-2.5 rounded-full text-sm font-bold bg-itc-green text-white hover:bg-itc-red transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save Changes' : isSeries ? 'Create Series' : 'Create Event'}
            </button>
          </div>
        </div>
      </motion.form>
    </motion.div>
  );
};

const AdminEvents = () => {
  const [adminKey, setAdminKey] = useState(() => getAdminSession()?.token || '');
  // Holds the login gate back while we sign in from something we already have: a
  // magic-link token in the URL, or the community session (which counts as admin
  // when its email is on the allowlist). A cached admin session renders the panel
  // straight away and is revalidated in the background.
  const [exchanging, setExchanging] = useState(() =>
    new URLSearchParams(window.location.search).has('token') || (!getAdminSession() && !!getMemberSession())
  );
  const [loginError, setLoginError] = useState('');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | event object
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [editLoadingId, setEditLoadingId] = useState(null);
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState('events');

  const seriesOptions = useMemo(
    () => [...new Set(events.map((event) => event.series).filter(Boolean))].sort(),
    [events]
  );

  // Nights a series can gather: ordinary events, most recent first. A series
  // document is never a night of another series, and never of itself.
  const editionCandidates = useMemo(
    () => events.filter((event) => !isRecurring(event) && event._id !== editing?._id),
    [events, editing]
  );

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminKey}`,
  }), [adminKey]);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch(`${API_URL}/api/events`);
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      setEvents(data.events);
    } catch {
      setLoadError('Could not load events from the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminKey) fetchEvents();
  }, [adminKey, fetchEvents]);

  // Sign in without typing an email whenever possible: exchange a magic-link
  // token if the URL carries one, otherwise ask the API whether a token this
  // browser already holds (cached admin session, or the community session) is
  // good for the panel.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkToken = params.get('token');

    // Strip the token from the URL immediately (browser history hygiene)
    if (linkToken) window.history.replaceState({}, '', window.location.pathname);

    const postAuth = (body, token) => fetch(`${API_URL}/api/admin/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const signIn = async () => {
      if (linkToken) {
        try {
          const response = await postAuth({ action: 'exchange', token: linkToken });
          const data = await response.json();

          if (response.ok && data.success) {
            setAdminSession({ token: data.sessionToken, expiresAt: data.sessionExpiresAt, email: data.email });
            setAdminKey(data.sessionToken);
          } else {
            setLoginError(data.message || 'This login link is invalid or has expired.');
          }
        } catch {
          setLoginError('Could not reach the server. Please try again.');
        }
        return;
      }

      const cached = getAdminSession();
      const candidate = cached?.token || getMemberSession()?.token;
      if (!candidate) return;

      try {
        const response = await postAuth({ action: 'session' }, candidate);
        const data = await response.json();
        if (response.ok && data.success) {
          setAdminSession({ token: candidate, expiresAt: data.sessionExpiresAt, email: data.email, via: data.via });
          setAdminKey(candidate);
        } else if (cached) {
          // Revoked or expired server-side — drop the stale token.
          clearAdminSession();
          setAdminKey('');
        }
      } catch {
        // Server unreachable: keep whatever we had and let the first
        // authenticated call surface the problem.
      }
    };

    signIn().finally(() => setExchanging(false));
  }, []);

  const handleLogout = useCallback(() => {
    const session = getAdminSession();
    if (session) {
      postSignOut(session.token);
    }
    clearAdminSession();
    // The community session doubles as an admin credential, so signing out has
    // to drop it too — otherwise the next load signs straight back in.
    clearMemberSession();
    setAdminKey('');
    setEvents([]);
  }, []);

  const handleUnauthorized = handleLogout;

  // List rows don't include the gallery — fetch the full event before editing,
  // otherwise saving would wipe its photos
  const startEdit = async (event) => {
    setFormError('');
    setEditLoadingId(event._id);
    try {
      const response = await fetch(`${API_URL}/api/events?id=${event._id}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      setEditing(data.event);
    } catch {
      showToast('Could not load event details. Try again.');
    } finally {
      setEditLoadingId(null);
    }
  };

  /**
   * Write the series slug onto the nights the picker checked, and clear it from
   * the ones it unchecked. Only the `series` field is sent, so each night keeps
   * its own gallery (the list rows don't carry one).
   * @returns {number} nights that could not be updated
   */
  const syncEditions = async (slug, selectedIds, previousSlug) => {
    const selected = new Set(selectedIds);

    const changes = events.flatMap((event) => {
      if (isRecurring(event)) return [];
      if (selected.has(event._id)) {
        return event.series === slug ? [] : [{ id: event._id, series: slug }];
      }
      const wasOurs = event.series && (event.series === slug || event.series === previousSlug);
      return wasOurs ? [{ id: event._id, series: null }] : [];
    });

    const results = await Promise.all(changes.map(async ({ id, series }) => {
      try {
        const response = await fetch(`${API_URL}/api/events?id=${id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ series }),
        });
        const data = await response.json();
        return response.ok && data.success;
      } catch {
        return false;
      }
    }));

    return results.filter((ok) => !ok).length;
  };

  const handleSave = async (form) => {
    setFormError('');
    const isEdit = !isDraft(editing);

    const payload = JSON.stringify(formToPayload(form));
    const payloadBytes = new Blob([payload]).size;
    if (payloadBytes > MAX_PAYLOAD_BYTES) {
      setFormError(`Event is too large (${(payloadBytes / 1024 / 1024).toFixed(1)}MB, max 4MB). Remove some photos or use repo paths instead of uploads.`);
      return;
    }

    setSaving(true);
    try {
      const url = isEdit ? `${API_URL}/api/events?id=${editing._id}` : `${API_URL}/api/events`;
      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: payload,
      });

      if (response.status === 401) return handleUnauthorized();

      const data = await response.json();
      if (!response.ok || !data.success) {
        setFormError(data.message || 'Failed to save event');
        return;
      }

      const saved = formToPayload(form);
      const isSeries = !!saved.recurrence;
      let failures = 0;
      if (isSeries && saved.series) {
        failures = await syncEditions(saved.series, form.editionIds || [], isEdit ? editing.series : null);
      }

      setEditing(null);
      const noun = isSeries ? 'Series' : 'Event';
      showToast(
        failures > 0
          ? `${noun} saved, but ${failures} night${failures === 1 ? '' : 's'} could not be linked`
          : `${noun} ${isEdit ? 'updated' : 'created'}`
      );
      fetchEvents();
    } catch {
      setFormError('Could not reach the server. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event) => {
    if (!window.confirm(`Delete "${event.title}" (${event.date})? This cannot be undone.`)) return;

    setDeletingId(event._id);
    try {
      const response = await fetch(`${API_URL}/api/events?id=${event._id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });

      if (response.status === 401) return handleUnauthorized();

      const data = await response.json();
      if (!response.ok || !data.success) {
        showToast(data.message || 'Failed to delete event');
        return;
      }

      showToast('Event deleted');
      fetchEvents();
    } catch {
      showToast('Could not reach the server.');
    } finally {
      setDeletingId(null);
    }
  };

  if (exchanging) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Signing you in...
        </div>
      </div>
    );
  }

  if (!adminKey) {
    return <LoginGate error={loginError} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Admin Panel</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {tab === 'events'
                ? `${events.length} event${events.length === 1 ? '' : 's'} in the database`
                : tab === 'inquiries'
                  ? 'Sponsorship inquiries sent from the website'
                  : 'Approve new members and email-claim requests'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {tab === 'events' && (
              <>
                <button
                  onClick={() => { setFormError(''); setEditing(NEW_SERIES); }}
                  className="px-5 py-2.5 rounded-full text-sm font-bold border border-itc-green/40 text-itc-green hover:bg-itc-green hover:text-white transition-colors flex items-center gap-2"
                >
                  <Repeat className="w-4 h-4" /> New Series
                </button>
                <button
                  onClick={() => { setFormError(''); setEditing(NEW_EVENT); }}
                  className="px-5 py-2.5 rounded-full text-sm font-bold bg-itc-green text-white hover:bg-itc-red transition-colors flex items-center gap-2 shadow-lg shadow-itc-green/20"
                >
                  <Plus className="w-4 h-4" /> New Event
                </button>
              </>
            )}
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-2.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-full bg-slate-100 dark:bg-slate-900 w-fit mb-8">
          {[['events', 'Events'], ['inquiries', 'Inquiries'], ['community', 'Community']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-colors ${
                tab === key
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'inquiries' && (
          <AdminInquiries authHeaders={authHeaders} onUnauthorized={handleUnauthorized} />
        )}

        {tab === 'community' && (
          <AdminCommunity authHeaders={authHeaders} onUnauthorized={handleUnauthorized} />
        )}

        {tab === 'events' && loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        )}

        {tab === 'events' && loadError && !loading && (
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-itc-red/30 text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">{loadError}</p>
            <button onClick={fetchEvents} className="px-5 py-2 rounded-full text-sm font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900">
              Retry
            </button>
          </div>
        )}

        {tab === 'events' && !loading && !loadError && (
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event._id}
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-itc-green/30 transition-colors"
              >
                <div className="flex-grow min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {event.type}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <Calendar className="w-3 h-3" /> {event.date}
                    </span>
                    {isRecurring(event) && (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-itc-green/10 text-itc-green">
                        <Repeat className="w-3 h-3" />
                        {describeCadence(event.recurrence)}
                        {nextOccurrence(event) && ` · next ${formatShortDate(nextOccurrence(event).date)}`}
                      </span>
                    )}
                    {event.series && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        {event.series}
                      </span>
                    )}
                    {event.time && (
                      <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Clock className="w-3 h-3" /> {event.time}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white truncate">{event.title}</h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1 min-w-0">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </span>
                    {event.link && <span className="flex items-center gap-1"><LinkIcon className="w-3 h-3" /> link</span>}
                    {(event.galleryCount ?? event.gallery?.length ?? 0) > 0 && (
                      <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> {event.galleryCount ?? event.gallery.length} photos</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => startEdit(event)}
                    disabled={editLoadingId === event._id}
                    className="p-2.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-itc-green transition-colors disabled:opacity-50"
                    title="Edit"
                  >
                    {editLoadingId === event._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(event)}
                    disabled={deletingId === event._id}
                    className="p-2.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-itc-red transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    {deletingId === event._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}

            {events.length === 0 && (
              <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-slate-500 dark:text-slate-400">
                No events yet. Create the first one!
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <EventForm
            key={isDraft(editing) ? editing : editing._id}
            initialForm={
              editing === NEW_EVENT ? EMPTY_FORM
                : editing === NEW_SERIES ? NEW_SERIES_FORM
                  : eventToForm(editing, events)
            }
            isEdit={!isDraft(editing)}
            seriesOptions={seriesOptions}
            candidates={editionCandidates}
            saving={saving}
            error={formError}
            onSubmit={handleSave}
            onCancel={() => setEditing(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium shadow-xl flex items-center gap-2 z-50"
          >
            <CheckCircle2 className="w-4 h-4 text-itc-green" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminEvents;
