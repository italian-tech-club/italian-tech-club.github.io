import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Linkedin, 
  Sparkles, 
  Lightbulb, 
  User, 
  Heart,
  AlertCircle,
  Search,
  Users,
  Loader2,
  ExternalLink,
  X,
  Eye,
  ThumbsUp,
  Rocket,
  ChevronRight,
  ArrowRight
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const ROLE_CONFIG = {
  technical: { label: 'Technical', emoji: '👨‍💻', color: 'bg-blue-500', lightColor: 'bg-blue-50', textColor: 'text-blue-600' },
  'non-technical': { label: 'Non-Technical', emoji: '📊', color: 'bg-amber-500', lightColor: 'bg-amber-50', textColor: 'text-amber-600' },
  design: { label: 'Design', emoji: '🎨', color: 'bg-pink-500', lightColor: 'bg-pink-50', textColor: 'text-pink-600' },
  hybrid: { label: 'Hybrid', emoji: '🔀', color: 'bg-purple-500', lightColor: 'bg-purple-50', textColor: 'text-purple-600' },
};

const STAGE_CONFIG = {
  idea: { label: 'Has an idea', emoji: '💡' },
  exploring: { label: 'Exploring', emoji: '🔍' },
  building: { label: 'Already building', emoji: '🚀' },
  experienced: { label: 'Serial founder', emoji: '🏆' },
};

const COMMITMENT_CONFIG = {
  fulltime: { label: 'Full-time ready', emoji: '⚡' },
  parttime: { label: 'Part-time to start', emoji: '🌙' },
  depends: { label: 'Flexible', emoji: '🤔' },
};

const PROMPT_CONFIG = {
  superpower: { label: 'Superpower', icon: Sparkles, color: 'text-yellow-500' },
  obsession: { label: 'Obsessed with', icon: Lightbulb, color: 'text-amber-500' },
  cofounder_type: { label: 'As a co-founder', icon: User, color: 'text-blue-500' },
  looking_for: { label: 'Looking for', icon: Heart, color: 'text-pink-500' },
  dealbreaker: { label: 'Dealbreaker', icon: AlertCircle, color: 'text-red-500' },
};

// Profile Modal Component
const ProfileModal = ({ profile, onClose, onLike, hasLiked }) => {
  const roleConfig = ROLE_CONFIG[profile.role] || ROLE_CONFIG.technical;
  const stageConfig = STAGE_CONFIG[profile.stage] || STAGE_CONFIG.exploring;
  const filledPrompts = Object.entries(profile.prompts || {}).filter(([_, value]) => value?.trim());

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
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
      >
        {/* Header with photo */}
        <div className="relative h-64 sm:h-72">
          <img 
            src={profile.profilePic} 
            alt={`${profile.firstName} ${profile.lastName}`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Role badge */}
          <div className={`absolute top-4 left-4 px-3 py-1.5 rounded-full ${roleConfig.color} text-white text-sm font-medium flex items-center gap-1.5`}>
            <span>{roleConfig.emoji}</span>
            {roleConfig.label}
          </div>

          {/* Name and stats */}
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 text-white">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">{profile.firstName} {profile.lastName}</h2>
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/90">
              <span>{stageConfig.emoji} {stageConfig.label}</span>
              {profile.commitment && COMMITMENT_CONFIG[profile.commitment] && (
                <span>{COMMITMENT_CONFIG[profile.commitment].emoji} {COMMITMENT_CONFIG[profile.commitment].label}</span>
              )}
            </div>
            {(profile.views > 0 || profile.likes > 0) && (
              <div className="flex items-center gap-4 mt-2 text-xs text-white/60">
                {profile.views > 0 && (
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> {profile.views}
                  </span>
                )}
                {profile.likes > 0 && (
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="w-3.5 h-3.5" /> {profile.likes}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto max-h-[calc(90vh-18rem)]">
          {/* Industries */}
          {profile.industries?.length > 0 && (
            <div className="mb-5">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Interested in</h4>
              <div className="flex flex-wrap gap-2">
                {profile.industries.map((industry, idx) => (
                  <span 
                    key={idx}
                    className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-sm font-medium"
                  >
                    {industry}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Prompts */}
          <div className="space-y-4">
            {filledPrompts.map(([key, value]) => {
              const config = PROMPT_CONFIG[key];
              if (!config) return null;
              const Icon = config.icon;
              return (
                <div key={key}>
                  <div className={`flex items-center gap-2 text-sm font-semibold ${config.color} mb-1`}>
                    <Icon className="w-4 h-4" />
                    {config.label}
                  </div>
                  <p className="text-slate-700 leading-relaxed pl-6 text-sm sm:text-base">{value}</p>
                </div>
              );
            })}
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="mt-5 pt-5 border-t border-slate-100">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">About</h4>
              <p className="text-slate-600 leading-relaxed text-sm sm:text-base">{profile.bio}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={() => onLike(profile._id)}
            className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium transition-all ${
              hasLiked 
                ? 'bg-pink-500 text-white' 
                : 'bg-white border border-slate-200 text-slate-700 hover:border-pink-300 hover:text-pink-500'
            }`}
          >
            <ThumbsUp className={`w-5 h-5 ${hasLiked ? 'fill-current' : ''}`} />
            {hasLiked ? 'Liked!' : 'Like'}
          </button>
          <a
            href={profile.linkedIn}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white font-medium hover:bg-itc-green transition-colors"
          >
            <Linkedin className="w-5 h-5" />
            Connect on LinkedIn
            <ExternalLink className="w-4 h-4 ml-1 hidden sm:block" />
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Profile Card Component
const ProfileCard = ({ profile, onClick, index = 0 }) => {
  const roleConfig = ROLE_CONFIG[profile.role] || ROLE_CONFIG.technical;
  const stageConfig = STAGE_CONFIG[profile.stage] || STAGE_CONFIG.exploring;
  const firstPrompt = Object.entries(profile.prompts || {}).find(([_, v]) => v?.trim());

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ 
        duration: 0.3,
        delay: Math.min(index * 0.05, 0.4),
        ease: [0.25, 0.1, 0.25, 1]
      }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden cursor-pointer hover:shadow-xl transition-shadow duration-300 group"
    >
      {/* Photo */}
      <div className="relative aspect-[4/5] overflow-hidden">
        <img 
          src={profile.profilePic} 
          alt={`${profile.firstName} ${profile.lastName}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        
        {/* Role badge */}
        <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full ${roleConfig.lightColor} ${roleConfig.textColor} text-xs font-semibold flex items-center gap-1`}>
          <span>{roleConfig.emoji}</span>
          <span className="hidden sm:inline">{roleConfig.label}</span>
        </div>

        {/* Stats */}
        {profile.likes > 0 && (
          <div className="absolute top-3 right-3">
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 text-white text-xs">
              <ThumbsUp className="w-3 h-3" /> {profile.likes}
            </span>
          </div>
        )}

        {/* Name */}
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 text-white">
          <h3 className="text-lg sm:text-xl font-bold leading-tight">{profile.firstName} {profile.lastName}</h3>
          <p className="text-xs sm:text-sm text-white/80 mt-0.5">{stageConfig.emoji} {stageConfig.label}</p>
        </div>
      </div>

      {/* Preview content */}
      <div className="p-3 sm:p-4">
        {firstPrompt && (
          <div className="mb-2 sm:mb-3">
            <p className="text-xs text-slate-400 font-medium mb-1">
              {PROMPT_CONFIG[firstPrompt[0]]?.label}
            </p>
            <p className="text-xs sm:text-sm text-slate-700 line-clamp-2">{firstPrompt[1]}</p>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          {profile.industries?.length > 0 ? (
            <div className="flex items-center gap-1 text-xs text-slate-500 overflow-hidden">
              <span className="px-2 py-0.5 bg-slate-100 rounded-full truncate max-w-[100px]">{profile.industries[0]}</span>
              {profile.industries.length > 1 && (
                <span className="text-slate-400 flex-shrink-0">+{profile.industries.length - 1}</span>
              )}
            </div>
          ) : <div />}
          <span className="flex items-center gap-1 text-itc-green text-xs sm:text-sm font-medium group-hover:gap-2 transition-all flex-shrink-0">
            View <ChevronRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </motion.div>
  );
};

const CoFounderProfiles = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [likedProfiles, setLikedProfiles] = useState(new Set());

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/cofounder/profiles`);
      const data = await response.json();
      
      if (data.success) {
        setProfiles(data.profiles);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to load profiles. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const trackView = useCallback(async (profileId) => {
    try {
      await fetch(`${API_URL}/api/cofounder/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, type: 'view' }),
      });
    } catch (err) {
      // Silent fail for view tracking
    }
  }, []);

  const handleLike = useCallback(async (profileId) => {
    try {
      const response = await fetch(`${API_URL}/api/cofounder/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, type: 'like' }),
      });
      const data = await response.json();
      
      if (data.success) {
        setLikedProfiles(prev => {
          const newSet = new Set(prev);
          if (data.action === 'liked') {
            newSet.add(profileId);
          } else {
            newSet.delete(profileId);
          }
          return newSet;
        });
        
        setProfiles(prev => prev.map(p => {
          if (p._id === profileId) {
            return { ...p, likes: (p.likes || 0) + (data.action === 'liked' ? 1 : -1) };
          }
          return p;
        }));

        // Update selected profile too
        setSelectedProfile(prev => {
          if (prev && prev._id === profileId) {
            return { ...prev, likes: (prev.likes || 0) + (data.action === 'liked' ? 1 : -1) };
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('Failed to like:', err);
    }
  }, []);

  const openProfile = useCallback((profile) => {
    setSelectedProfile(profile);
    trackView(profile._id);
  }, [trackView]);

  const filteredProfiles = profiles.filter(profile => {
    const matchesFilter = filter === 'all' || profile.role === filter;
    const matchesSearch = searchTerm === '' || 
      `${profile.firstName} ${profile.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.industries?.some(i => i.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[40rem] h-[40rem] bg-itc-green/8 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[40rem] h-[40rem] bg-itc-red/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 w-[40rem] h-[40rem] bg-amber-100/50 rounded-full blur-3xl" />
      </div>

      {/* Profile Modal */}
      <AnimatePresence>
        {selectedProfile && (
          <ProfileModal 
            profile={selectedProfile} 
            onClose={() => setSelectedProfile(null)}
            onLike={handleLike}
            hasLiked={likedProfiles.has(selectedProfile._id)}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 sm:mb-12"
        >
          <div className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-white text-slate-600 text-sm font-medium mb-6 border border-slate-200 shadow-sm">
            <Users className="w-4 h-4 text-itc-green" />
            {profiles.length} Potential Co-founders
          </div>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
            Find Your 
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-itc-green to-itc-red"> Match</span>
          </h1>
          
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto px-4">
            Browse profiles from the Italian Tech Club community and find your perfect co-founder match.
          </p>
        </motion.div>

        {/* Search and Filters */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-8"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or industry..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-itc-green focus:ring-2 focus:ring-itc-green/20 outline-none"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  filter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({profiles.length})
              </button>
              {Object.entries(ROLE_CONFIG).map(([key, config]) => {
                const count = profiles.filter(p => p.role === key).length;
                if (count === 0) return null;
                return (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      filter === key ? `${config.color} text-white` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {config.emoji}
                    <span className="hidden sm:inline">{config.label}</span>
                    <span className="text-xs opacity-80">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-itc-green animate-spin mb-4" />
            <p className="text-slate-500">Loading profiles...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-20">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-slate-600 mb-4">{error}</p>
            <button onClick={fetchProfiles} className="px-6 py-2 rounded-full bg-slate-900 text-white font-medium hover:bg-itc-green transition-colors">
              Try Again
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && profiles.length === 0 && (
          <div className="text-center py-20">
            <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No profiles yet</h3>
            <p className="text-slate-500 mb-6">Be the first to create a profile!</p>
            <a href="/cofounder-matching" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 text-white font-medium hover:bg-itc-green transition-colors">
              Create Your Profile <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* No Results */}
        {!loading && !error && profiles.length > 0 && filteredProfiles.length === 0 && (
          <div className="text-center py-20">
            <Search className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No matches found</h3>
            <p className="text-slate-500">Try adjusting your search or filters</p>
          </div>
        )}

        {/* Profiles Grid */}
        {!loading && !error && filteredProfiles.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            <AnimatePresence mode="popLayout">
              {filteredProfiles.map((profile, index) => (
                <ProfileCard 
                  key={profile._id} 
                  profile={profile} 
                  index={index}
                  onClick={() => openProfile(profile)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Footer CTA */}
        {!loading && !error && profiles.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 sm:mt-16 text-center"
          >
            <div className="bg-gradient-to-r from-itc-green/10 via-white to-itc-red/10 rounded-3xl p-6 sm:p-10 border border-slate-100">
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3">Don't see yourself here?</h3>
              <p className="text-slate-600 mb-6 max-w-md mx-auto text-sm sm:text-base">
                Create your profile and let others in the Italian Tech Club community find you!
              </p>
              <a 
                href="/cofounder-matching"
                className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-full bg-slate-900 text-white font-semibold hover:bg-itc-green transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                Create Your Profile
                <Rocket className="w-5 h-5" />
              </a>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CoFounderProfiles;
