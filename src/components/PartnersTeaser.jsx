import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import SectionEyebrow from './SectionEyebrow';
import PartnerCard from './PartnerCard';
import { listedPartners } from '../data/partners';
import { fadeRise, staggerContainer, VIEWPORT } from '../lib/motion';

const PartnersTeaser = () => {
  const partners = listedPartners();
  if (!partners.length) return null;

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
            Organizations that hold something real open for our community — member perks, and doors into
            events, talks and people.
          </p>
        </motion.div>

        {/* Centred wrap so it reads right at two partners and at twelve. */}
        <motion.div
          variants={staggerContainer(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mx-auto mb-12 flex max-w-6xl flex-wrap justify-center gap-4"
        >
          {partners.map((partner) => (
            <PartnerCard key={partner.slug} partner={partner} />
          ))}
        </motion.div>

        <div className="text-center">
          <Link
            to="/partners"
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-8 py-4 font-semibold text-white shadow-lg transition-all duration-300 ease-out-quint hover:-translate-y-1 hover:bg-itc-green hover:shadow-xl dark:bg-white dark:text-slate-900 dark:hover:bg-itc-green dark:hover:text-white"
          >
            Meet our partners <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default PartnersTeaser;
