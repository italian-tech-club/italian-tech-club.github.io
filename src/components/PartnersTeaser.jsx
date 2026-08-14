import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Handshake } from 'lucide-react';
import SectionEyebrow from './SectionEyebrow';
import PartnerLogo from './PartnerLogo';
import { listedPartners, activeBenefits } from '../data/partners';
import { fadeRise, staggerContainer, VIEWPORT } from '../lib/motion';

const PartnersTeaser = () => {
  const partners = listedPartners();
  if (!partners.length) return null;

  // Flat list of live perks across every partner, for the highlight strip.
  const perks = partners.flatMap((partner) =>
    activeBenefits(partner).map((benefit) => ({ ...benefit, partner })),
  );

  return (
    <section id="partners" className="py-24 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={fadeRise}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mb-14 text-center"
        >
          <SectionEyebrow className="mb-5 justify-center">Partners</SectionEyebrow>
          <h2 className="mb-4 text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">
            Who we build with
          </h2>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            We team up with organizations that hold something real open for our community — and every
            member gets a personal code to claim it.
          </p>
        </motion.div>

        <div className="grid items-center gap-10 lg:grid-cols-2">
          {/* Partner logos */}
          <motion.div
            variants={staggerContainer(0.1)}
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1"
          >
            {partners.map((partner) => (
              <motion.div key={partner.slug} variants={fadeRise}>
                <Link
                  to={`/partners/${partner.slug}`}
                  className="group block transition-transform duration-300 ease-out-quint hover:-translate-y-1"
                >
                  <PartnerLogo partner={partner} className="rounded-3xl py-12" imageClassName="max-h-14" />
                  <p className="mt-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                    {partner.location}
                  </p>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          {/* Perks on offer */}
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-itc-green/10 px-4 py-1.5 text-sm font-medium text-itc-green">
              <Handshake className="h-4 w-4" />
              Member perks
            </div>
            <motion.ul
              variants={staggerContainer(0.1, 0.1)}
              initial="hidden"
              whileInView="show"
              viewport={VIEWPORT}
              className="mb-8 space-y-3"
            >
              {perks.map((perk) => (
                <motion.li
                  key={perk.id}
                  variants={fadeRise}
                  className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <span className="inline-block rounded-full bg-itc-green px-3 py-1 text-sm font-bold text-white">
                    {perk.discount}
                  </span>
                  <span className="mt-2.5 block font-semibold text-slate-900 dark:text-white">
                    {perk.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">
                    {perk.partner.shortName} · {perk.eligibility.toLowerCase()}
                  </span>
                </motion.li>
              ))}
            </motion.ul>
            <Link
              to="/partners"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-8 py-4 font-semibold text-white shadow-lg transition-all duration-300 ease-out-quint hover:-translate-y-1 hover:bg-itc-green hover:shadow-xl dark:bg-white dark:text-slate-900 dark:hover:bg-itc-green dark:hover:text-white"
            >
              Meet our partners <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PartnersTeaser;
