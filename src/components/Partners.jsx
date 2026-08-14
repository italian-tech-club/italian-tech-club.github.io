import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Home, ArrowRight, ArrowUpRight, Lock, Ticket, MapPin } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import SectionEyebrow from './SectionEyebrow';
import PartnerLogo from './PartnerLogo';
import { listedPartners, activeBenefits } from '../data/partners';
import { getCommunitySession } from '../lib/memberSession';
import { fadeRise, staggerContainer, VIEWPORT } from '../lib/motion';

const HOW_IT_WORKS = [
  {
    title: 'Join the community',
    body: 'Perks ride along with ITC membership. One application, and every partner offer opens up.',
  },
  {
    title: 'Unlock your code',
    body: 'One code per perk, tied to your member profile. It never changes, so you only do this once.',
  },
  {
    title: 'The partner checks it',
    body: 'They look the code up and see you are a current ITC member. That is the whole handshake.',
  },
];

// A partner in the wall. Uniform tile regardless of how many perks they carry —
// the wall has to read as a set, not a ranking.
const PartnerCard = ({ partner }) => {
  const perkCount = activeBenefits(partner).length;

  return (
    <motion.div
      variants={fadeRise}
      className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.75rem)]"
    >
      <Link
        to={`/partners/${partner.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white transition-[border-color,box-shadow,transform] duration-300 ease-out-quint hover:-translate-y-1 hover:border-itc-green/50 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
      >
        <PartnerLogo partner={partner} className="rounded-none py-8" imageClassName="max-h-11" />
        <div className="flex flex-1 flex-col p-5">
          <h2 className="font-bold leading-tight text-slate-900 dark:text-white">{partner.name}</h2>
          {partner.location && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <MapPin className="h-3.5 w-3.5" /> {partner.location}
            </p>
          )}
          <div className="mt-4 flex items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-itc-green">
              <Ticket className="h-3.5 w-3.5" />
              {perkCount} member perk{perkCount === 1 ? '' : 's'}
            </span>
            <ArrowUpRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-itc-green dark:text-slate-600" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

const Partners = () => {
  const partners = listedPartners();
  const perkCount = partners.reduce((total, partner) => total + activeBenefits(partner).length, 0);
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
            Organizations working alongside Italian Tech Club NYC — and the {perkCount} perk
            {perkCount === 1 ? '' : 's'} they hold open for our members.
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

        {/* How perks work */}
        <motion.div
          variants={fadeRise}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="rounded-3xl bg-slate-900 p-6 text-white sm:p-10 dark:bg-black"
        >
          <h2 className="text-xl font-bold sm:text-2xl">How member perks work</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step, index) => (
              <div key={step.title}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-itc-green text-sm font-bold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-3 font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{step.body}</p>
              </div>
            ))}
          </div>
        </motion.div>

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
            Perks come with membership
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-slate-600 dark:text-slate-400 sm:text-base">
            {signedIn
              ? 'You are signed in — your codes are waiting in the community area.'
              : 'Already one of us? Sign in with your email — no password needed. New here? Apply to join and the codes come with it.'}
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
          Want to offer a benefit to the club?{' '}
          <a href="mailto:ciao@italiantechclubnyc.com" className="font-medium text-itc-green hover:underline">
            ciao@italiantechclubnyc.com
          </a>
        </p>
      </div>
    </div>
  );
};

export default Partners;
