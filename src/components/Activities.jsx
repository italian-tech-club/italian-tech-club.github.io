import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Users2, TrendingUp } from 'lucide-react';
import { fadeRise, staggerContainer, hoverSpring, VIEWPORT } from '../lib/motion';
import SectionEyebrow from './SectionEyebrow';

const ActivityCard = ({ icon: Icon, title, description, accentClass, iconClass }) => (
  <motion.div
    variants={fadeRise}
    whileHover={{ y: -5, transition: hoverSpring }}
    className="relative group rounded-3xl p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:shadow-2xl hover:shadow-slate-900/10 dark:hover:shadow-black/40 transition-[border-color,box-shadow] duration-300 ease-out-quint overflow-hidden"
  >
    {/* Accent line that slides in on hover */}
    <div className={`absolute top-0 left-0 right-0 h-1 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out-quint ${accentClass}`} />
    <div className="relative z-10">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300 ease-out-quint ${iconClass}`}>
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{title}</h3>
      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
        {description}
      </p>
    </div>
  </motion.div>
);

const Activities = () => {
  return (
    <section id="what-we-do" className="py-24 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={fadeRise}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <SectionEyebrow className="mb-4">Our three pillars</SectionEyebrow>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">What We Do</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            We foster a vibrant ecosystem through three key pillars designed to support your professional journey.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="grid md:grid-cols-3 gap-8"
        >
          <ActivityCard
            icon={MessageCircle}
            title="Connect"
            description="Discover other professionals who live abroad and connect with them through our exclusive digital community in an informal setting."
            accentClass="bg-itc-green"
            iconClass="bg-itc-green/10 text-itc-green"
          />
          <ActivityCard
            icon={Users2}
            title="Meet"
            description="Bond with fellow professionals in our networking events. We organize monthly dining events and meetups in the heart of NYC."
            accentClass="bg-slate-900 dark:bg-white"
            iconClass="bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white"
          />
          <ActivityCard
            icon={TrendingUp}
            title="Grow"
            description="Unlock a wealth of knowledge and connections. We foster the community through mentoring activities and shared opportunities."
            accentClass="bg-itc-red"
            iconClass="bg-itc-red/10 text-itc-red"
          />
        </motion.div>
      </div>
    </section>
  );
};

export default Activities;
