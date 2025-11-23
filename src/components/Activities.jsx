import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Users2, TrendingUp } from 'lucide-react';

const ActivityCard = ({ icon: Icon, title, description, colorClass, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6, delay }}
    className="relative group rounded-3xl p-8 bg-white border border-slate-200 hover:border-transparent hover:shadow-2xl transition-all duration-300"
  >
    <div className={`absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-5 transition-opacity duration-300 ${colorClass}`} />
    <div className="relative z-10">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${colorClass} bg-opacity-10 text-slate-900`}>
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-2xl font-bold text-slate-900 mb-4">{title}</h3>
      <p className="text-slate-600 leading-relaxed">
        {description}
      </p>
    </div>
  </motion.div>
);

const Activities = () => {
  return (
    <section id="what-we-do" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">What We Do</h2>
          <p className="text-lg text-slate-600">
            We foster a vibrant ecosystem through three key pillars designed to support your professional journey.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <ActivityCard
            icon={MessageCircle}
            title="Connect"
            description="Discover other professionals who live abroad and connect with them through our exclusive digital community in an informal setting."
            colorClass="bg-itc-green"
            delay={0.1}
          />
          <ActivityCard
            icon={Users2}
            title="Meet"
            description="Bond with fellow professionals in our networking events. We organize monthly dining events and meetups in the heart of NYC."
            colorClass="bg-slate-900"
            delay={0.2}
          />
          <ActivityCard
            icon={TrendingUp}
            title="Grow"
            description="Unlock a wealth of knowledge and connections. We foster the community through mentoring activities and shared opportunities."
            colorClass="bg-itc-red"
            delay={0.3}
          />
        </div>
      </div>
    </section>
  );
};

export default Activities;

