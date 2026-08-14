import React from 'react';
import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Handshake,
  MapPin,
  Repeat,
  Ticket,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import NotFound from './NotFound';
import PartnerLogo from './PartnerLogo';
import { findPartner, activeBenefits } from '../data/partners';
import { getCommunitySession } from '../lib/memberSession';
import { fadeRise, staggerContainer, VIEWPORT } from '../lib/motion';

// A partner's own page — shareable, so we can send a partner the URL of the page
// about them. Describes the perks; the codes themselves live behind the member
// wall at /community/perks.
const PartnerDetail = () => {
  const { slug } = useParams();
  const partner = findPartner(slug);
  const signedIn = !!getCommunitySession();

  if (!partner) return <NotFound />;

  const benefits = activeBenefits(partner);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 transition-colors duration-300 dark:bg-slate-950">
      {/* Top Controls */}
      <div className="absolute left-6 right-6 top-6 z-20 flex items-center justify-between">
        <Link
          to="/partners"
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 py-3 pl-3 pr-5 text-sm font-medium text-slate-600 shadow-sm backdrop-blur-sm transition-all hover:text-itc-green hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:text-itc-green"
        >
          <ArrowLeft className="h-4 w-4" /> All partners
        </Link>
        <ThemeToggle className="shadow-sm hover:shadow-md" />
      </div>

      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -left-40 -top-40 h-[40rem] w-[40rem] rounded-full bg-itc-green/8 blur-3xl dark:bg-itc-green/10" />
        <div className="absolute -right-40 top-1/3 h-[40rem] w-[40rem] rounded-full bg-itc-red/8 blur-3xl dark:bg-itc-red/10" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-28">
        {/* Identity */}
        <motion.div variants={fadeRise} initial="hidden" animate="show" className="text-center">
          <PartnerLogo partner={partner} className="mx-auto w-full max-w-sm py-10" imageClassName="max-h-16" />
          <h1 className="mt-8 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            {partner.name}
          </h1>
          {partner.tagline && (
            <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">{partner.tagline}</p>
          )}
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
            {partner.blurb}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            {partner.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {partner.location}
              </span>
            )}
            {partner.partnerSince && (
              <span className="flex items-center gap-1.5">
                <Handshake className="h-3.5 w-3.5" /> ITC partner since {partner.partnerSince}
              </span>
            )}
            <a
              href={partner.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 font-medium text-itc-green hover:underline"
            >
              Visit site <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </motion.div>

        {/* What they hold open for members */}
        <h2 className="mb-4 mt-14 text-lg font-bold text-slate-900 dark:text-white">
          What {partner.shortName} offers ITC members
        </h2>
        <motion.div
          variants={staggerContainer(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="space-y-4"
        >
          {benefits.map((benefit) => (
            <motion.div
              key={benefit.id}
              variants={fadeRise}
              className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-itc-green px-3 py-1 text-sm font-bold text-white">
                  {benefit.discount}
                </span>
                <h3 className="text-lg font-bold leading-tight text-slate-900 dark:text-white">
                  {benefit.title}
                </h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {benefit.details}
              </p>
              <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                {benefit.oneTime ? <Ticket className="h-3.5 w-3.5" /> : <Repeat className="h-3.5 w-3.5" />}
                {benefit.eligibility}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Route to the codes */}
        <motion.div
          variants={fadeRise}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mt-10 rounded-3xl bg-slate-900 p-6 text-center text-white sm:p-8 dark:bg-black"
        >
          <p className="mx-auto max-w-md text-sm leading-relaxed text-slate-300">
            {signedIn
              ? `Your personal ${partner.shortName} codes are in the community area — send one over when you sign up and they'll confirm you're a current ITC member.`
              : `These are ITC member perks. Join the community and you get a personal code for each one — ${partner.shortName} checks it against our roster.`}
          </p>
          <Link
            to={signedIn ? '/community/perks' : '/community/join'}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-semibold text-slate-900 transition-all hover:-translate-y-1 hover:bg-itc-green hover:text-white"
          >
            {signedIn ? 'See my perk codes' : 'Apply to Join'} <ArrowRight className="h-5 w-5" />
          </Link>
          {!signedIn && (
            <p className="mt-4 text-xs text-slate-400">
              Already a member?{' '}
              <Link to="/community/manage" className="font-medium text-white hover:underline">
                Sign in
              </Link>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default PartnerDetail;
