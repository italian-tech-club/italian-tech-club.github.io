import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Handshake, ArrowRight, Check } from 'lucide-react';
import { fadeRise, staggerContainer, VIEWPORT } from '../lib/motion';

const PERKS = [
  'Brand visibility with 500+ Italian tech professionals in NYC',
  'Speaking opportunities at our events',
  'Direct access to founders, engineers, and operators',
];

const Sponsor = () => {
  return (
    <section id="sponsor" className="py-24 bg-white dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={fadeRise}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="grid lg:grid-cols-2 gap-10 items-center bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-8 sm:p-14 border border-slate-200 dark:border-slate-800 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-itc-green/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-itc-green/10 text-itc-green text-sm font-medium mb-6">
              <Handshake className="w-4 h-4" />
              Partner with us
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Sponsor an ITC Event
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
              Put your company in front of the Italian tech community in New York — from aperitivo networking nights to tech talks and demo days.
            </p>
          </div>

          <div className="relative">
            <motion.ul
              variants={staggerContainer(0.1, 0.15)}
              initial="hidden"
              whileInView="show"
              viewport={VIEWPORT}
              className="space-y-4 mb-8"
            >
              {PERKS.map((perk) => (
                <motion.li key={perk} variants={fadeRise} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-itc-green/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 text-itc-green" />
                  </div>
                  <span className="text-slate-700 dark:text-slate-300">{perk}</span>
                </motion.li>
              ))}
            </motion.ul>
            <Link
              to="/sponsor"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-all duration-300 ease-out-quint shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              Become a Sponsor <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Sponsor;
