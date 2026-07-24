import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, Mail, Linkedin, Calendar, Inbox, Check, X, UserPlus, ArrowRight, AlertCircle,
  Users, Send, RefreshCw,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

// Defaults must match the backend (DEFAULT_CLAIM_SUBJECT / DEFAULT_CLAIM_BODY).
const DEFAULT_SUBJECT = 'Claim your Italian Tech Club profile 🇮🇹';
const DEFAULT_BODY = `Ciao {{firstName}}!

Your Italian Tech Club NYC profile is ready. We've set it up from our community roster — claim it to make it live, browse fellow members, and start connecting.

Click below to sign in and claim your profile. The link expires in 7 days.`;

const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
});

const relTime = (iso) => {
  if (!iso) return 'never';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const STATUS_STYLE = {
  approved: 'bg-itc-green/10 text-itc-green',
  pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  unclaimed: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  inactive: 'bg-slate-100 dark:bg-slate-800 text-slate-400',
};

const FILTERS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'unclaimed', label: 'Unclaimed', test: (m) => !m.claimed },
  { key: 'seededUnclaimed', label: 'Seeded & unclaimed', test: (m) => m.seeded && !m.claimed },
  { key: 'neverEmailed', label: 'Never emailed', test: (m) => !m.lastClaimEmailAt },
  { key: 'claimed', label: 'Claimed', test: (m) => m.claimed },
];

const StatCard = ({ label, value, accent }) => (
  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
    <div className={`text-2xl font-bold ${accent || 'text-slate-900 dark:text-white'}`}>{value}</div>
    <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">{label}</div>
  </div>
);

const AdminCommunity = ({ authHeaders, onUnauthorized }) => {
  const [tab, setTab] = useState('members');
  const [pendingProfiles, setPendingProfiles] = useState([]);
  const [claimRequests, setClaimRequests] = useState([]);
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [overrides, setOverrides] = useState({}); // requestId -> manual profileId

  // Members-tab state
  const [filter, setFilter] = useState('seededUnclaimed');
  const [selected, setSelected] = useState(new Set());
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch(`${API_URL}/api/community/admin`, { headers: authHeaders() });
      if (response.status === 401) return onUnauthorized();
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      setPendingProfiles(data.pendingProfiles || []);
      setClaimRequests(data.claimRequests || []);
      setMembers(data.members || []);
      setStats(data.stats || null);
    } catch {
      setLoadError('Could not load community data from the server.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, onUnauthorized]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const act = async (id, body_) => {
    setBusyId(id);
    try {
      const response = await fetch(`${API_URL}/api/community/admin`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body_),
      });
      if (response.status === 401) return onUnauthorized();
      const data = await response.json();
      if (!data.success) {
        alert(data.message || 'Action failed');
        return;
      }
      await fetchData();
    } catch {
      alert('Could not reach the server.');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const test = (FILTERS.find((f) => f.key === filter) || FILTERS[0]).test;
    return members.filter(test);
  }, [members, filter]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((m) => selected.has(m._id));

  const toggleOne = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    const next = new Set(selected);
    if (allFilteredSelected) filtered.forEach((m) => next.delete(m._id));
    else filtered.forEach((m) => next.add(m._id));
    setSelected(next);
  };

  const sendClaim = async () => {
    const ids = members.filter((m) => selected.has(m._id)).map((m) => m._id);
    if (ids.length === 0) return;
    if (!window.confirm(`Send the claim email to ${ids.length} member${ids.length === 1 ? '' : 's'}?`)) return;
    setSending(true);
    setSendMsg('');
    try {
      const response = await fetch(`${API_URL}/api/community/admin`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'send-claim-emails', profileIds: ids, subject, bodyHtml: body }),
      });
      if (response.status === 401) return onUnauthorized();
      const data = await response.json();
      setSendMsg(data.message || (data.success ? 'Sent.' : 'Send failed.'));
      if (data.success) {
        setSelected(new Set());
        await fetchData();
      }
    } catch {
      setSendMsg('Could not reach the server.');
    } finally {
      setSending(false);
    }
  };

  const sendTest = async () => {
    if (!testEmail.trim()) return;
    setSending(true);
    setSendMsg('');
    try {
      const response = await fetch(`${API_URL}/api/community/admin`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'send-test-email', toEmail: testEmail.trim(), subject, bodyHtml: body }),
      });
      if (response.status === 401) return onUnauthorized();
      const data = await response.json();
      setSendMsg(data.message || (data.success ? 'Test sent.' : 'Send failed.'));
    } catch {
      setSendMsg('Could not reach the server.');
    } finally {
      setSending(false);
    }
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
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-itc-red/30 text-center">
        <p className="text-slate-600 dark:text-slate-400 mb-4">{loadError}</p>
        <button onClick={fetchData} className="px-5 py-2 rounded-full text-sm font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900">
          Retry
        </button>
      </div>
    );
  }

  const TABS = [
    { key: 'members', label: 'Members', icon: Users, count: members.length },
    { key: 'pending', label: 'Pending', icon: Inbox, count: pendingProfiles.length },
    { key: 'claims', label: 'Claim requests', icon: UserPlus, count: claimRequests.length },
  ];

  return (
    <div className="space-y-8">
      {/* Tab bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-bold transition-colors ${
                active
                  ? 'bg-white dark:bg-slate-900 text-itc-green border border-b-0 border-slate-200 dark:border-slate-800'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${active ? 'bg-itc-green/10 text-itc-green' : 'bg-slate-100 dark:bg-slate-800'}`}>{t.count}</span>
            </button>
          );
        })}
        <button
          onClick={fetchData}
          title="Refresh"
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-itc-green"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* ---- Members tab: dashboard + claim campaign ---- */}
      {tab === 'members' && (
        <div className="space-y-8">
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard label="Total" value={stats.total} />
              <StatCard label="Claimed" value={stats.claimed} accent="text-itc-green" />
              <StatCard label="Unclaimed" value={stats.unclaimed} accent="text-amber-600 dark:text-amber-400" />
              <StatCard label="Seeded · unclaimed" value={stats.seededUnclaimed} />
              <StatCard label="Pending" value={(stats.byStatus && stats.byStatus.pending) || 0} />
            </div>
          )}

          {/* Compose / send panel */}
          <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-itc-green" />
              <h3 className="font-bold text-slate-900 dark:text-white">Claim / welcome email</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Each recipient gets a personal 7-day sign-in link that claims their profile on open.
              Placeholders: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{'{{firstName}}'}</code>{' '}
              <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{'{{lastName}}'}</code>{' '}
              <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{'{{link}}'}</code> (a button is always appended).
            </p>

            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-itc-green/40"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              placeholder="Email body"
              className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-itc-green/40 font-mono"
            />

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="px-3 py-2 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-itc-green/40"
                />
                <button
                  onClick={sendTest}
                  disabled={sending || !testEmail.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Send test
                </button>
              </div>

              <button
                onClick={sendClaim}
                disabled={sending || selected.size === 0}
                className="flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-bold bg-itc-green text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send to {selected.size} selected
              </button>

              {sendMsg && <span className="text-sm text-slate-600 dark:text-slate-300">{sendMsg}</span>}
            </div>
          </section>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  filter === f.key
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {f.label} ({members.filter(f.test).length})
              </button>
            ))}
          </div>

          {/* Member table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-3 text-left w-10">
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} className="accent-itc-green" />
                  </th>
                  <th className="p-3 text-left">Member</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Claimed</th>
                  <th className="p-3 text-left">#</th>
                  <th className="p-3 text-left">Last emailed</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400">No members match this filter.</td></tr>
                ) : filtered.map((m) => (
                  <tr key={m._id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="p-3">
                      <input type="checkbox" checked={selected.has(m._id)} onChange={() => toggleOne(m._id)} className="accent-itc-green" />
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-900 dark:text-white">{m.firstName} {m.lastName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{m.email}</div>
                      <div className="flex gap-1 mt-1">
                        {m.seeded && <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500">seeded</span>}
                        {!m.emailVerified && <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">unverified</span>}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_STYLE[m.status] || ''}`}>{m.status}</span>
                    </td>
                    <td className="p-3">
                      {m.claimed
                        ? <span className="inline-flex items-center gap-1 text-itc-green"><Check className="w-4 h-4" /></span>
                        : <span className="inline-flex items-center gap-1 text-slate-400"><X className="w-4 h-4" /></span>}
                    </td>
                    <td className="p-3 text-slate-500 dark:text-slate-400">{m.memberNumber ?? '—'}</td>
                    <td className="p-3 text-slate-500 dark:text-slate-400">
                      {relTime(m.lastClaimEmailAt)}{m.claimEmailCount ? ` (${m.claimEmailCount}×)` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- Pending profiles tab ---- */}
      {tab === 'pending' && (
        <section>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
            New profiles awaiting approval ({pendingProfiles.length})
          </h3>

          {pendingProfiles.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-slate-500 dark:text-slate-400">
              <Inbox className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              No profiles pending approval.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingProfiles.map((p) => (
                <div key={p._id} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-4 min-w-0">
                      {p.profilePic ? (
                        <img src={p.profilePic} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-itc-green to-emerald-700 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold">{`${p.firstName?.[0] || ''}${p.lastName?.[0] || ''}`.toUpperCase()}</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-slate-900 dark:text-white">{p.firstName} {p.lastName}</h4>
                          {!p.emailVerified && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">email unverified</span>
                          )}
                          {p.referredBy && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-itc-green/10 text-itc-green font-medium">
                              invited by {p.referredBy.firstName} {p.referredBy.lastName}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {p.profession}{p.company ? ` · ${p.company}` : ''}
                        </p>
                        {(p.roles?.length > 0 || p.lookingFor?.length > 0) && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {(p.roles || []).map((r) => (
                              <span key={r} className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{r}</span>
                            ))}
                            {(p.lookingFor || []).map((l) => (
                              <span key={l} className="px-2 py-0.5 rounded-full text-xs bg-itc-green/10 text-itc-green">seeks: {l}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <a href={`mailto:${p.email}`} className="flex items-center gap-1 hover:text-itc-green"><Mail className="w-3 h-3" /> {p.email}</a>
                          {p.linkedIn && (
                            <a href={p.linkedIn} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-itc-green"><Linkedin className="w-3 h-3" /> LinkedIn</a>
                          )}
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(p.createdAt)}</span>
                        </div>
                        {p.bio && <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 whitespace-pre-wrap">{p.bio}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => act(p._id, { action: 'approve-profile', profileId: p._id })}
                        disabled={busyId === p._id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold bg-itc-green text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        {busyId === p._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
                      </button>
                      <button
                        onClick={() => { if (window.confirm(`Reject and delete ${p.firstName} ${p.lastName}'s profile?`)) act(p._id, { action: 'reject-profile', profileId: p._id }); }}
                        disabled={busyId === p._id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ---- Email claim requests tab ---- */}
      {tab === 'claims' && (
        <section>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
            Email claim requests ({claimRequests.length})
          </h3>

          {claimRequests.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-slate-500 dark:text-slate-400">
              <UserPlus className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              No pending claim requests.
            </div>
          ) : (
            <div className="space-y-4">
              {claimRequests.map((r) => {
                const candidate = r.candidateProfileId;
                return (
                  <div key={r._id} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h4 className="font-bold text-slate-900 dark:text-white">{r.fullName}</h4>
                      <span className="text-xs text-slate-400"><Calendar className="w-3 h-3 inline" /> {formatDate(r.createdAt)}</span>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                      <p className="flex flex-wrap items-center gap-2">
                        {r.currentEmail
                          ? <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{r.currentEmail}</span>
                          : <span className="italic text-slate-400">old email unknown</span>}
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span className="font-mono text-xs bg-itc-green/10 text-itc-green px-2 py-0.5 rounded">{r.requestedEmail}</span>
                      </p>
                      {r.message && <p className="whitespace-pre-wrap pt-1">{r.message}</p>}
                      <p className="pt-1">
                        Matched profile:{' '}
                        {candidate
                          ? <span className="font-medium text-slate-800 dark:text-slate-200">{candidate.firstName} {candidate.lastName} &lt;{candidate.email}&gt; [{candidate.status}]</span>
                          : <span className="text-amber-600 dark:text-amber-400 inline-flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> none auto-matched</span>}
                      </p>
                    </div>

                    {!candidate && (
                      <input
                        type="text"
                        value={overrides[r._id] || ''}
                        onChange={(e) => setOverrides((o) => ({ ...o, [r._id]: e.target.value }))}
                        placeholder="Paste target profile _id to reassign"
                        className="mt-3 w-full px-3 py-2 rounded-lg text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-itc-green/40"
                      />
                    )}

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => act(r._id, { action: 'approve-claim', requestId: r._id, ...(overrides[r._id] ? { profileId: overrides[r._id].trim() } : {}) })}
                        disabled={busyId === r._id || (!candidate && !overrides[r._id])}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold bg-itc-green text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        title={!candidate && !overrides[r._id] ? 'Provide a target profile id first' : 'Reassign this profile to the new email'}
                      >
                        {busyId === r._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
                      </button>
                      <button
                        onClick={() => { if (window.confirm('Reject this claim request?')) act(r._id, { action: 'reject-claim', requestId: r._id }); }}
                        disabled={busyId === r._id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default AdminCommunity;
