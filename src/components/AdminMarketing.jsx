import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, Send, Mail, Plus, Trash2, Save, Eye, RefreshCw, Users, MailX, AlertCircle, Check,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

// A new campaign starts as a blank of the shape the renderer expects, so the
// preview has something to draw from the first keystroke.
const BLANK = {
  name: '',
  subject: '',
  preheader: '',
  eyebrow: '',
  headline: '',
  body: '',
  signoff: '',
  ctaLabel: '',
  ctaUrl: '',
  eventId: '',
  promoTitle: '',
  promoCode: '',
  promoNote: '',
  audience: 'all',
};

const AUDIENCES = [
  { key: 'all', label: 'Everyone' },
  { key: 'claimed', label: 'Claimed only' },
  { key: 'unclaimed', label: 'Not yet claimed' },
  { key: 'approved', label: 'Approved only' },
];

const relTime = (iso) => {
  if (!iso) return 'never';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
    {hint && <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">{hint}</span>}
    <div className="mt-1.5">{children}</div>
  </label>
);

const INPUT = 'w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-itc-green/40';

const AdminMarketing = ({ authHeaders, onUnauthorized }) => {
  const [campaigns, setCampaigns] = useState([]);
  const [audience, setAudience] = useState(null);
  const [optedOut, setOptedOut] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [draft, setDraft] = useState(BLANK);
  const [editingId, setEditingId] = useState(null); // null = unsaved new campaign
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState('');           // 'save' | 'test' | 'send' | 'delete'
  const [message, setMessage] = useState('');
  const [testEmail, setTestEmail] = useState('');

  const current = campaigns.find((c) => c._id === editingId) || null;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch(`${API_URL}/api/community/marketing`, { headers: authHeaders() });
      if (response.status === 401) return onUnauthorized();
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      setCampaigns(data.campaigns || []);
      setAudience(data.audience || null);
      setOptedOut(data.optedOut || []);
      setEvents(data.events || []);
    } catch {
      setLoadError('Could not load marketing data from the server.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, onUnauthorized]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const post = async (body) => {
    const response = await fetch(`${API_URL}/api/community/marketing`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (response.status === 401) {
      onUnauthorized();
      return null;
    }
    return response.json();
  };

  // The preview follows the composer, not the saved document — what you are
  // typing is what you see. Debounced so a paragraph isn't 40 round-trips.
  const previewTimer = useRef(null);
  useEffect(() => {
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      try {
        const data = await post({ action: 'preview', campaign: draft });
        if (data?.success) setPreview(data.html);
      } catch { /* a preview that fails to render is not worth an alert */ }
    }, 500);
    return () => clearTimeout(previewTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const set = (field) => (e) => setDraft((d) => ({ ...d, [field]: e.target.value }));

  const pickEvent = (e) => {
    const eventId = e.target.value;
    const event = events.find((ev) => ev._id === eventId);
    setDraft((d) => ({
      ...d,
      eventId,
      // Attaching an event fills the blanks it can answer; anything already
      // typed is left alone.
      ctaUrl: d.ctaUrl || event?.link || '',
      headline: d.headline || event?.title || '',
    }));
  };

  const startNew = () => {
    setEditingId(null);
    setDraft(BLANK);
    setMessage('');
  };

  const openCampaign = (campaign) => {
    setEditingId(campaign._id);
    setDraft({ ...BLANK, ...campaign, eventId: campaign.eventId || '' });
    setMessage('');
  };

  /** Save, and return the campaign id — every send goes through a save first. */
  const save = async () => {
    const data = await post({ action: 'save', campaignId: editingId, campaign: draft });
    if (!data) return null;
    if (!data.success) {
      setMessage(data.message || 'Save failed.');
      return null;
    }
    setEditingId(data.campaign._id);
    await fetchData();
    return data.campaign._id;
  };

  const handleSave = async () => {
    setBusy('save');
    setMessage('');
    const id = await save();
    if (id) setMessage('Saved.');
    setBusy('');
  };

  const handleTest = async () => {
    setBusy('test');
    setMessage('');
    const id = await save();
    if (id) {
      const data = await post({ action: 'test', campaignId: id, toEmail: testEmail.trim() });
      setMessage(data?.message || 'Test send failed.');
    }
    setBusy('');
  };

  const handleSend = async () => {
    const target = audience?.[draft.audience] ?? 0;
    const label = AUDIENCES.find((a) => a.key === draft.audience)?.label;
    if (!window.confirm(
      `Send "${draft.subject}" to ${target} contact${target === 1 ? '' : 's'} (${label})?\n\n`
      + 'Anyone who already received this campaign is skipped. This cannot be undone.'
    )) return;

    setBusy('send');
    setMessage('');
    const id = await save();
    if (id) {
      const data = await post({ action: 'send', campaignId: id });
      setMessage(data?.message || 'Send failed.');
      await fetchData();
    }
    setBusy('');
  };

  const handleDelete = async () => {
    if (!editingId || !window.confirm(`Delete "${draft.name}"? The send history goes with it.`)) return;
    setBusy('delete');
    const data = await post({ action: 'delete', campaignId: editingId });
    setMessage(data?.message || '');
    startNew();
    await fetchData();
    setBusy('');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 flex items-center gap-2 text-sm">
        <AlertCircle className="w-4 h-4" /> {loadError}
      </div>
    );
  }

  const reach = audience?.[draft.audience] ?? 0;

  return (
    <div className="space-y-8">
      {/* Audience at a glance */}
      {audience && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {AUDIENCES.map((a) => (
            <div key={a.key} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{audience[a.key]}</div>
              <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">{a.label}</div>
            </div>
          ))}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-2xl font-bold text-itc-red">{audience.optedOut}</div>
            <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">Opted out</div>
          </div>
        </div>
      )}

      {/* Campaign list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white">Campaigns</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              title="Refresh"
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-itc-green"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button
              onClick={startNew}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold bg-itc-green text-white hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> New campaign
            </button>
          </div>
        </div>

        {campaigns.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No campaigns yet — compose one below.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {campaigns.map((c) => (
              <button
                key={c._id}
                onClick={() => openCampaign(c)}
                className={`text-left p-4 rounded-2xl border transition-colors ${
                  editingId === c._id
                    ? 'border-itc-green bg-itc-green/5'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white truncate">{c.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    c.status === 'sent'
                      ? 'bg-itc-green/10 text-itc-green'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}>{c.status}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{c.subject}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                  {c.sentCount ? `${c.sentCount} sent · ${relTime(c.lastSentAt)}` : 'never sent'}
                  {c.failedCount ? ` · ${c.failedCount} failed` : ''}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Composer */}
      <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-itc-green" />
          <h3 className="font-bold text-slate-900 dark:text-white">
            {editingId ? `Editing: ${current?.name || draft.name}` : 'New campaign'}
          </h3>
          {editingId && (
            <button
              onClick={handleDelete}
              disabled={!!busy}
              title="Delete campaign"
              className="ml-auto p-2 rounded-full text-slate-400 hover:text-itc-red hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Campaign name" hint="internal only">
            <input value={draft.name} onChange={set('name')} placeholder="The Italian Job — invito" className={INPUT} />
          </Field>
          <Field label="Event" hint="poster + date/venue block">
            <select value={draft.eventId} onChange={pickEvent} className={INPUT}>
              <option value="">— no event —</option>
              {events.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.date} · {e.title}{e.hasPoster ? '' : ' (no poster)'}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Subject" hint="{{firstName}} works here too">
          <input value={draft.subject} onChange={set('subject')} placeholder="Ciao {{firstName}}, ci vediamo il 23?" className={INPUT} />
        </Field>

        <Field label="Preheader" hint="the grey line after the subject in the inbox">
          <input value={draft.preheader} onChange={set('preheader')} className={INPUT} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Eyebrow" hint="small red label above the title">
            <input value={draft.eyebrow} onChange={set('eyebrow')} placeholder="Tech Talk Series" className={INPUT} />
          </Field>
          <Field label="Headline">
            <input value={draft.headline} onChange={set('headline')} className={INPUT} />
          </Field>
        </div>

        <Field label="Body" hint="blank line = new paragraph · **bold** · [link](url) · {{firstName}}">
          <textarea value={draft.body} onChange={set('body')} rows={10} className={`${INPUT} font-mono`} />
        </Field>

        {/* A textarea, not an input: a sign-off is two lines ("A presto," /
            the name), and a single-line field silently eats the break. */}
        <Field label="Sign-off">
          <textarea value={draft.signoff} onChange={set('signoff')} rows={2} placeholder={'A presto,\nGiuseppe — Italian Tech Club NYC'} className={INPUT} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Promo label">
            <input value={draft.promoTitle} onChange={set('promoTitle')} placeholder="Solo per i membri ITC" className={INPUT} />
          </Field>
          <Field label="Promo code" hint="empty = no block">
            <input value={draft.promoCode} onChange={set('promoCode')} placeholder="ITC-MEMBER-26" className={`${INPUT} font-mono`} />
          </Field>
          <Field label="Promo note">
            <input value={draft.promoNote} onChange={set('promoNote')} placeholder="10% di sconto al checkout" className={INPUT} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Button label">
            <input value={draft.ctaLabel} onChange={set('ctaLabel')} placeholder="Registrati per l'evento" className={INPUT} />
          </Field>
          <Field label="Button link">
            <input value={draft.ctaUrl} onChange={set('ctaUrl')} placeholder="https://luma.com/..." className={INPUT} />
          </Field>
        </div>

        {/* Audience */}
        <Field label="Audience" hint="opted-out and inactive members are always excluded">
          <div className="flex flex-wrap gap-2">
            {AUDIENCES.map((a) => (
              <button
                key={a.key}
                onClick={() => setDraft((d) => ({ ...d, audience: a.key }))}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  draft.audience === a.key
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {a.label} ({audience?.[a.key] ?? 0})
              </button>
            ))}
          </div>
        </Field>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={handleSave}
            disabled={!!busy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </button>

          <div className="flex items-center gap-2">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="you@example.com"
              className="px-3 py-2 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-itc-green/40"
            />
            <button
              onClick={handleTest}
              disabled={!!busy || !testEmail.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {busy === 'test' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Send test
            </button>
          </div>

          <button
            onClick={handleSend}
            disabled={!!busy || !draft.subject.trim() || reach === 0}
            className="flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-bold bg-itc-green text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {busy === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send to {reach}
          </button>

          {message && <span className="text-sm text-slate-600 dark:text-slate-300">{message}</span>}
        </div>
      </section>

      {/* Preview — the same renderer the send uses, with a stand-in recipient */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-itc-green" />
          <h3 className="font-bold text-slate-900 dark:text-white">Preview</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">as Mario Rossi</span>
        </div>
        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#F1F2F1]">
          <iframe
            title="Email preview"
            srcDoc={preview}
            sandbox=""
            className="w-full h-[760px] border-0"
          />
        </div>
      </section>

      {/* Opt-outs */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <MailX className="w-4 h-4 text-itc-red" />
          <h3 className="font-bold text-slate-900 dark:text-white">Opted out ({optedOut.length})</h3>
        </div>
        {optedOut.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Check className="w-4 h-4 text-itc-green" /> Nobody has unsubscribed.
          </p>
        ) : (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {optedOut.map((m) => (
              <div key={m._id} className="p-3 flex items-center justify-between gap-3 text-sm">
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">{m.firstName} {m.lastName}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{m.email}</div>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500">{relTime(m.marketingOptOutAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-slate-400 dark:text-slate-500 flex items-start gap-1.5">
        <Users className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        Every campaign carries an unsubscribe link and the List-Unsubscribe headers Gmail and Apple Mail
        act on. Opting out only stops marketing — sign-in links and connect requests still go through.
      </p>
    </div>
  );
};

export default AdminMarketing;
