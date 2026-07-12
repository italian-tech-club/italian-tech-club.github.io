import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Mail,
  Upload,
  ArrowRight,
  Check,
  AlertCircle,
  X,
  Home,
  Loader2,
  Trash2,
  Save,
} from 'lucide-react';
import ImageCropper from './ImageCropper';
import ThemeToggle from './ThemeToggle';

const PROFILE_PIC_SIZE = 400;
const MAX_FILE_SIZE_MB = 5;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const inputClasses = (hasError) => `w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 ${
  hasError ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-700'
} focus:border-itc-green focus:ring-2 focus:ring-itc-green/20 outline-none transition-all`;

// Step 1: no token — request a manage link by email
const RequestLink = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || loading) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/community/manage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (response.ok) {
        setSent(true);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="w-full max-w-md mx-auto p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl"
    >
      <div className="w-12 h-12 rounded-full bg-itc-green/10 flex items-center justify-center mx-auto mb-6">
        <Mail className="w-5 h-5 text-itc-green" />
      </div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-1">Manage Your Profile</h1>

      {sent ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-4">
          If a profile with <span className="font-medium text-slate-700 dark:text-slate-300">{email}</span> exists,
          a manage link is on its way. Check your inbox — the link expires in 60 minutes.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
            Enter the email you used for your profile and we'll send you an edit link.
          </p>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="mario@example.com"
            autoFocus
            className={inputClasses(false)}
          />

          {error && (
            <p className="flex items-center gap-2 text-sm text-red-500 mt-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full mt-6 px-6 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Email Me a Manage Link'}
          </button>
        </>
      )}
    </motion.form>
  );
};

// Step 2: token present — edit or delete own profile
const EditProfile = ({ token }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [done, setDone] = useState(null); // null | 'saved' | 'deleted'
  const [showCropper, setShowCropper] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [picError, setPicError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`${API_URL}/api/community/manage?token=${encodeURIComponent(token)}`);
        const data = await response.json();
        if (response.ok && data.success) {
          setProfile(data.profile);
        } else {
          setLoadError(data.message || 'This link is invalid or has expired.');
        }
      } catch {
        setLoadError('Could not reach the server. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const set = (field) => (e) => setProfile(prev => ({ ...prev, [field]: e.target.value }));

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPicError('Please upload an image file');
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setPicError(`File size must be under ${MAX_FILE_SIZE_MB}MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        if (img.width < PROFILE_PIC_SIZE || img.height < PROFILE_PIC_SIZE) {
          setPicError(`Image must be at least ${PROFILE_PIC_SIZE}x${PROFILE_PIC_SIZE}px`);
          return;
        }
        setSelectedFile(file);
        setShowCropper(true);
        setPicError('');
      };
      img.src = event.target?.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError('');
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/community/manage?token=${encodeURIComponent(token)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: profile.firstName,
          lastName: profile.lastName,
          linkedIn: /^https?:\/\//i.test(profile.linkedIn.trim()) ? profile.linkedIn.trim() : `https://${profile.linkedIn.trim()}`,
          profilePic: profile.profilePic,
          profession: profile.profession,
          company: profile.company,
          bio: profile.bio,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to save');
      }
      setDone('saved');
    } catch (error) {
      setSaveError(error.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete your profile? This cannot be undone.')) return;
    setDeleting(true);
    setSaveError('');
    try {
      const response = await fetch(`${API_URL}/api/community/manage?token=${encodeURIComponent(token)}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete');
      }
      setDone('deleted');
    } catch (error) {
      setSaveError(error.message || 'Something went wrong. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 text-slate-500 dark:text-slate-400 py-20">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading your profile...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full max-w-md mx-auto p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
        <p className="text-slate-600 dark:text-slate-400 mb-6">{loadError}</p>
        <a
          href="/community/manage"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-colors"
        >
          Request a New Link
        </a>
      </div>
    );
  }

  if (done) {
    return (
      <div className="w-full max-w-md mx-auto p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center">
        <div className="w-16 h-16 bg-itc-green/10 dark:bg-itc-green/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-itc-green" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          {done === 'saved' ? 'Profile updated!' : 'Profile deleted'}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          {done === 'saved'
            ? 'Your changes are live on the community page.'
            : 'Your profile has been removed. Ci vediamo, hopefully at an event!'}
        </p>
        <Link
          to="/community"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-colors"
        >
          Back to Community <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSave}
      className="w-full max-w-2xl mx-auto space-y-6"
    >
      {showCropper && selectedFile && (
        <ImageCropper
          imageFile={selectedFile}
          onCropComplete={(cropped) => {
            setProfile(prev => ({ ...prev, profilePic: cropped }));
            setShowCropper(false);
            setSelectedFile(null);
          }}
          onCancel={() => {
            setShowCropper(false);
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Your Profile</h2>

        {/* Photo */}
        <div className="flex items-center gap-6 mb-6">
          <img
            src={profile.profilePic}
            alt="Profile"
            className="w-24 h-24 object-cover rounded-2xl border-4 border-itc-green/20"
          />
          <div>
            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors">
              <Upload className="w-4 h-4" /> Change photo
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
            {picError && <p className="text-sm text-red-500 mt-2">{picError}</p>}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">First Name *</label>
            <input type="text" required value={profile.firstName} onChange={set('firstName')} className={inputClasses(false)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Last Name *</label>
            <input type="text" required value={profile.lastName} onChange={set('lastName')} className={inputClasses(false)} />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">LinkedIn Profile *</label>
          <input type="text" required value={profile.linkedIn} onChange={set('linkedIn')} className={inputClasses(false)} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Profession *</label>
            <input type="text" required value={profile.profession} onChange={set('profession')} className={inputClasses(false)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Company</label>
            <input type="text" value={profile.company} onChange={set('company')} className={inputClasses(false)} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Bio</label>
          <textarea
            value={profile.bio}
            onChange={set('bio')}
            rows={4}
            maxLength={500}
            className={`${inputClasses(false)} resize-none`}
          />
          <p className="text-xs text-slate-400 text-right mt-1">{(profile.bio || '').length}/500</p>
        </div>
      </div>

      {saveError && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="submit"
          disabled={saving || deleting}
          className="flex-1 py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Save Changes
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={saving || deleting}
          className="py-4 px-6 rounded-2xl border-2 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
          Delete Profile
        </button>
      </div>
    </motion.form>
  );
};

const CommunityManage = () => {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token'));

  // Strip the token from the URL bar (kept in state for API calls)
  useEffect(() => {
    if (token) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [token]);

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

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-28 pb-16 flex flex-col justify-center min-h-screen">
        {token ? <EditProfile token={token} /> : <RequestLink />}
      </div>
    </div>
  );
};

export default CommunityManage;
