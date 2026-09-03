import React, { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Check, X, RefreshCw, Inbox, Mail, MapPin, Phone, Sparkles, ShieldAlert,
  Undo2, AlertCircle, Copy, MessageCircle,
} from 'lucide-react';
import PhotoGrabber from './PhotoGrabber';
import { copyText, toE164 } from '../utils/clipboard';

/**
 * The Gomry application queue, so a membership decision doesn't mean a trip to
 * gomry.com.
 *
 * Gomry stays the source of truth — Approve writes the status there and the
 * member record follows from it, never the other way round — which keeps this
 * panel and the acceptance webhook telling the same story.
 *
 * Only New York applications appear. The Gomry organisation is shared by every
 * ITC chapter, and the great majority of what's pending on it belongs to Madrid,
 * San Francisco and Paris; the server refuses a decision on those, and the tally
 * at the foot of the page is all this shows of them.
 */

const API_URL = import.meta.env.VITE_API_URL || '';

const formatDate = (iso) => (iso
  ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—');

const initialsOf = (row) => `${row.firstName?.[0] || ''}${row.lastName?.[0] || ''}`.toUpperCase() || '·';

const STATUS_STYLE = {
  Accepted: 'bg-itc-green/10 text-itc-green',
  Rejected: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  Pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
};

const Badge = ({ tone = 'slate', icon: Icon, children }) => {
  const tones = {
    slate: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
    green: 'bg-itc-green/10 text-itc-green',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone]}`}>
      {Icon && <Icon className="w-3 h-3" />} {children}
    </span>
  );
};

const Field = ({ icon: Icon, label, value }) => (value ? (
  <div className="min-w-0">
    <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1">
      {Icon && <Icon className="w-3 h-3" />} {label}
    </div>
    <div className="text-sm text-slate-700 dark:text-slate-200 truncate" title={value}>{value}</div>
  </div>
) : null);

/**
 * A field whose whole value is a copy button — for the two things that get
 * pasted somewhere else the moment an application is approved: the WhatsApp
 * number (into the community group) and the email.
 *
 * `copyValue` lets the copied text differ from the shown one, so the number
 * reads as the applicant typed it but pastes as E.164.
 */
const CopyField = ({ icon: Icon, label, value, copyValue, action }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!value) return null;
  const payload = copyValue || value;

  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />} {label}
        {action}
      </div>
      <button
        type="button"
        onClick={async () => setCopied(await copyText(payload))}
        title={`Copy ${payload}`}
        className={`group flex items-start gap-1.5 max-w-full text-sm text-left transition-colors ${
          copied ? 'text-itc-green' : 'text-slate-700 dark:text-slate-200 hover:text-itc-green'
        }`}
      >
        {/* The value stays put while confirming — swapping it for "copied"
            reflows the row, and an email that rewraps mid-word reads as a
            glitch rather than a confirmation. */}
        <span className="break-all">{value}</span>
        {copied
          ? <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          : <Copy className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 transition-opacity" />}
      </button>
    </div>
  );
};

const AdminGomry = ({ authHeaders, onUnauthorized }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [notify, setNotify] = useState(true);
  const [showDecided, setShowDecided] = useState(false);
  // Applicant id → the photo pasted for them but not yet saved. A pending
  // applicant has no profile to write to, so it waits for the approval that
  // creates one.
  const [staged, setStaged] = useState({});
  const [notes, setNotes] = useState({}); // applicant id → last message for that card

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch(`${API_URL}/api/community/gomry-admin`, { headers: authHeaders() });
      if (response.status === 401) return onUnauthorized();
      const body = await response.json();
      if (!body.success) throw new Error(body.message);
      setData(body);
      setStaged({});
    } catch (error) {
      setLoadError(error.message || 'Could not load the Gomry queue.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, onUnauthorized]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const note = (id, message) => setNotes((n) => ({ ...n, [id]: message }));

  const decide = async (row, decision) => {
    const verb = decision === 'Accepted' ? 'Approve' : decision === 'Rejected' ? 'Reject' : 'Return to review';
    const mail = notify ? ' Gomry will email them.' : ' No email will be sent.';
    if (!window.confirm(`${verb} ${row.firstName} ${row.lastName}?${mail}`)) return;

    setBusyId(row.id);
    note(row.id, '');
    try {
      const response = await fetch(`${API_URL}/api/community/gomry-admin`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          applicationId: row.id,
          decision,
          notifyApplicant: notify,
          ...(decision === 'Accepted' ? (staged[row.id] || {}) : {}),
        }),
      });
      if (response.status === 401) return onUnauthorized();
      const body = await response.json();
      if (!body.success) return note(row.id, body.message || 'That did not work.');
      await fetchData();
    } catch {
      note(row.id, 'Could not reach the server.');
    } finally {
      setBusyId(null);
    }
  };

  /**
   * A photo handed over for someone who already has a member profile saves
   * straight away; for a pending applicant there is nothing to save it to yet,
   * so it is held until Approve creates the profile.
   */
  const takePhoto = async (row, member, payload) => {
    if (!member) {
      setStaged((s) => ({ ...s, [row.id]: payload }));
      note(row.id, payload.profilePicUrl
        ? 'Image URL held — it is fetched and saved when you approve.'
        : 'Photo held — it is saved when you approve.');
      return;
    }

    setBusyId(row.id);
    note(row.id, '');
    try {
      const response = await fetch(`${API_URL}/api/community/admin`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'set-profile-photo', profileId: member.id, ...payload }),
      });
      if (response.status === 401) return onUnauthorized();
      const body = await response.json();
      note(row.id, body.message || (body.success ? 'Photo saved.' : 'Photo failed.'));
      if (body.success) await fetchData();
    } catch {
      note(row.id, 'Could not reach the server.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  if (loadError) {
    return (
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-itc-red/30 text-center space-y-3">
        <p className="text-slate-600 dark:text-slate-400">{loadError}</p>
        <button onClick={fetchData} className="px-5 py-2 rounded-full text-sm font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900">
          Retry
        </button>
      </div>
    );
  }

  const { pending = [], recent = [], members = {}, otherHubs = [], hub } = data || {};
  const otherTotal = otherHubs.reduce((sum, h) => sum + h.count, 0);

  const card = (row, { decided = false } = {}) => {
    const member = members[row.email] || null;
    const stagedPhoto = staged[row.id];
    const busy = busyId === row.id;

    return (
      <div key={row.id} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-start gap-4">
          <PhotoGrabber
            linkedIn={row.linkedIn}
            initials={initialsOf(row)}
            preview={stagedPhoto?.profilePic || stagedPhoto?.profilePicUrl || member?.profilePic || null}
            hasPhoto={Boolean(member?.hasPhoto)}
            busy={busy}
            hint={stagedPhoto && !member ? 'saves on approve' : member?.hasPhoto ? 'replace' : 'paste a photo'}
            onPhoto={(payload) => takePhoto(row, member, payload)}
            onError={(message) => note(row.id, message)}
          />

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-bold text-slate-900 dark:text-white">{row.firstName} {row.lastName}</h4>
              {decided && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLE[row.status] || ''}`}>{row.status}</span>}
              {!row.gdprConsent && (
                <Badge tone="amber" icon={ShieldAlert}>no GDPR consent — stays out of the directory</Badge>
              )}
              {member && (
                <Badge tone="green" icon={Check}>
                  member{member.memberNumber ? ` #${member.memberNumber}` : ''} · {member.status}{member.claimed ? ' · claimed' : ''}
                </Badge>
              )}
              {row.city && !/new york|nyc|brooklyn|manhattan|queens|jersey/i.test(row.city) && (
                <Badge tone="amber" icon={MapPin}>lives in {row.city}</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
              <Field label="Role" value={[row.jobTitle, row.company].filter(Boolean).join(' · ')} />
              <Field icon={MapPin} label="City" value={row.city} />
              <Field icon={Sparkles} label="Expertise" value={row.expertise} />
              <CopyField
                icon={Phone}
                label="WhatsApp"
                value={row.whatsapp}
                copyValue={toE164(row.whatsapp)}
                action={row.whatsapp && (
                  <a
                    href={`https://wa.me/${toE164(row.whatsapp).replace('+', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open a WhatsApp chat"
                    className="text-slate-400 hover:text-itc-green transition-colors"
                  >
                    <MessageCircle className="w-3 h-3" />
                  </a>
                )}
              />
              <CopyField icon={Mail} label="Email" value={row.email} />
              <Field label="Referred by" value={row.referral} />
              <Field label="Applied" value={formatDate(row.submittedAt)} />
            </div>

            {row.special && (
              <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 block">What makes them special</span>
                {row.special}
              </p>
            )}
            {row.motivation && (
              <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Motivation</span>
                {row.motivation}
              </p>
            )}

            {notes[row.id] && (
              <p className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5 pt-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" /> {notes[row.id]}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            {row.status !== 'Accepted' && (
              <button
                onClick={() => decide(row, 'Accepted')}
                disabled={busy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold bg-itc-green text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
              </button>
            )}
            {row.status !== 'Rejected' && (
              <button
                onClick={() => decide(row, 'Rejected')}
                disabled={busy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" /> Reject
              </button>
            )}
            {decided && (
              <button
                onClick={() => decide(row, 'Pending')}
                disabled={busy}
                title="Put this submission back in the review queue on Gomry"
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50"
              >
                <Undo2 className="w-3.5 h-3.5" /> Reopen
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {hub} applications awaiting review ({pending.length})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Approving writes the decision to Gomry and creates the ITC member profile from it.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-itc-green" />
            Send Gomry&apos;s acceptance / rejection email
          </label>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-itc-green"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {pending.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-slate-500 dark:text-slate-400">
          <Inbox className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          Nothing waiting for a decision.
        </div>
      ) : (
        <div className="space-y-4">{pending.map((row) => card(row))}</div>
      )}

      {recent.length > 0 && (
        <section className="space-y-4">
          <button
            onClick={() => setShowDecided((on) => !on)}
            className="text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-itc-green transition-colors"
          >
            {showDecided ? 'Hide' : 'Show'} recently decided ({recent.length}) — fix a photo or change a verdict
          </button>
          {showDecided && (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Changing a verdict here only moves it on Gomry. A member profile that already exists is not
                removed — do that from the Community tab.
              </p>
              <div className="space-y-4">{recent.map((row) => card(row, { decided: true }))}</div>
            </>
          )}
        </section>
      )}

      {otherTotal > 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-800 pt-4">
          <span className="font-bold">{otherTotal} pending in other chapters</span> (decided by them, in Gomry):{' '}
          {otherHubs.map((h) => `${h.hub} ${h.count}`).join(' · ')}
        </p>
      )}
    </div>
  );
};

export default AdminGomry;
