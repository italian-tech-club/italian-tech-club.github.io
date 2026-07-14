import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Loader2,
  AlertCircle,
  Check,
  X,
  Home,
  Briefcase,
  Star,
  ArrowRight,
  Handshake,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { roleLabel } from '../lib/communityOptions';

const API_URL = import.meta.env.VITE_API_URL || '';

const cardClasses = 'w-full max-w-md mx-auto p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl';

// Accept/decline a connect request (arrived via the emailed decision link).
// Accepting triggers a two-way email intro; declining is silent.
const CommunityConnect = () => {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const token = params.get('token');

  const [state, setState] = useState(token ? 'loading' : 'invalid'); // loading | ready | deciding | accepted | declined | invalid
  const [request, setRequest] = useState(null);
  const [error, setError] = useState('');

  // Keep the token out of the URL bar (held in state for the API calls)
  useEffect(() => {
    if (token) window.history.replaceState({}, '', window.location.pathname);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const response = await fetch(`${API_URL}/api/community/connect?token=${encodeURIComponent(token)}`);
        const data = await response.json();
        if (response.ok && data.success) {
          setRequest(data.request);
          setState('ready');
        } else {
          setError(data.message || 'This link is invalid, expired, or already used.');
          setState('invalid');
        }
      } catch {
        setError('Could not reach the server. Please try again.');
        setState('invalid');
      }
    };
    load();
  }, [token]);

  const decide = async (decision) => {
    if (state === 'deciding') return;
    setState('deciding');
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/community/connect?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Something went wrong.');
      setState(decision === 'accept' ? 'accepted' : 'declined');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setState('ready');
    }
  };

  const from = request?.from;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-20">
        <Link
          to="/"
          className="p-3 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-itc-green dark:hover:text-itc-green transition-all shadow-sm hover:shadow-md"
        >
          <Home className="w-5 h-5" />
        </Link>
        <ThemeToggle className="shadow-sm hover:shadow-md" />
      </div>

      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[40rem] h-[40rem] bg-itc-green/8 dark:bg-itc-green/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[40rem] h-[40rem] bg-itc-red/8 dark:bg-itc-red/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-28 pb-16 flex flex-col justify-center min-h-screen">
        {state === 'loading' && (
          <div className="flex items-center justify-center gap-3 text-slate-500 dark:text-slate-400 py-20">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading the request...
          </div>
        )}

        {state === 'invalid' && (
          <div className={`${cardClasses} text-center`}>
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400 mb-6">{error || 'This link is invalid, expired, or already used.'}</p>
            <Link
              to="/community"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-colors"
            >
              Back to Community <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {(state === 'ready' || state === 'deciding') && from && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={cardClasses}>
            <div className="w-12 h-12 rounded-full bg-itc-green/10 flex items-center justify-center mx-auto mb-6">
              <Handshake className="w-5 h-5 text-itc-green" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-6">Connect request</h1>

            <div className="flex items-center gap-4 mb-4">
              {from.profilePic ? (
                <img src={from.profilePic} alt={from.firstName} className="w-16 h-16 rounded-2xl object-cover border-2 border-itc-green/20" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-itc-green to-emerald-700 flex items-center justify-center text-white text-xl font-bold">
                  {`${from.firstName?.[0] || ''}${from.lastName?.[0] || ''}`}
                </div>
              )}
              <div>
                <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  {from.firstName} {from.lastName}
                  {from.isFounder && <Star className="w-3.5 h-3.5 text-itc-green fill-current" />}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" />
                  {from.profession}{from.company ? ` · ${from.company}` : ''}
                </p>
                {from.roles?.length > 0 && (
                  <p className="text-xs text-slate-400 mt-0.5">{from.roles.map(roleLabel).join(' · ')}</p>
                )}
              </div>
            </div>

            {request.message && (
              <blockquote className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 italic mb-4">
                “{request.message}”
              </blockquote>
            )}

            <p className="text-xs text-slate-400 mb-6">
              Accept and we'll introduce you both by email. Decline and they won't be notified.
            </p>

            {error && (
              <p className="flex items-center gap-2 text-sm text-red-500 mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => decide('accept')}
                disabled={state === 'deciding'}
                className="flex-1 py-3 rounded-xl bg-itc-green text-white font-bold hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {state === 'deciding' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Accept
              </button>
              <button
                onClick={() => decide('decline')}
                disabled={state === 'deciding'}
                className="flex-1 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:border-itc-red hover:text-itc-red transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Decline
              </button>
            </div>
          </motion.div>
        )}

        {(state === 'accepted' || state === 'declined') && (
          <div className={`${cardClasses} text-center`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${state === 'accepted' ? 'bg-itc-green/10 dark:bg-itc-green/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
              {state === 'accepted' ? <Check className="w-8 h-8 text-itc-green" /> : <X className="w-8 h-8 text-slate-400" />}
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {state === 'accepted' ? 'You\'re connected! 🎉' : 'Request declined'}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
              {state === 'accepted'
                ? 'Check your inbox — we\'ve sent you both an intro email with each other\'s contact.'
                : 'No worries — they won\'t be notified.'}
            </p>
            <Link
              to="/community"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-colors"
            >
              Back to Community <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunityConnect;
