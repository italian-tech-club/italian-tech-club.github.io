import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Linkedin,
  Search,
  Users,
  Loader2,
  ExternalLink,
  X,
  ArrowRight,
  Home,
  Briefcase,
  Star,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const API_URL = import.meta.env.VITE_API_URL || '';

const GRADIENTS = [
  'from-itc-green to-emerald-700',
  'from-itc-red to-rose-700',
  'from-blue-500 to-indigo-700',
  'from-amber-500 to-orange-700',
  'from-purple-500 to-fuchsia-700',
];

const initialsOf = (profile) =>
  `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`.toUpperCase();

const Avatar = ({ profile, index = 0, className = '', textClass = 'text-4xl' }) => {
  if (profile.profilePic) {
    return (
      <img
        src={profile.profilePic}
        alt={`${profile.firstName} ${profile.lastName}`}
        className={`object-cover ${className}`}
      />
    );
  }
  return (
    <div className={`bg-gradient-to-br ${GRADIENTS[index % GRADIENTS.length]} flex items-center justify-center ${className}`}>
      <span className={`font-bold text-white ${textClass}`}>{initialsOf(profile)}</span>
    </div>
  );
};

// Profile Modal
const ProfileModal = ({ profile, index, onClose }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl transition-colors duration-300"
      >
        <div className="relative h-56 sm:h-64">
          <Avatar profile={profile} index={index} className="w-full h-full" textClass="text-7xl" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          {profile.isFounder && (
            <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-itc-green text-white text-sm font-medium flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 fill-current" />
              Founding Team
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 text-white">
            <h2 className="text-2xl sm:text-3xl font-bold mb-1">{profile.firstName} {profile.lastName}</h2>
            <p className="text-sm text-white/90 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4" />
              {profile.profession}{profile.company ? ` · ${profile.company}` : ''}
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto max-h-[calc(90vh-16rem)]">
          {profile.bio ? (
            <>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">About</h4>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm sm:text-base">{profile.bio}</p>
            </>
          ) : (
            <p className="text-slate-400 dark:text-slate-500 text-sm italic">No bio yet.</p>
          )}
        </div>

        {profile.linkedIn && (
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            <a
              href={profile.linkedIn}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-colors"
            >
              <Linkedin className="w-5 h-5" />
              Connect on LinkedIn
              <ExternalLink className="w-4 h-4 ml-1 hidden sm:block" />
            </a>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// Profile Card
const ProfileCard = ({ profile, onClick, index = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95 }}
    transition={{
      duration: 0.3,
      delay: Math.min(index * 0.05, 0.4),
      ease: [0.25, 0.1, 0.25, 1],
    }}
    whileHover={{ y: -4, transition: { duration: 0.2 } }}
    onClick={onClick}
    className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 group"
  >
    <div className="relative aspect-[4/5] overflow-hidden">
      <Avatar
        profile={profile}
        index={index}
        className="w-full h-full transition-transform duration-500 group-hover:scale-105"
        textClass="text-5xl"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

      {profile.isFounder && (
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-itc-green text-white text-xs font-semibold flex items-center gap-1">
          <Star className="w-3 h-3 fill-current" />
          <span className="hidden sm:inline">Founding Team</span>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 text-white">
        <h3 className="text-lg sm:text-xl font-bold leading-tight">{profile.firstName} {profile.lastName}</h3>
        <p className="text-xs sm:text-sm text-white/80 mt-0.5 line-clamp-1">
          {profile.profession}{profile.company ? ` · ${profile.company}` : ''}
        </p>
      </div>
    </div>

    <div className="p-3 sm:p-4 flex items-center justify-between">
      {profile.bio ? (
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-2 pr-2">{profile.bio}</p>
      ) : <div />}
      {profile.linkedIn && (
        <span className="flex items-center gap-1 text-itc-green text-xs sm:text-sm font-medium flex-shrink-0">
          <Linkedin className="w-4 h-4" />
        </span>
      )}
    </div>
  </motion.div>
);

const Community = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const response = await fetch(`${API_URL}/api/community/profiles`);
        const data = await response.json();
        if (data.success) {
          setProfiles(data.profiles);
        }
      } catch (err) {
        console.error('Failed to load community profiles:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfiles();
  }, []);

  // Founders first (oldest-first = seed order), then community members newest-first
  const founders = profiles
    .filter((p) => p.isFounder)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const members = profiles.filter((p) => !p.isFounder);
  const allProfiles = [...founders, ...members];

  const filteredProfiles = allProfiles.filter((profile) => {
    if (!searchTerm) return true;
    const haystack = `${profile.firstName} ${profile.lastName} ${profile.profession || ''} ${profile.company || ''}`.toLowerCase();
    return haystack.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative overflow-hidden transition-colors duration-300">
      {/* Top Controls */}
      <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-20">
        <Link
          to="/"
          className="p-3 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-itc-green dark:hover:text-itc-green transition-all shadow-sm hover:shadow-md"
        >
          <Home className="w-5 h-5" />
        </Link>
        <ThemeToggle className="shadow-sm hover:shadow-md" />
      </div>

      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[40rem] h-[40rem] bg-itc-green/8 dark:bg-itc-green/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[40rem] h-[40rem] bg-itc-red/8 dark:bg-itc-red/10 rounded-full blur-3xl" />
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selected && (
          <ProfileModal
            profile={selected.profile}
            index={selected.index}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-7xl mx-auto px-4 pt-24 pb-12 sm:pb-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 sm:mb-12"
        >
          <div className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm font-medium mb-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <Users className="w-4 h-4 text-itc-green" />
            {allProfiles.length} Members
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
            Meet the
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-itc-green to-itc-red"> Community</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto px-4">
            The innovators, founders, investors, and engineers of the Italian Tech Club NYC. Create your profile and connect with fellow members.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/community/manage"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              Claim Your Profile <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/community/join"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:border-itc-green hover:text-itc-green transition-all"
            >
              New here? Apply to Join
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
            Already a member? Claim your profile with the email you registered with — or request a new one if you've lost access.
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 mb-8"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, profession, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-itc-green focus:ring-2 focus:ring-itc-green/20 outline-none"
            />
          </div>
        </motion.div>

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-center justify-center gap-2 text-slate-400 text-sm mb-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading community members...
          </div>
        )}

        {/* No Results */}
        {!loading && filteredProfiles.length === 0 && (
          <div className="text-center py-20">
            <Search className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No matches found</h3>
            <p className="text-slate-500 dark:text-slate-400">Try adjusting your search</p>
          </div>
        )}

        {/* Grid */}
        {filteredProfiles.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            <AnimatePresence mode="popLayout">
              {filteredProfiles.map((profile, index) => (
                <ProfileCard
                  key={profile._id || profile.id}
                  profile={profile}
                  index={index}
                  onClick={() => setSelected({ profile, index })}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Footer CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 sm:mt-16 text-center"
        >
          <div className="bg-gradient-to-r from-itc-green/10 via-white to-itc-red/10 dark:via-slate-900 rounded-3xl p-6 sm:p-10 border border-slate-100 dark:border-slate-800">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-3">You're part of this community too</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto text-sm sm:text-base">
              Already a member? Claim your profile to edit it and connect on LinkedIn. New to the club? Apply to join.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/community/manage"
                className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                Claim Your Profile
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/community/join"
                className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:border-itc-green hover:text-itc-green transition-all"
              >
                Apply to Join
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Community;
