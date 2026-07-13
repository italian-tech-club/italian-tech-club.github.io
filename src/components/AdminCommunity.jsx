import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Mail, Linkedin, Calendar, Inbox, Check, X, UserPlus, ArrowRight, AlertCircle,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
});

const AdminCommunity = ({ authHeaders, onUnauthorized }) => {
  const [pendingProfiles, setPendingProfiles] = useState([]);
  const [claimRequests, setClaimRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [overrides, setOverrides] = useState({}); // requestId -> manual profileId

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
    } catch {
      setLoadError('Could not load community data from the server.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, onUnauthorized]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const act = async (id, body) => {
    setBusyId(id);
    try {
      const response = await fetch(`${API_URL}/api/community/admin`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
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

  return (
    <div className="space-y-10">
      {/* Pending profiles */}
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
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {p.profession}{p.company ? ` · ${p.company}` : ''}
                      </p>
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

      {/* Email claim requests */}
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
    </div>
  );
};

export default AdminCommunity;
