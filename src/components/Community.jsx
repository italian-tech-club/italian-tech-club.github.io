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
  Lock,
  Send,
  LogOut,
  Check,
  AlertCircle,
  Sparkles,
  Hash,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { getMemberSession, memberAuthHeaders, clearMemberSession } from '../lib/memberSession';
import { ROLE_OPTIONS, LOOKING_FOR_OPTIONS, roleLabel, lookingForLabel, lookingForPhrase } from '../lib/communityOptions';

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

const RoleChips = ({ roles = [], className = '' }) => {
  if (!roles.length) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {roles.map((role) => (
        <span key={role} className="px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm text-white text-[10px] sm:text-xs font-medium border border-white/20">
          {roleLabel(role)}
        </span>
      ))}
    </div>
  );
};

const LookingForChips = ({ lookingFor = [], className = '' }) => {
  if (!lookingFor.length) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {lookingFor.map((item) => (
        <span key={item} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-itc-green/10 text-itc-green text-xs font-semibold border border-itc-green/20">
          <Sparkles className="w-3 h-3" />
          Looking for: {lookingForLabel(item)}
        </span>
      ))}
    </div>
  );
};

// Member-to-member connect (double opt-in: the other member accepts by email
// before any contact info is shared)
const ConnectSection = ({ profile, viewer }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');

  const isSelf = viewer && String(profile._id) === String(viewer.profileId);
  if (!viewer || isSelf) return null;

  if (!profile.openToConnect) {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
        {profile.firstName} isn't accepting connect requests right now.
      </p>
    );
  }

  const send = async () => {
    if (sending) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/community/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...memberAuthHeaders() },
        body: JSON.stringify({ toProfileId: profile._id, message }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Something went wrong.');
      setSent(data.message);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <p className="flex items-center justify-center gap-2 text-sm text-itc-green font-medium">
        <Check className="w-4 h-4 flex-shrink-0" /> {sent}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-itc-green text-white font-medium hover:bg-emerald-700 transition-colors"
      >
        <Send className="w-4 h-4" />
        Request to Connect
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        maxLength={500}
        autoFocus
        placeholder={`Tell ${profile.firstName} why you'd like to connect...`}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-itc-green focus:ring-2 focus:ring-itc-green/20 outline-none resize-none text-sm"
      />
      <p className="text-xs text-slate-400">
        {profile.firstName} gets an email with your message. If they accept, we introduce you both — your email stays private until then.
      </p>
      {error && (
        <p className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </p>
      )}
      <button
        onClick={send}
        disabled={sending}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-itc-green text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Send Request
      </button>
    </div>
  );
};

// Profile Modal
const ProfileModal = ({ profile, index, viewer, onClose }) => {
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
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl transition-colors duration-300 flex flex-col"
      >
        <div className="relative h-56 sm:h-64 flex-shrink-0">
          <Avatar profile={profile} index={index} className="w-full h-full" textClass="text-7xl" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute top-4 left-4 flex flex-col items-start gap-2">
            {profile.isFounder && (
              <div className="px-3 py-1.5 rounded-full bg-itc-green text-white text-sm font-medium flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 fill-current" />
                Founding Team
              </div>
            )}
            {profile.memberNumber != null && (
              <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs font-medium flex items-center gap-1">
                <Hash className="w-3 h-3" />
                Member #{String(profile.memberNumber).padStart(3, '0')}
              </div>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 text-white">
            <h2 className="text-2xl sm:text-3xl font-bold mb-1">{profile.firstName} {profile.lastName}</h2>
            <p className="text-sm text-white/90 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4" />
              {profile.profession}{profile.company ? ` · ${profile.company}` : ''}
            </p>
            <RoleChips roles={profile.roles} className="mt-2" />
          </div>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto">
          <LookingForChips lookingFor={profile.lookingFor} className="mb-4" />
          {profile.bio ? (
            <>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">About</h4>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm sm:text-base">{profile.bio}</p>
            </>
          ) : (
            <p className="text-slate-400 dark:text-slate-500 text-sm italic">No bio yet.</p>
          )}
        </div>

        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3 flex-shrink-0">
          <ConnectSection profile={profile} viewer={viewer} />
          {profile.linkedIn && (
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
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// Profile Card (members' view)
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

      {profile.lookingFor?.length > 0 && (
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs font-medium flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-itc-green" />
          <span className="hidden lg:inline">{lookingForLabel(profile.lookingFor[0])}{profile.lookingFor.length > 1 ? ` +${profile.lookingFor.length - 1}` : ''}</span>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 text-white">
        <h3 className="text-lg sm:text-xl font-bold leading-tight">{profile.firstName} {profile.lastName}</h3>
        <p className="text-xs sm:text-sm text-white/80 mt-0.5 line-clamp-1">
          {profile.profession}{profile.company ? ` · ${profile.company}` : ''}
        </p>
        <RoleChips roles={(profile.roles || []).slice(0, 2)} className="mt-1.5" />
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

// Anonymized card shown to visitors — enough shape to intrigue, no identity
const LockedCard = ({ entry, index = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
    className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden"
  >
    <div className="relative aspect-[4/5] overflow-hidden">
      <div className={`w-full h-full bg-gradient-to-br ${GRADIENTS[index % GRADIENTS.length]} opacity-40 dark:opacity-30 flex items-center justify-center`}>
        <span className="text-5xl font-bold text-white/70 blur-[6px] select-none">
          {`${entry.firstName?.[0] || ''}${entry.lastInitial || ''}`.toUpperCase()}
        </span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="p-3 rounded-full bg-black/20 backdrop-blur-sm">
          <Lock className="w-6 h-6 text-white/90" />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 text-white bg-gradient-to-t from-black/60 to-transparent">
        <h3 className="text-lg font-bold leading-tight">{entry.firstName} {entry.lastInitial}.</h3>
        <p className="text-xs sm:text-sm text-white/80 mt-0.5 line-clamp-1">{entry.profession}</p>
      </div>
    </div>
    {entry.lookingFor?.length > 0 && (
      <div className="p-3 sm:p-4">
        <span className="inline-flex items-center gap-1 text-xs text-itc-green font-medium">
          <Sparkles className="w-3 h-3" /> {lookingForPhrase(entry.lookingFor[0])}
        </span>
      </div>
    )}
  </motion.div>
);

// Founder card in the visitor view — the public face of the club, not clickable
const FounderCard = ({ entry, index = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
    className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden"
  >
    <div className="relative aspect-[4/5] overflow-hidden">
      <Avatar profile={entry} index={index} className="w-full h-full" textClass="text-5xl" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-itc-green text-white text-xs font-semibold flex items-center gap-1">
        <Star className="w-3 h-3 fill-current" />
        <span className="hidden sm:inline">Founding Team</span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 text-white">
        <h3 className="text-lg sm:text-xl font-bold leading-tight">{entry.firstName} {entry.lastName}</h3>
        <p className="text-xs sm:text-sm text-white/80 mt-0.5 line-clamp-1">{entry.profession}</p>
      </div>
    </div>
  </motion.div>
);

const FilterChip = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border transition-colors ${
      active
        ? 'bg-itc-green text-white border-itc-green'
        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-itc-green hover:text-itc-green'
    }`}
  >
    {children}
  </button>
);

// The "outside the velvet rope" experience for visitors without a session
const LockedDirectory = ({ data }) => {
  const founders = data.teaser
    .filter((t) => t.isFounder)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const locked = data.teaser.filter((t) => !t.isFounder);

  const tickerItems = locked
    .filter((t) => t.lookingFor?.length)
    .flatMap((t) => t.lookingFor.map((l) => ({ profession: t.profession, phrase: lookingForPhrase(l) })))
    .slice(0, 6);

  const statChips = [
    `${data.count} members`,
    ...(data.stats.founders ? [`${data.stats.founders} founding team`] : []),
    ...Object.entries(data.stats.roles || {}).map(([role, n]) => `${n} ${roleLabel(role).toLowerCase()}${n > 1 ? 's' : ''}`),
  ];

  return (
    <>
      {/* Aggregate stats — visible to everyone, names members-only */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap justify-center gap-2 mb-8"
      >
        {statChips.map((chip) => (
          <span key={chip} className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-medium shadow-sm">
            {chip}
          </span>
        ))}
      </motion.div>

      {/* Anonymized "looking for" ticker — the reason to get inside */}
      {tickerItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900 dark:bg-black text-white rounded-2xl p-5 sm:p-6 mb-8"
        >
          <p className="text-xs font-semibold text-itc-green uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Happening inside right now
          </p>
          <div className="flex flex-wrap gap-2">
            {tickerItems.map((item, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-sm">
                A <span className="font-semibold">{item.profession}</span> is {item.phrase}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">Members see who. Sign in or apply to join.</p>
        </motion.div>
      )}

      {/* Grid: founders visible, members locked */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
        {founders.map((entry, index) => (
          <FounderCard key={`f-${index}`} entry={entry} index={index} />
        ))}
        {locked.map((entry, index) => (
          <LockedCard key={`l-${index}`} entry={entry} index={founders.length + index} />
        ))}
      </div>

      {/* Unlock CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-10 text-center"
      >
        <div className="bg-gradient-to-r from-itc-green/10 via-white to-itc-red/10 dark:via-slate-900 rounded-3xl p-6 sm:p-10 border border-slate-100 dark:border-slate-800">
          <Lock className="w-8 h-8 text-itc-green mx-auto mb-3" />
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-3">The full directory is members-only</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto text-sm sm:text-base">
            Members see every profile, filter by role, and request intros. Already one of us? Sign in with your email — no password needed.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/community/manage"
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              Member Sign In <ArrowRight className="w-5 h-5" />
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
    </>
  );
};

const Community = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState(null);
  const [lookingFilter, setLookingFilter] = useState(null);
  const [selected, setSelected] = useState(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const fetchProfiles = async () => {
      setLoading(true);
      try {
        const hadSession = !!getMemberSession();
        const response = await fetch(`${API_URL}/api/community/profiles`, {
          headers: memberAuthHeaders(),
        });
        const payload = await response.json();
        if (payload.success) {
          // Session was revoked or expired server-side — drop the stale token
          if (hadSession && !payload.memberView) clearMemberSession();
          setData(payload);
        }
      } catch (err) {
        console.error('Failed to load community profiles:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfiles();
  }, [refresh]);

  // Count a profile view when a member opens someone's card
  useEffect(() => {
    if (!selected || !data?.memberView) return;
    const profileId = selected.profile._id;
    if (String(profileId) === String(data.viewer?.profileId)) return;
    fetch(`${API_URL}/api/community/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...memberAuthHeaders() },
      body: JSON.stringify({ profileId }),
    }).catch(() => {});
  }, [selected, data]);

  const handleSignOut = async () => {
    try {
      await fetch(`${API_URL}/api/community/session`, { method: 'DELETE', headers: memberAuthHeaders() });
    } catch {
      // best effort — local sign-out below is what matters
    }
    clearMemberSession();
    setSelected(null);
    setRefresh((n) => n + 1);
  };

  const memberView = data?.memberView;
  const profiles = memberView ? data.profiles : [];

  // Founders first (oldest-first = seed order), then community members newest-first
  const founders = profiles
    .filter((p) => p.isFounder)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const members = profiles.filter((p) => !p.isFounder);
  const allProfiles = [...founders, ...members];

  const filteredProfiles = allProfiles.filter((profile) => {
    if (roleFilter && !(profile.roles || []).includes(roleFilter)) return false;
    if (lookingFilter && !(profile.lookingFor || []).includes(lookingFilter)) return false;
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
            viewer={data?.viewer}
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
            {data?.count ?? '...'} Members
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
            Meet the
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-itc-green to-itc-red"> Community</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto px-4">
            The founders, engineers, investors, innovators, and tech enthusiasts of the Italian Tech Club NYC.
          </p>

          {memberView ? (
            <div className="mt-6 inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-sm">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="w-2 h-2 rounded-full bg-itc-green" />
                Signed in as <span className="font-semibold text-slate-900 dark:text-white">{data.viewer?.firstName}</span>
                {data.viewer?.memberNumber != null && (
                  <span className="text-slate-400">· Member #{String(data.viewer.memberNumber).padStart(3, '0')}</span>
                )}
              </span>
              <Link to="/community/manage" className="text-itc-green font-medium hover:underline">Edit profile</Link>
              <button onClick={handleSignOut} className="flex items-center gap-1 text-slate-400 hover:text-itc-red transition-colors">
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          ) : (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/community/manage"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                Member Sign In <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/community/join"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:border-itc-green hover:text-itc-green transition-all"
              >
                New here? Apply to Join
              </Link>
            </div>
          )}
        </motion.div>

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-center justify-center gap-2 text-slate-400 text-sm mb-6 py-12">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading community members...
          </div>
        )}

        {/* Visitor (locked) experience */}
        {!loading && data && !memberView && <LockedDirectory data={data} />}

        {/* Member experience */}
        {!loading && memberView && (
          <>
            {/* Search + Filters */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 mb-8 space-y-4"
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Role</span>
                {ROLE_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.value}
                    active={roleFilter === option.value}
                    onClick={() => setRoleFilter(roleFilter === option.value ? null : option.value)}
                  >
                    {option.label}
                  </FilterChip>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Looking for</span>
                {LOOKING_FOR_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.value}
                    active={lookingFilter === option.value}
                    onClick={() => setLookingFilter(lookingFilter === option.value ? null : option.value)}
                  >
                    {option.label}
                  </FilterChip>
                ))}
              </div>
            </motion.div>

            {/* No Results */}
            {filteredProfiles.length === 0 && (
              <div className="text-center py-20">
                <Search className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No matches found</h3>
                <p className="text-slate-500 dark:text-slate-400">Try adjusting your search or filters</p>
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
          </>
        )}
      </div>
    </div>
  );
};

export default Community;
