import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail,
  Upload,
  ArrowRight,
  Check,
  AlertCircle,
  Home,
  Loader2,
  Trash2,
  Save,
  AtSign,
  Clock,
  UserPlus,
  Eye,
  Hash,
  Copy,
  Sparkles,
  Handshake,
} from 'lucide-react';
import ImageCropper from './ImageCropper';
import ThemeToggle from './ThemeToggle';
import { setMemberSession, clearMemberSession, getMemberSession, memberAuthHeaders } from '../lib/memberSession';
import { ROLE_OPTIONS, LOOKING_FOR_OPTIONS } from '../lib/communityOptions';

const PROFILE_PIC_SIZE = 400;
const MAX_FILE_SIZE_MB = 5;
const API_URL = import.meta.env.VITE_API_URL || '';

const inputClasses = (hasError) => `w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 ${
  hasError ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-700'
} focus:border-itc-green focus:ring-2 focus:ring-itc-green/20 outline-none transition-all`;

const cardClasses = 'w-full max-w-md mx-auto p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl';

// Multi-select pill picker for roles / looking-for
const TogglePills = ({ options, selected = [], onToggle }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((option) => {
      const active = selected.includes(option.value);
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onToggle(option.value)}
          className={`px-3.5 py-2 rounded-full text-sm font-medium border transition-colors ${
            active
              ? 'bg-itc-green text-white border-itc-green'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-itc-green hover:text-itc-green'
          }`}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

// Entry screen (no token): claim/manage by email, or request to claim with a new email
const ManageEntry = () => {
  const [mode, setMode] = useState('link'); // 'link' | 'claim'

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex gap-1 p-1 rounded-full bg-slate-100 dark:bg-slate-900 w-full mb-6">
        {[['link', 'I have my email'], ['claim', 'Lost access']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`flex-1 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
              mode === key
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'link' ? <RequestLink /> : <ClaimRequestForm />}
    </div>
  );
};

// Claim/manage by the email on file → sends a magic link
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
      if (response.ok) setSent(true);
      else setError('Something went wrong. Please try again.');
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className={cardClasses}>
      <div className="w-12 h-12 rounded-full bg-itc-green/10 flex items-center justify-center mx-auto mb-6">
        <Mail className="w-5 h-5 text-itc-green" />
      </div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-1">Member Sign In</h1>

      {sent ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-4">
          If a profile with <span className="font-medium text-slate-700 dark:text-slate-300">{email}</span> exists,
          a sign-in link is on its way. Check your inbox — the link expires in 60 minutes.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
            Enter the email you registered with — we'll send you a sign-in link. No password needed.
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Email Me a Sign-In Link'}
          </button>
        </>
      )}
    </motion.form>
  );
};

// Lost access to the registered email → request to take over with a new one (admin approves)
const ClaimRequestForm = () => {
  const [form, setForm] = useState({ fullName: '', currentEmail: '', newEmail: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (!form.fullName.trim() || !form.newEmail.trim()) {
      setError('Your name and the new email are required.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/community/claim-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (response.ok && data.success) setSent(true);
      else setError(data.message || 'Something went wrong. Please try again.');
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${cardClasses} text-center`}>
        <div className="w-16 h-16 bg-itc-green/10 dark:bg-itc-green/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-itc-green" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Request received</h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          An admin will review your request. Once approved, you'll get an email at{' '}
          <span className="font-medium text-slate-700 dark:text-slate-300">{form.newEmail}</span> to sign in.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className={cardClasses}>
      <div className="w-12 h-12 rounded-full bg-itc-green/10 flex items-center justify-center mx-auto mb-6">
        <UserPlus className="w-5 h-5 text-itc-green" />
      </div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-1">Claim With a New Email</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
        No longer have access to the email on file? Request to take ownership with a new one — an admin will approve it.
      </p>

      <div className="space-y-3">
        <input type="text" value={form.fullName} onChange={set('fullName')} placeholder="Your full name (as registered) *" className={inputClasses(false)} />
        <input type="email" value={form.currentEmail} onChange={set('currentEmail')} placeholder="Old email on file (if you know it)" className={inputClasses(false)} />
        <input type="email" value={form.newEmail} onChange={set('newEmail')} placeholder="New email you want to use *" className={inputClasses(false)} />
        <textarea value={form.message} onChange={set('message')} rows={3} maxLength={1000} placeholder="Anything that helps us verify it's you (optional)" className={`${inputClasses(false)} resize-none`} />
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-500 mt-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-6 px-6 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Request'}
      </button>
    </motion.form>
  );
};

// Confirm a pending primary-email change (arrived via emailToken link)
const ConfirmEmailChange = ({ emailToken }) => {
  const [state, setState] = useState('loading'); // 'loading' | 'ok' | 'error'
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        const response = await fetch(`${API_URL}/api/community/manage?emailToken=${encodeURIComponent(emailToken)}`);
        const data = await response.json();
        if (response.ok && data.success) {
          setEmail(data.email || '');
          setState('ok');
        } else {
          setMessage(data.message || 'This confirmation link is invalid or has expired.');
          setState('error');
        }
      } catch {
        setMessage('Could not reach the server. Please try again.');
        setState('error');
      }
    };
    run();
  }, [emailToken]);

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center gap-3 text-slate-500 dark:text-slate-400 py-20">
        <Loader2 className="w-5 h-5 animate-spin" /> Confirming your new email...
      </div>
    );
  }

  return (
    <div className={`${cardClasses} text-center`}>
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${state === 'ok' ? 'bg-itc-green/10 dark:bg-itc-green/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
        {state === 'ok' ? <Check className="w-8 h-8 text-itc-green" /> : <AlertCircle className="w-8 h-8 text-red-500" />}
      </div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
        {state === 'ok' ? 'Email updated!' : 'Link invalid'}
      </h2>
      <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
        {state === 'ok'
          ? <>Your profile now uses <span className="font-medium text-slate-700 dark:text-slate-300">{email}</span> as its primary email.</>
          : message}
      </p>
      <a
        href="/community/manage"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-colors"
      >
        Manage My Profile
      </a>
    </div>
  );
};

// Change the primary email while signed in (manage token or member session)
const ChangeEmailSection = ({ token, currentEmail }) => {
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    if (!newEmail || loading) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const authQS = token ? `?token=${encodeURIComponent(token)}` : '';
      const response = await fetch(`${API_URL}/api/community/manage${authQS}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? {} : memberAuthHeaders()) },
        body: JSON.stringify({ action: 'change-email', newEmail }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setMessage(data.message || `Check ${newEmail} to confirm the change.`);
        setNewEmail('');
      } else {
        setError(data.message || 'Something went wrong.');
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between text-left">
        <span className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
          <AtSign className="w-5 h-5 text-itc-green" /> Primary Email
        </span>
        <span className="text-sm text-slate-400">{open ? 'Cancel' : 'Change'}</span>
      </button>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
        Currently <span className="font-medium text-slate-700 dark:text-slate-300">{currentEmail}</span> — never shown publicly.
      </p>

      {open && (
        <div className="mt-4 space-y-3">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="new-email@example.com"
            className={inputClasses(false)}
          />
          <p className="text-xs text-slate-400">We'll send a confirmation link to the new address. It becomes your primary email only after you click it.</p>
          {error && <p className="flex items-center gap-2 text-sm text-red-500"><AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}</p>}
          {message && <p className="flex items-center gap-2 text-sm text-itc-green"><Check className="w-4 h-4 flex-shrink-0" /> {message}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={loading || !newEmail}
            className="px-5 py-2.5 rounded-full text-sm font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Confirmation'}
          </button>
        </div>
      )}
    </div>
  );
};

// Personal referral link — invited applicants show up flagged for admins
const InviteCard = ({ inviteCode }) => {
  const [copied, setCopied] = useState(false);
  const inviteUrl = `${window.location.origin}/community/join?ref=${inviteCode}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the URL is visible to copy manually.
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
      <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-itc-green" /> Invite Someone
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Know an Italian in tech who belongs here? Share your personal link — applications through it carry your name.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          readOnly
          value={inviteUrl}
          onFocus={(e) => e.target.select()}
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm outline-none"
        />
        <button
          type="button"
          onClick={copy}
          className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-colors flex items-center gap-2 flex-shrink-0"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
};

// Edit / delete / change-email of own profile. Reached either with a magic-link
// token (?token=) or with a stored member session (token = null).
const EditProfile = ({ token }) => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
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

  const authQS = token ? `?token=${encodeURIComponent(token)}` : '';
  const authHeaders = token ? {} : memberAuthHeaders();

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`${API_URL}/api/community/manage${authQS}`, { headers: authHeaders });
        const data = await response.json();
        if (response.ok && data.success) {
          // A magic link is a sign-in, not an edit intent: store the session
          // and land on the directory. Editing happens later via "Edit profile".
          // (Pending applicants get no session — they fall through to the form.)
          if (data.sessionToken) {
            setMemberSession({ token: data.sessionToken, expiresAt: data.sessionExpiresAt, member: data.member });
            navigate('/community', { replace: true });
            return;
          }
          setProfile(data.profile);
          setStats(data.stats || null);
        } else {
          if (!token) clearMemberSession(); // stale session — force the entry screen next time
          setLoadError(data.message || 'This link is invalid or has expired.');
        }
      } catch {
        setLoadError('Could not reach the server. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const set = (field) => (e) => setProfile((prev) => ({ ...prev, [field]: e.target.value }));
  const toggleIn = (field) => (value) => setProfile((prev) => {
    const current = prev[field] || [];
    return {
      ...prev,
      [field]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    };
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setPicError('Please upload an image file'); return; }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) { setPicError(`File size must be under ${MAX_FILE_SIZE_MB}MB`); return; }
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
      const linkedIn = (profile.linkedIn || '').trim();
      const response = await fetch(`${API_URL}/api/community/manage${authQS}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          firstName: profile.firstName,
          lastName: profile.lastName,
          linkedIn: linkedIn && !/^https?:\/\//i.test(linkedIn) ? `https://${linkedIn}` : linkedIn,
          profilePic: profile.profilePic,
          profession: profile.profession,
          company: profile.company,
          bio: profile.bio,
          roles: profile.roles || [],
          lookingFor: profile.lookingFor || [],
          openToConnect: profile.openToConnect !== false,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Failed to save');
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
      const response = await fetch(`${API_URL}/api/community/manage${authQS}`, { method: 'DELETE', headers: authHeaders });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Failed to delete');
      clearMemberSession();
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
        <Loader2 className="w-5 h-5 animate-spin" /> {token ? 'Signing you in...' : 'Loading your profile...'}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`${cardClasses} text-center`}>
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
      <div className={`${cardClasses} text-center`}>
        <div className="w-16 h-16 bg-itc-green/10 dark:bg-itc-green/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-itc-green" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          {done === 'saved' ? 'Profile updated!' : 'Profile deleted'}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          {done === 'saved'
            ? (profile.status === 'pending'
                ? 'Saved! Your profile will go live once our team approves it.'
                : 'Your changes are live on the community page.')
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
    <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSave} className="w-full max-w-2xl mx-auto space-y-6">
      {showCropper && selectedFile && (
        <ImageCropper
          imageFile={selectedFile}
          onCropComplete={(cropped) => {
            setProfile((prev) => ({ ...prev, profilePic: cropped }));
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

      {profile.status === 'pending' && (
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm">
          <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>Your profile is awaiting admin approval. You can edit it now — it goes live once approved.</span>
        </div>
      )}

      {/* Member stats — private, only the owner ever sees these */}
      {profile.status === 'approved' && (
        <div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 dark:border-slate-800 text-center">
              <Hash className="w-4 h-4 text-itc-green mx-auto mb-1" />
              <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">
                {profile.memberNumber != null ? `#${String(profile.memberNumber).padStart(3, '0')}` : '—'}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider">Member</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 dark:border-slate-800 text-center">
              <Eye className="w-4 h-4 text-itc-green mx-auto mb-1" />
              <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">{stats?.viewsLast7Days ?? 0}</p>
              <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider">Profile views · 7d</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 dark:border-slate-800 text-center">
              <Eye className="w-4 h-4 text-slate-400 mx-auto mb-1" />
              <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">{stats?.totalViews ?? 0}</p>
              <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider">Profile views · all</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">
            How many members viewed <span className="font-medium">your</span> profile — only you can see this.
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Your Profile</h2>

        <div className="flex items-center gap-6 mb-6">
          {profile.profilePic ? (
            <img src={profile.profilePic} alt="Profile" className="w-24 h-24 object-cover rounded-2xl border-4 border-itc-green/20" />
          ) : (
            <div className="w-24 h-24 rounded-2xl border-4 border-itc-green/20 bg-gradient-to-br from-itc-green to-emerald-700 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {`${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`.toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors">
              <Upload className="w-4 h-4" /> {profile.profilePic ? 'Change photo' : 'Add photo'}
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
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">LinkedIn Profile</label>
          <input type="text" value={profile.linkedIn || ''} onChange={set('linkedIn')} placeholder="linkedin.com/in/yourprofile" className={inputClasses(false)} />
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
          <textarea value={profile.bio} onChange={set('bio')} rows={4} maxLength={500} className={`${inputClasses(false)} resize-none`} />
          <p className="text-xs text-slate-400 text-right mt-1">{(profile.bio || '').length}/500</p>
        </div>
      </div>

      {/* Community signals: roles, looking-for, connect availability */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-itc-green" />
          Community Signals
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Help other members find you — these power the directory badges and filters.
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">I am a...</label>
          <TogglePills options={ROLE_OPTIONS} selected={profile.roles || []} onToggle={toggleIn('roles')} />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">I'm looking for...</label>
          <TogglePills options={LOOKING_FOR_OPTIONS} selected={profile.lookingFor || []} onToggle={toggleIn('lookingFor')} />
        </div>

        <div className="flex items-start justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Handshake className="w-4 h-4 text-itc-green" /> Open to connect
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Members can request an intro. You approve by email before anyone gets your contact.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setProfile((prev) => ({ ...prev, openToConnect: prev.openToConnect === false }))}
            className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${profile.openToConnect !== false ? 'bg-itc-green' : 'bg-slate-300 dark:bg-slate-700'}`}
            aria-label="Toggle open to connect"
          >
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${profile.openToConnect !== false ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
      </div>

      {profile.inviteCode && <InviteCard inviteCode={profile.inviteCode} />}

      <ChangeEmailSection token={token} currentEmail={profile.email} />

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
        {!profile.isFounder && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving || deleting}
            className="py-4 px-6 rounded-2xl border-2 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
            Delete Profile
          </button>
        )}
      </div>
    </motion.form>
  );
};

const CommunityManage = () => {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const token = params.get('token');
  const emailToken = params.get('emailToken');

  // Strip tokens from the URL bar (kept in state for API calls)
  useEffect(() => {
    if (token || emailToken) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [token, emailToken]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-20">
        <Link
          to="/"
          className="p-3 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-itc-green dark:hover:text-itc-green transition-all shadow-sm hover:shadow-md"
        >
          <Home className="w-5 h-5" />
        </Link>
        <ThemeToggle className="shadow-sm hover:shadow-md" />
      </div>

      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[40rem] h-[40rem] bg-itc-green/8 dark:bg-itc-green/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[40rem] h-[40rem] bg-itc-red/8 dark:bg-itc-red/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-28 pb-16 flex flex-col justify-center min-h-screen">
        {emailToken
          ? <ConfirmEmailChange emailToken={emailToken} />
          : token
            ? <EditProfile token={token} />
            : getMemberSession()
              ? <EditProfile token={null} />
              : <ManageEntry />}
      </div>
    </div>
  );
};

export default CommunityManage;
