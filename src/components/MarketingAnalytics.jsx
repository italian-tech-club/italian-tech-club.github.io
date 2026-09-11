import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, Loader2, RefreshCw, Download, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';
const percent = (value) => value == null ? '—' : `${value}%`;
const date = (value) => value ? new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
const fieldClass = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white';

const csvCell = (value) => {
  const text = String(value ?? '');
  // Names and addresses are untrusted spreadsheet content.
  return `"${(/^\s*[=+@\-]|^[\t\r]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
};

export default function MarketingAnalytics({ campaign, authHeaders, onUnauthorized }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const request = useRef(0);
  const campaignId = campaign._id;

  const load = useCallback(async () => {
    const version = ++request.current;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/marketing/report?campaignId=${encodeURIComponent(campaignId)}`, { headers: authHeaders() });
      if (version !== request.current) return;
      if (response.status === 401) { onUnauthorized(); return; }
      const data = await response.json();
      if (version !== request.current) return;
      if (!response.ok || !data.success) throw new Error(data.message || 'Could not load campaign results.');
      setReport(data);
      setPage(0);
    } catch (err) {
      if (version === request.current) setError(err.message);
    } finally {
      if (version === request.current) setLoading(false);
    }
  }, [campaignId, authHeaders, onUnauthorized]);

  useEffect(() => {
    setReport(null); setSearch(''); setFilter('all'); setPage(0);
    load();
    return () => { request.current++; };
  }, [load, campaign.lastSentAt, campaign.conversionGoal]);

  const sync = async () => {
    setSyncing(true); setError('');
    try {
      for (const eventId of connectedEventIds) {
        const response = await fetch(`${API_URL}/api/marketing/sync?campaignId=${encodeURIComponent(campaignId)}&eventId=${encodeURIComponent(eventId)}`, {
          method: 'POST', headers: authHeaders(),
        });
        if (response.status === 401) { onUnauthorized(); return; }
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Registration sync failed.');
      }
      await load();
    } catch (err) { setError(err.message); }
    finally { setSyncing(false); }
  };

  const rows = (report?.recipients || []).filter((r) => {
    const matches = `${r.name || ''} ${r.email}`.toLowerCase().includes(search.toLowerCase());
    return matches && (filter === 'all' || Boolean(r[filter]));
  });
  const exportCsv = () => {
    const columns = ['name', 'email', 'sentAt', 'deliveredAt', 'openedAt', 'lastOpenedAt', 'ctaClickedAt', 'lastCtaClickedAt', 'convertedAt', 'bouncedAt', 'complainedAt', 'unsubscribedAt', 'tracked'];
    const csv = [columns, ...rows.map((r) => columns.map((c) => r[c]))].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url; link.download = `campaign-${campaignId}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const stats = report?.stats;
  const goals = report?.conversionGoals?.length ? report.conversionGoals : [report?.conversionGoal || 'none'];
  const hasGoal = goals.some((goal) => goal !== 'none');
  const hasRegistrations = goals.includes('registration');
  const connectedEventIds = (report?.eventIds || []).filter((id) => id.startsWith('https://luma.com/') ? report.setup.lumaConfigured : report.setup.gomryConfigured);
  const missingLuma = report?.eventIds.some((id) => id.startsWith('https://luma.com/')) && !report.setup.lumaConfigured;
  const missingGomry = report?.eventIds.some((id) => !id.startsWith('https://luma.com/')) && !report.setup.gomryConfigured;
  return (
    <section aria-label="Campaign results" className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><BarChart3 className="h-4 w-4 text-itc-green" /> Campaign results</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{campaign.name} · Unique recipients</p>
        </div>
        <button type="button" onClick={load} disabled={loading || syncing} className="flex items-center gap-1.5 text-sm font-semibold text-itc-green disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh results
        </button>
      </div>
      {error && <p role="alert" className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{error}</p>}
      {loading && !report && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading results…</div>}
      {report && <>
        {!report.setup.webhookConfigured && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">Email tracking needs setup. Connect the Resend webhook and enable open/click tracking on the sending domain before the next campaign. <a href="https://resend.com/docs/dashboard/domains/tracking" target="_blank" rel="noreferrer" className="underline">Setup instructions</a></p>}
        {stats.untracked > 0 && <p className="text-xs text-slate-500 dark:text-slate-400">{stats.untracked} recipient{stats.untracked === 1 ? ' was' : 's were'} emailed before tracking was added. Their engagement is unknown and excluded from rates.</p>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Accepted', stats.accepted, 'Resend accepted the send'],
            ['Delivered', stats.delivered, 'Accepted by the recipient’s mail server'],
            ['Recorded opens', stats.opened, `${percent(stats.openRate)} open rate`],
            ['Button clicks', stats.ctaClicked, `${percent(stats.clickRate)} click rate`],
          ].map(([label, value, hint]) => <div key={label} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>
          </div>)}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
          <span>{stats.clicked} clicked any link</span><span>{stats.bounced} bounced</span><span>{stats.failed} failed</span><span>{stats.complained} spam complaints</span><span>{stats.unsubscribed} unsubscribed</span>
        </div>
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">Conversions {hasGoal && <span className="ml-2 text-itc-green">{stats.converted} · {percent(stats.conversionRate)}</span>}</div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{!hasGoal ? 'Select a conversion goal in the composer before sending.' : `${percent(stats.clickToConversionRate)} of button clickers completed the goal.`}</p>
            </div>
            {report.eventIds.length > 0 && <button type="button" disabled={syncing || loading || !connectedEventIds.length} onClick={sync} className="flex items-center gap-2 rounded-full bg-itc-green px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
              {syncing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{syncing ? 'Syncing…' : 'Sync registrations'}
            </button>}
          </div>
          {hasGoal && <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">A completed goal within 30 days of a recorded button click counts once per recipient. The latest qualifying campaign click receives credit. {hasRegistrations ? 'Confirmed registrations include free RSVPs and paid tickets. Pending and cancelled registrations are excluded.' : 'Profile claims count only the first time a member claims their profile.'}</p>}
          {missingGomry && <p className="text-xs text-amber-700 dark:text-amber-300">Connect Gomry to sync its event registrations.</p>}
          {missingLuma && <p className="text-xs text-amber-700 dark:text-amber-300">Connect the event’s Luma calendar to sync its registrations. Luma requires a calendar API key and Luma Plus. <a href="https://luma.com/calendar/manage/api-keys" target="_blank" rel="noreferrer" className="underline">Luma calendar settings</a></p>}
          {hasRegistrations && !report.eventIds.length && <p className="text-xs text-slate-500 dark:text-slate-400">Registration tracking starts with a campaign sent using a Gomry or Luma event button link.</p>}
          {report.syncedAt && <p className="text-xs text-slate-400">Registrations last synced {date(report.syncedAt)}.</p>}
        </div>
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Rates use recipients with confirmed delivery. Opens are estimates, and automated email scanners can register opens or clicks. No recorded open does not mean unread. {stats.lastEventAt ? `Latest email activity: ${date(stats.lastEventAt)}.` : 'Waiting for email activity from Resend.'}</p>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Search campaign recipients" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search name or email" className={`${fieldClass} min-w-0 flex-1 basis-full sm:basis-0`} />
          <select aria-label="Filter campaign recipients" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); }} className={fieldClass}>
            <option value="all">All recipients</option><option value="openedAt">Recorded open</option><option value="ctaClickedAt">Clicked button</option><option value="convertedAt">Converted</option><option value="bouncedAt">Bounced</option><option value="unsubscribedAt">Unsubscribed</option>
          </select>
          <button type="button" onClick={exportCsv} disabled={!rows.length} className="flex items-center gap-2 px-2 text-xs font-semibold text-slate-500 disabled:opacity-50"><Download className="h-4 w-4" /> Export CSV</button>
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr>{['Recipient', 'Delivery', 'First open', 'First button click', 'Converted'].map((label) => <th key={label} className="whitespace-nowrap px-3 py-2 font-medium">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.slice(page * 25, (page + 1) * 25).map((r) => <tr key={r.profileId} className="text-slate-600 dark:text-slate-300">
                <td className="px-3 py-3"><div className="font-medium text-slate-900 dark:text-white">{r.name || r.email}</div>{r.name && <div className="mt-0.5 text-slate-500">{r.email}</div>}</td>
                <td className="whitespace-nowrap px-3 py-3">{!r.tracked ? 'Sent · no tracking' : r.bouncedAt ? 'Bounced' : r.failedAt ? 'Failed' : r.deliveredAt ? 'Delivered' : r.acceptedAt ? 'Accepted' : 'Pending'}</td>
                {['openedAt', 'ctaClickedAt', 'convertedAt'].map((key) => <td key={key} className="whitespace-nowrap px-3 py-3" title={r[key] ? new Date(r[key]).toISOString() : 'No event recorded'}>{date(r[key])}</td>)}
              </tr>)}
              {!rows.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">{report.recipients.length ? 'No recipients match this filter.' : 'Results will appear after the campaign is sent.'}</td></tr>}
            </tbody>
          </table>
        </div>
        {rows.length > 25 && <div className="flex items-center justify-between text-xs text-slate-500">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40">Previous</button>
          <span>Page {page + 1} of {Math.ceil(rows.length / 25)} · {rows.length} recipients</span>
          <button disabled={(page + 1) * 25 >= rows.length} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40">Next</button>
        </div>}
      </>}
    </section>
  );
}
