import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Mail, Globe, Calendar, Inbox, Reply,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

const TYPE_LABELS = {
  event: 'Sponsor an event',
  venue: 'Provide a venue',
  'food-drinks': 'Food & drinks',
  prizes: 'Prizes / swag',
  recurring: 'Recurring partnership',
  other: 'Other',
};

const STATUS_CONFIG = {
  new: { label: 'New', classes: 'bg-itc-green text-white' },
  contacted: { label: 'Contacted', classes: 'bg-amber-500 text-white' },
  closed: { label: 'Closed', classes: 'bg-slate-400 dark:bg-slate-600 text-white' },
};

const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
});

const replyHref = (inquiry) => {
  const subject = encodeURIComponent(`Re: Sponsorship inquiry — Italian Tech Club NYC`);
  const body = encodeURIComponent(`Ciao ${inquiry.contactName},\n\nThanks for reaching out about partnering with the Italian Tech Club NYC!\n\n`);
  return `mailto:${inquiry.email}?subject=${subject}&body=${body}`;
};

const AdminInquiries = ({ authHeaders, onUnauthorized }) => {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch(`${API_URL}/api/sponsor/inquiries`, { headers: authHeaders() });
      if (response.status === 401) return onUnauthorized();
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      setInquiries(data.inquiries);
    } catch {
      setLoadError('Could not load inquiries from the server.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, onUnauthorized]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  const setStatus = async (inquiry, status) => {
    if (inquiry.status === status) return;
    setUpdatingId(inquiry._id);
    try {
      const response = await fetch(`${API_URL}/api/sponsor/inquiries?id=${inquiry._id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      if (response.status === 401) return onUnauthorized();
      const data = await response.json();
      if (data.success) {
        setInquiries(prev => prev.map(i => (i._id === inquiry._id ? { ...i, status } : i)));
      }
    } catch {
      // leave status unchanged on failure
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = filter === 'all' ? inquiries : inquiries.filter(i => i.status === filter);
  const countByStatus = (s) => inquiries.filter(i => i.status === s).length;

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
        <button onClick={fetchInquiries} className="px-5 py-2 rounded-full text-sm font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            filter === 'all' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          All ({inquiries.length})
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === key ? config.classes : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {config.label} ({countByStatus(key)})
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-slate-500 dark:text-slate-400">
          <Inbox className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          {inquiries.length === 0 ? 'No sponsorship inquiries yet.' : 'No inquiries with this status.'}
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((inquiry) => {
          const statusConfig = STATUS_CONFIG[inquiry.status] || STATUS_CONFIG.new;
          return (
            <div
              key={inquiry._id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white">{inquiry.companyName}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusConfig.classes}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span>{inquiry.contactName}</span>
                    <a href={`mailto:${inquiry.email}`} className="flex items-center gap-1 hover:text-itc-green">
                      <Mail className="w-3 h-3" /> {inquiry.email}
                    </a>
                    {inquiry.website && (
                      <a href={inquiry.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-itc-green">
                        <Globe className="w-3 h-3" /> {inquiry.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {formatDate(inquiry.createdAt)}
                    </span>
                  </div>
                </div>
                <a
                  href={replyHref(inquiry)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-colors flex-shrink-0"
                >
                  <Reply className="w-4 h-4" /> Reply
                </a>
              </div>

              {inquiry.sponsorshipTypes?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {inquiry.sponsorshipTypes.map((type) => (
                    <span key={type} className="px-2.5 py-0.5 rounded-full text-xs bg-itc-green/10 text-itc-green font-medium">
                      {TYPE_LABELS[type] || type}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap mb-4">{inquiry.message}</p>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-400 mr-1">Mark as:</span>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setStatus(inquiry, key)}
                    disabled={updatingId === inquiry._id}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
                      inquiry.status === key
                        ? config.classes
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {config.label}
                  </button>
                ))}
                {updatingId === inquiry._id && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminInquiries;
