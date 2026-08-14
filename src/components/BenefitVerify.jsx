import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldX,
  Loader2,
  Search,
  AlertCircle,
  Check,
  ExternalLink,
  Hash,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { fadeRise } from '../lib/motion';

const API_URL = import.meta.env.VITE_API_URL || '';

// Why a code came back unusable, in the partner's language.
const REASONS = {
  'not-found': 'No Italian Tech Club benefit code matches that.',
  revoked: 'This code was revoked by Italian Tech Club.',
  redeemed: 'This one-time code has already been used.',
  'member-inactive': 'The holder is no longer an active Italian Tech Club member.',
  'benefit-inactive': 'This benefit has been retired.',
};

const Row = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0 dark:border-slate-800">
    <span className="flex-shrink-0 text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
      {label}
    </span>
    <span className="min-w-0 text-right text-sm font-medium text-slate-900 dark:text-white">{children}</span>
  </div>
);

const BenefitVerify = () => {
  const [searchParams] = useSearchParams();
  // Partner staff get a link with the key baked in (?k=), so the redeem form is
  // ready to use without anyone typing a secret.
  const partnerKey = searchParams.get('k') || '';

  const [code, setCode] = useState(searchParams.get('code') || '');
  // Typed in only when the partner opened /verify without their key link.
  const [typedKey, setTypedKey] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemed, setRedeemed] = useState('');

  const verify = useCallback(async (value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    setRedeemed('');
    try {
      const response = await fetch(`${API_URL}/api/partners/verify?code=${encodeURIComponent(trimmed)}`);
      const payload = await response.json();
      // A 404 is a real answer here ("no such code"), not a failure to answer.
      if (!payload.success && !payload.reason) {
        throw new Error(payload.message || 'Something went wrong.');
      }
      setResult(payload);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // Auto-check when the member shares a full link rather than a bare code.
  useEffect(() => {
    const initial = searchParams.get('code');
    if (initial) verify(initial);
    // Runs once — later checks come from the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markRedeemed = async () => {
    if (redeeming) return;
    setRedeeming(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/partners/verify?code=${encodeURIComponent(code.trim())}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: partnerKey || typedKey, note }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || 'Something went wrong.');
      setRedeemed(payload.message);
      setResult((prev) => (prev ? { ...prev, valid: false, reason: 'redeemed', canMarkRedeemed: false } : prev));
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setRedeeming(false);
    }
  };

  const valid = result?.valid;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-16 transition-colors duration-300 dark:bg-slate-950">
      <div className="absolute right-6 top-6">
        <ThemeToggle className="shadow-sm" />
      </div>

      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-5 w-8 overflow-hidden rounded-sm ring-1 ring-inset ring-slate-900/10 dark:ring-white/10">
            <span className="w-1/3 bg-itc-green" />
            <span className="w-1/3 bg-white" />
            <span className="w-1/3 bg-itc-red" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Verify a member benefit code
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            For partner teams. Enter the code an Italian Tech Club member gave you to confirm their
            membership and the discount they are entitled to.
          </p>
        </div>

        {/* Code form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify(code);
          }}
          className="flex gap-2"
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ITC-TIH-XXXX-XXXX"
            autoFocus
            spellCheck={false}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 font-serial text-sm uppercase tracking-wider text-slate-900 outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:border-itc-green focus:ring-2 focus:ring-itc-green/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="flex flex-shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-medium text-white transition-colors hover:bg-itc-green disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-itc-green dark:hover:text-white"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Check
          </button>
        </form>

        {error && (
          <p className="mt-4 flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
          </p>
        )}

        {/* Result */}
        {result && (
          <motion.div
            variants={fadeRise}
            initial="hidden"
            animate="show"
            className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            <div
              className={`flex items-center gap-3 p-5 text-white ${
                valid ? 'bg-itc-green' : 'bg-slate-500 dark:bg-slate-700'
              }`}
            >
              {valid ? <ShieldCheck className="h-7 w-7 flex-shrink-0" /> : <ShieldX className="h-7 w-7 flex-shrink-0" />}
              <div className="min-w-0">
                <p className="font-bold leading-tight">
                  {valid ? 'Valid — active ITC member' : 'Not usable'}
                </p>
                <p className="mt-0.5 text-sm text-white/80">
                  {valid
                    ? `${result.benefit.discount} · ${result.benefit.title}`
                    : REASONS[result.reason] || 'This code is not currently valid.'}
                </p>
              </div>
            </div>

            {result.member && (
              <div className="p-5">
                <Row label="Member">{result.member.fullName}</Row>
                {result.member.memberNumber != null && (
                  <Row label="Member no.">
                    <span className="inline-flex items-center gap-1 font-serial">
                      <Hash className="h-3.5 w-3.5 text-slate-400" />
                      {result.member.memberNumber}
                    </span>
                  </Row>
                )}
                {result.member.memberSince && <Row label="Member since">{result.member.memberSince}</Row>}
                <Row label="Email on file">
                  <span className="font-serial text-xs">{result.member.maskedEmail}</span>
                </Row>
                <Row label="Benefit">
                  {result.benefit.title} · {result.benefit.oneTime ? 'one-time' : 'reusable'}
                </Row>
                <Row label="Code issued">{new Date(result.issuedAt).toLocaleDateString()}</Row>
                {result.redeemedAt && (
                  <Row label="Used on">{new Date(result.redeemedAt).toLocaleDateString()}</Row>
                )}
                {result.member.cardUrl && (
                  <a
                    href={result.member.cardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-itc-green hover:underline"
                  >
                    Open member card <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            )}

            {/* One-time codes get burned here, so the same discount can't be reused */}
            {result.canMarkRedeemed && (
              <div className="border-t border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/50">
                {redeemed ? (
                  <p className="flex items-center gap-2 text-sm font-medium text-itc-green">
                    <Check className="h-4 w-4 flex-shrink-0" /> {redeemed}
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      Applied the discount? Mark the code as used so it can't be redeemed twice.
                    </p>
                    {!partnerKey && (
                      <input
                        value={typedKey}
                        onChange={(e) => setTypedKey(e.target.value)}
                        type="password"
                        placeholder="Partner key"
                        className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-itc-green focus:ring-2 focus:ring-itc-green/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    )}
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={200}
                      placeholder="Optional note (order ref, who applied it)"
                      className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-itc-green focus:ring-2 focus:ring-itc-green/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                    <button
                      onClick={markRedeemed}
                      disabled={redeeming || (!partnerKey && !typedKey.trim())}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-itc-green disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-itc-green dark:hover:text-white"
                    >
                      {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Mark as redeemed
                    </button>
                  </>
                )}
              </div>
            )}

            {/* One-time, valid, but nobody handed this partner a key */}
            {valid && result.benefit.oneTime && !result.redeemConfigured && (
              <p className="border-t border-slate-100 p-5 text-xs leading-relaxed text-slate-400 dark:border-slate-800 dark:text-slate-500">
                Marking codes as used isn't set up yet. Email ciao@italiantechclubnyc.com once the
                discount is applied and we'll close it out.
              </p>
            )}
          </motion.div>
        )}

        <p className="mt-8 text-center text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          Questions about a code?{' '}
          <a href="mailto:ciao@italiantechclubnyc.com" className="font-medium text-itc-green hover:underline">
            ciao@italiantechclubnyc.com
          </a>
        </p>
      </div>
    </div>
  );
};

export default BenefitVerify;
