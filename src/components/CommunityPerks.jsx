import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  Repeat,
  ShieldCheck,
  Ticket,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import SectionEyebrow from './SectionEyebrow';
import PartnerLogo from './PartnerLogo';
import { perkPartners, activeBenefits } from '../data/partners';
import { getCommunitySession, memberAuthHeaders, clearMemberSession } from '../lib/memberSession';
import { fadeRise, staggerContainer, VIEWPORT } from '../lib/motion';

const API_URL = import.meta.env.VITE_API_URL || '';

const CodeBlock = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (http, permissions) — the code is on screen to type.
    }
  };

  return (
    <button
      onClick={copy}
      className="group flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-itc-green/40 bg-itc-green/5 px-4 py-3 text-left transition-colors hover:border-itc-green"
    >
      <span className="font-serial text-sm font-bold tracking-wider text-slate-900 dark:text-white sm:text-base">
        {code}
      </span>
      <span className="flex flex-shrink-0 items-center gap-1.5 text-xs font-semibold text-itc-green">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied' : 'Copy'}
      </span>
    </button>
  );
};

const PerkCard = ({ partner, benefit, claim, onClaim, claiming, error }) => (
  <motion.div
    variants={fadeRise}
    className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
  >
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <span className="rounded-full bg-itc-green/10 px-3 py-1 text-sm font-bold text-itc-green">
          {benefit.discount}
        </span>
        <h3 className="mt-3 text-lg font-bold leading-tight text-slate-900 dark:text-white">
          {benefit.title}
        </h3>
      </div>
      <span
        title={benefit.eligibility}
        className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400"
      >
        {benefit.oneTime ? <Ticket className="h-3.5 w-3.5" /> : <Repeat className="h-3.5 w-3.5" />}
        {benefit.oneTime ? 'One-time' : 'Reusable'}
      </span>
    </div>

    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{benefit.details}</p>
    <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{benefit.eligibility}</p>

    <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
      {claim ? (
        <>
          <CodeBlock code={claim.code} />
          {claim.status === 'redeemed' ? (
            <p className="mt-2.5 flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              Marked as used by {partner.shortName}
              {claim.redeemedAt ? ` on ${new Date(claim.redeemedAt).toLocaleDateString()}` : ''}.
            </p>
          ) : (
            <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-itc-green" />
              {benefit.howTo}
            </p>
          )}
        </>
      ) : (
        <>
          <button
            onClick={() => onClaim(benefit.id)}
            disabled={claiming}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-itc-green px-5 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
          >
            {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
            Unlock my code
          </button>
          <p className="mt-2.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
            {partner.shortName} will see your name, member number, and a masked version of your email
            when they check the code — nothing else.
          </p>
        </>
      )}

      {error && (
        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-red-500">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
        </p>
      )}
    </div>
  </motion.div>
);

const CommunityPerks = () => {
  // The catalog ships with the bundle, so the page paints before the API answers;
  // the request only decides whether codes are shown.
  const [memberView, setMemberView] = useState(null); // null = still checking
  const [claims, setClaims] = useState({});
  const [claiming, setClaiming] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const hadSession = !!getCommunitySession();
        const response = await fetch(`${API_URL}/api/partners/list`, { headers: memberAuthHeaders() });
        const payload = await response.json();
        if (!payload.success) {
          setMemberView(false);
          return;
        }
        // Session was revoked or expired server-side — drop the stale token.
        if (hadSession && !payload.memberView) clearMemberSession();
        setMemberView(!!payload.memberView);
        setClaims(Object.fromEntries((payload.claims || []).map((claim) => [claim.benefitId, claim])));
      } catch (err) {
        console.error('Failed to load partner benefits:', err);
        setMemberView(false);
      }
    };
    load();
  }, []);

  const handleClaim = async (benefitId) => {
    if (claiming) return;
    setClaiming(benefitId);
    setErrors((prev) => ({ ...prev, [benefitId]: '' }));
    try {
      const response = await fetch(`${API_URL}/api/partners/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...memberAuthHeaders() },
        body: JSON.stringify({ benefitId }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || 'Something went wrong.');
      setClaims((prev) => ({ ...prev, [benefitId]: payload.claim }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, [benefitId]: err.message || 'Something went wrong.' }));
    } finally {
      setClaiming(null);
    }
  };

  const partners = perkPartners();
  const perkCount = partners.reduce((total, partner) => total + activeBenefits(partner).length, 0);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 transition-colors duration-300 dark:bg-slate-950">
      {/* Top Controls */}
      <div className="absolute left-6 right-6 top-6 z-20 flex items-center justify-between">
        <Link
          to="/community"
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 py-3 pl-3 pr-5 text-sm font-medium text-slate-600 shadow-sm backdrop-blur-sm transition-all hover:text-itc-green hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:text-itc-green"
        >
          <ArrowLeft className="h-4 w-4" /> Community
        </Link>
        <ThemeToggle className="shadow-sm hover:shadow-md" />
      </div>

      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -left-40 -top-40 h-[40rem] w-[40rem] rounded-full bg-itc-green/8 blur-3xl dark:bg-itc-green/10" />
        <div className="absolute -right-40 top-1/3 h-[40rem] w-[40rem] rounded-full bg-itc-red/8 blur-3xl dark:bg-itc-red/10" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 pb-16 pt-28">
        {/* Header */}
        <motion.div variants={fadeRise} initial="hidden" animate="show" className="mb-12 text-center">
          <SectionEyebrow className="mb-5 justify-center">Member perks</SectionEyebrow>
          <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl md:text-5xl">
            Your
            <span className="bg-gradient-to-r from-itc-green to-itc-red bg-clip-text text-transparent"> perk codes</span>
          </h1>
          <p className="mx-auto max-w-2xl px-4 text-base text-slate-600 dark:text-slate-400 sm:text-lg">
            {perkCount} offer{perkCount === 1 ? '' : 's'} from our partners, reserved for members of the
            Italian Tech Club NYC community.
          </p>
        </motion.div>

        {memberView === false && (
          <motion.div
            variants={fadeRise}
            initial="hidden"
            animate="show"
            className="rounded-3xl border border-slate-100 bg-gradient-to-r from-itc-green/10 via-white to-itc-red/10 p-6 text-center dark:border-slate-800 dark:via-slate-900 sm:p-10"
          >
            <Lock className="mx-auto mb-3 h-8 w-8 text-itc-green" />
            <h2 className="mb-3 text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
              Sign in to unlock your codes
            </h2>
            <p className="mx-auto mb-6 max-w-md text-sm text-slate-600 dark:text-slate-400 sm:text-base">
              Codes are tied to your member profile. Sign in with your email — no password needed. Not a
              member yet? Apply to join and the perks come with it.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/community/manage"
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:-translate-y-1 hover:bg-itc-green hover:shadow-xl dark:bg-white dark:text-slate-900 dark:hover:bg-itc-green dark:hover:text-white sm:px-8 sm:py-4"
              >
                Member Sign In <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/community/join"
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-700 transition-all hover:border-itc-green hover:text-itc-green dark:border-slate-700 dark:text-slate-200 sm:px-8 sm:py-4"
              >
                Apply to Join
              </Link>
            </div>
            <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
              Curious what's on offer?{' '}
              <Link to="/partners" className="font-medium text-itc-green hover:underline">
                Browse our partners
              </Link>
            </p>
          </motion.div>
        )}

        {memberView && partners.map((partner) => (
          <section key={partner.slug} className="mb-12">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <PartnerLogo partner={partner} className="px-4 py-3" imageClassName="max-h-7" />
                <div>
                  <h2 className="font-bold leading-tight text-slate-900 dark:text-white">{partner.name}</h2>
                  <Link
                    to={`/partners/${partner.slug}`}
                    className="text-xs font-medium text-itc-green hover:underline"
                  >
                    About this partner
                  </Link>
                </div>
              </div>
              <a
                href={partner.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-itc-green dark:text-slate-400"
              >
                {partner.url.replace(/^https?:\/\//, '')} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <motion.div
              variants={staggerContainer(0.1)}
              initial="hidden"
              whileInView="show"
              viewport={VIEWPORT}
              className="grid gap-4 md:grid-cols-2"
            >
              {activeBenefits(partner).map((benefit) => (
                <PerkCard
                  key={benefit.id}
                  partner={partner}
                  benefit={benefit}
                  claim={claims[benefit.id]}
                  onClaim={handleClaim}
                  claiming={claiming === benefit.id}
                  error={errors[benefit.id]}
                />
              ))}
            </motion.div>
          </section>
        ))}

        <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
          A code not working?{' '}
          <a href="mailto:ciao@italiantechclubnyc.com" className="font-medium text-itc-green hover:underline">
            ciao@italiantechclubnyc.com
          </a>
        </p>
      </div>
    </div>
  );
};

export default CommunityPerks;
