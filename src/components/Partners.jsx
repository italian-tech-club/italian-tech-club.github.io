import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Home, ArrowRight, Lock, Ticket } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import SectionEyebrow from './SectionEyebrow';
import PartnerCard from './PartnerCard';
import { listedPartners, perkPartners } from '../data/partners';
import { getCommunitySession } from '../lib/memberSession';
import { fadeRise, staggerContainer, VIEWPORT } from '../lib/motion';

// Only code-based perks need explaining; open access is just a link.
const HOW_CODES_WORK = [
  'Join the community',
  'Unlock your personal code',
  'The partner checks it against our roster',
];

const Partners = () => {
  const partners = listedPartners();
  const hasCodePerks = perkPartners().length > 0;
  // Local token only — no request. A stale one just means the perks page asks
  // them to sign in again, which is the right place for that conversation.
  const signedIn = !!getCommunitySession();

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 transition-colors duration-300 dark:bg-slate-950">
      {/* Top Controls */}
      <div className="absolute left-6 right-6 top-6 z-20 flex items-center justify-between">
        <Link
          to="/"
          className="rounded-full border border-slate-200 bg-white/80 p-3 text-slate-600 shadow-sm backdrop-blur-sm transition-all hover:text-itc-green hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:text-itc-green"
        >
          <Home className="h-5 w-5" />
        </Link>
        <ThemeToggle className="shadow-sm hover:shadow-md" />
      </div>

      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -left-40 -top-40 h-[40rem] w-[40rem] rounded-full bg-itc-green/8 blur-3xl dark:bg-itc-green/10" />
        <div className="absolute -right-40 top-1/3 h-[40rem] w-[40rem] rounded-full bg-itc-red/8 blur-3xl dark:bg-itc-red/10" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-24">
        {/* Header */}
        <motion.div variants={fadeRise} initial="hidden" animate="show" className="mb-12 text-center">
          <SectionEyebrow className="mb-5 justify-center">Partners</SectionEyebrow>
          <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl md:text-5xl">
            The people we
            <span className="bg-gradient-to-r from-itc-green to-itc-red bg-clip-text text-transparent"> build with</span>
          </h1>
          <p className="mx-auto max-w-2xl px-4 text-base text-slate-600 dark:text-slate-400 sm:text-lg">
            Organizations working alongside Italian Tech Club NYC — the perks, events and people they open
            up for our members.
          </p>
        </motion.div>

        {/* The wall. Centred wrap so it reads right at one partner and at twenty. */}
        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mb-16 flex flex-wrap justify-center gap-4"
        >
          {partners.map((partner) => (
            <PartnerCard key={partner.slug} partner={partner} />
          ))}
        </motion.div>

        {/* How code perks work — compact, since not every partner has codes */}
        {hasCodePerks && (
          <motion.div
            variants={fadeRise}
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT}
            className="flex flex-col gap-4 rounded-3xl bg-slate-900 p-6 text-white sm:p-8 md:flex-row md:items-center dark:bg-black"
          >
            <h2 className="flex shrink-0 items-center gap-2 font-bold">
              <Ticket className="h-5 w-5 text-itc-green" /> How perk codes work
            </h2>
            <ol className="flex flex-1 flex-col gap-3 md:flex-row md:justify-end md:gap-6">
              {HOW_CODES_WORK.map((step, index) => (
                <li key={step} className="flex items-center gap-2.5 text-sm text-slate-300 md:whitespace-nowrap">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-itc-green text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </motion.div>
        )}

        {/* Join CTA — the whole point of this page for a visitor */}
        <motion.div
          variants={fadeRise}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mt-10 rounded-3xl border border-slate-100 bg-gradient-to-r from-itc-green/10 via-white to-itc-red/10 p-6 text-center dark:border-slate-800 dark:via-slate-900 sm:p-10"
        >
          <Lock className="mx-auto mb-3 h-8 w-8 text-itc-green" />
          <h2 className="mb-3 text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
            Membership opens every door
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-slate-600 dark:text-slate-400 sm:text-base">
            {signedIn
              ? 'You are signed in — your perk codes are waiting in the community area.'
              : 'Already one of us? Sign in with your email — no password needed. New here? Apply to join and every partner perk comes with it.'}
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            {signedIn ? (
              <Link
                to="/community/perks"
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:-translate-y-1 hover:bg-itc-green hover:shadow-xl dark:bg-white dark:text-slate-900 dark:hover:bg-itc-green dark:hover:text-white sm:px-8 sm:py-4"
              >
                See my perk codes <ArrowRight className="h-5 w-5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/community/join"
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:-translate-y-1 hover:bg-itc-green hover:shadow-xl dark:bg-white dark:text-slate-900 dark:hover:bg-itc-green dark:hover:text-white sm:px-8 sm:py-4"
                >
                  Apply to Join <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  to="/community/manage"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-700 transition-all hover:border-itc-green hover:text-itc-green dark:border-slate-700 dark:text-slate-200 sm:px-8 sm:py-4"
                >
                  Member Sign In
                </Link>
              </>
            )}
          </div>
        </motion.div>

        <p className="mt-10 text-center text-xs text-slate-400 dark:text-slate-500">
          Want to partner with the club?{' '}
          <a href="mailto:ciao@italiantechclubnyc.com" className="font-medium text-itc-green hover:underline">
            ciao@italiantechclubnyc.com
          </a>
        </p>
      </div>
    </div>
  );
};

export default Partners;
