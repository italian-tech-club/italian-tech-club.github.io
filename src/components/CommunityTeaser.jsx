import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Users, ArrowRight, UserPlus } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

const GRADIENTS = [
  'from-itc-green to-emerald-700',
  'from-itc-red to-rose-700',
  'from-blue-500 to-indigo-700',
  'from-amber-500 to-orange-700',
  'from-purple-500 to-fuchsia-700',
];

const CommunityTeaser = () => {
  const [founders, setFounders] = useState([]);

  useEffect(() => {
    const fetchFounders = async () => {
      try {
        const response = await fetch(`${API_URL}/api/community/profiles`);
        const data = await response.json();
        if (data.success) {
          // The endpoint is gated: members get `profiles`, visitors get an
          // anonymized `teaser` where only founders carry full identity.
          const list = data.memberView ? data.profiles : (data.teaser || []);
          setFounders(
            list
              .filter((p) => p.isFounder)
              .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
          );
        }
      } catch (err) {
        // Decorative avatar stack — the "+you" bubble still renders on its own
        console.error('Failed to load founder profiles:', err);
      }
    };
    fetchFounders();
  }, []);

  return (
    <section id="community" className="py-24 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-3xl bg-slate-900 dark:bg-black text-white p-8 sm:p-14 text-center"
        >
          {/* Background accents */}
          <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-itc-green/15 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-itc-red/15 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-white/10 text-white text-sm font-medium mb-6 border border-white/10">
              <Users className="w-4 h-4 text-itc-green" />
              New
            </div>

            <h2 className="text-3xl md:text-4xl font-bold mb-4">Meet the Community</h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-8">
              Browse member profiles, see who's building what, and connect on LinkedIn.
              Founders, investors, engineers, and tech enthusiasts — all in one place.
            </p>

            {/* Founder avatars */}
            <div className="flex justify-center mb-8">
              <div className="flex -space-x-3">
                {founders.map((founder, index) => (
                  <div
                    key={founder._id || `${founder.firstName}-${index}`}
                    className={`w-12 h-12 rounded-full bg-gradient-to-br ${GRADIENTS[index % GRADIENTS.length]} border-2 border-slate-900 dark:border-black flex items-center justify-center text-sm font-bold overflow-hidden`}
                    title={`${founder.firstName} ${founder.lastName}`}
                  >
                    {founder.profilePic ? (
                      <img src={founder.profilePic} alt={founder.firstName} className="w-full h-full object-cover" />
                    ) : (
                      `${founder.firstName[0]}${founder.lastName[0]}`
                    )}
                  </div>
                ))}
                <div className="w-12 h-12 rounded-full bg-white/10 border-2 border-slate-900 dark:border-black flex items-center justify-center text-sm font-medium">
                  +you
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/community"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-slate-900 font-semibold hover:bg-itc-green hover:text-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                Browse Profiles <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/community/join"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 transition-all"
              >
                <UserPlus className="w-5 h-5" /> Create Your Profile
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CommunityTeaser;
