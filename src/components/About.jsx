import React from 'react';
import { motion } from 'framer-motion';
import { Globe2, Building2, Briefcase } from 'lucide-react';
import { fadeRise, staggerContainer, hoverSpring, VIEWPORT } from '../lib/motion';
import SectionEyebrow from './SectionEyebrow';

const Feature = ({ icon: Icon, title, description }) => (
  <motion.div
    variants={fadeRise}
    whileHover={{ y: -4, transition: hoverSpring }}
    className="group p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-xl transition-[background-color,border-color,box-shadow] duration-300 ease-out-quint"
  >
    <div className="w-12 h-12 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center mb-4 text-white dark:text-slate-900 group-hover:bg-itc-green dark:group-hover:bg-itc-green group-hover:text-white dark:group-hover:text-white group-hover:scale-105 transition-all duration-300 ease-out-quint">
      <Icon className="w-6 h-6" />
    </div>
    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
  </motion.div>
);

const About = () => {
  return (
    <section id="who-we-are" className="py-24 bg-white dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            variants={fadeRise}
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT}
          >
            <SectionEyebrow className="mb-4">Who we are</SectionEyebrow>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6">
              The Home of Italian Innovation in <span className="text-itc-green">NYC</span>
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              We are the community of top-notch Italian professionals operating and living in New York.
              Whether you're a startup founder, an investor, an executive, or a professional working in tech,
              this community is the perfect place to expand your network in an informal setting.
            </p>
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
              Our mission is to support the Italian innovation ecosystem abroad by generating connections
              with world-class people in the most competitive market in the world.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer(0.1)}
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT}
            className="grid sm:grid-cols-2 gap-6"
          >
            <Feature
              icon={Globe2}
              title="Global Network"
              description="Part of an international network of clubs connecting Italian talent worldwide."
            />
            <Feature
              icon={Building2}
              title="NYC Focus"
              description="Deeply rooted in the NYC tech ecosystem, bridging Italy and the US."
            />
            <Feature
              icon={Briefcase}
              title="Professional Growth"
              description="A hub for mentorship, career opportunities, and business partnerships."
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default About;
