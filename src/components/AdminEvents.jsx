import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Plus, Pencil, Trash2, X, LogOut, Loader2,
  Calendar, MapPin, Clock, Link as LinkIcon, Image as ImageIcon, AlertCircle, CheckCircle2,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const STORAGE_KEY = 'itc_admin_key';

const EVENT_TYPES = ['Networking', 'Talk', 'Launch Party', "Members' Dinner", "Members' Brunch"];

const EMPTY_FORM = {
  date: '',
  title: '',
  subtitle: '',
  location: '',
  time: '',
  type: '',
  link: '',
  poster: '',
  gallery: '',
};

const inputClass =
  'w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-itc-green/50 focus:border-itc-green transition-colors text-sm';

const labelClass = 'block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

const eventToForm = (event) => ({
  date: event.date || '',
  title: event.title || '',
  subtitle: event.subtitle || '',
  location: event.location || '',
  time: event.time || '',
  type: event.type || '',
  link: event.link || '',
  poster: event.poster || '',
  gallery: (event.gallery || []).join('\n'),
});

const formToPayload = (form) => ({
  date: form.date.trim(),
  title: form.title.trim(),
  subtitle: form.subtitle.trim(),
  location: form.location.trim(),
  time: form.time.trim() || null,
  type: form.type.trim(),
  link: form.link.trim() || null,
  poster: form.poster.trim() || null,
  gallery: form.gallery
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean),
});

const LoginGate = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({ action: 'verify' }),
      });

      if (response.ok) {
        onLogin(password);
      } else if (response.status === 401) {
        setError('Wrong password');
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
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
          Enter the admin password to manage events
        </p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className={inputClass}
        />

        {error && (
          <p className="flex items-center gap-2 text-sm text-itc-red mt-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full mt-6 px-6 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
        </button>
      </motion.form>
    </div>
  );
};

const EventForm = ({ initialForm, saving, error, onSubmit, onCancel, isEdit }) => {
  const [form, setForm] = useState(initialForm);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onCancel}
    >
      <motion.form
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl my-8 p-6 md:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {isEdit ? 'Edit Event' : 'New Event'}
          </h2>
          <button type="button" onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

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
            <label className={labelClass}>Poster Path</label>
            <input type="text" value={form.poster} onChange={set('poster')} placeholder="/images/events/my-event/poster.png" className={inputClass} />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Gallery Paths (one per line)</label>
            <textarea
              rows={4}
              value={form.gallery}
              onChange={set('gallery')}
              placeholder={'/images/events/my-event/img1.jpg\n/images/events/my-event/img2.jpg'}
              className={`${inputClass} font-mono text-xs resize-y`}
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
              Image files still need to be committed to the repo under <code className="font-mono">public/images/events/</code> (or use full external URLs).
            </p>
          </div>
        </div>

        {error && (
          <p className="flex items-center gap-2 text-sm text-itc-red mt-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 rounded-full text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-full text-sm font-bold bg-itc-green text-white hover:bg-itc-red transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Event'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
};

const AdminEvents = () => {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(STORAGE_KEY) || '');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | event object
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState('');

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

  const handleLogin = (password) => {
    sessionStorage.setItem(STORAGE_KEY, password);
    setAdminKey(password);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setAdminKey('');
    setEvents([]);
  };

  const handleUnauthorized = () => {
    handleLogout();
  };

  const handleSave = async (form) => {
    setSaving(true);
    setFormError('');
    const isEdit = editing !== 'new';

    try {
      const url = isEdit ? `${API_URL}/api/events?id=${editing._id}` : `${API_URL}/api/events`;
      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(formToPayload(form)),
      });

      if (response.status === 401) return handleUnauthorized();

      const data = await response.json();
      if (!response.ok || !data.success) {
        setFormError(data.message || 'Failed to save event');
        return;
      }

      setEditing(null);
      showToast(isEdit ? 'Event updated' : 'Event created');
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

  if (!adminKey) {
    return <LoginGate onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Events Admin</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {events.length} event{events.length === 1 ? '' : 's'} in the database
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setFormError(''); setEditing('new'); }}
              className="px-5 py-2.5 rounded-full text-sm font-bold bg-itc-green text-white hover:bg-itc-red transition-colors flex items-center gap-2 shadow-lg shadow-itc-green/20"
            >
              <Plus className="w-4 h-4" /> New Event
            </button>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-2.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        )}

        {loadError && !loading && (
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-itc-red/30 text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">{loadError}</p>
            <button onClick={fetchEvents} className="px-5 py-2 rounded-full text-sm font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900">
              Retry
            </button>
          </div>
        )}

        {!loading && !loadError && (
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
                    {(event.gallery?.length || 0) > 0 && (
                      <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> {event.gallery.length} photos</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => { setFormError(''); setEditing(event); }}
                    className="p-2.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-itc-green transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
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
            key={editing === 'new' ? 'new' : editing._id}
            initialForm={editing === 'new' ? EMPTY_FORM : eventToForm(editing)}
            isEdit={editing !== 'new'}
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
