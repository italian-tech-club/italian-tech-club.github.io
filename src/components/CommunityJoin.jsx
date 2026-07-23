import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Upload,
  User,
  Linkedin,
  ArrowRight,
  Check,
  AlertCircle,
  X,
  Image as ImageIcon,
  Home,
  Briefcase,
  Sparkles,
} from 'lucide-react';
import ImageCropper from './ImageCropper';
import ThemeToggle from './ThemeToggle';
import { MEMBER_FORM_URL } from '../config';
import { ROLE_OPTIONS, LOOKING_FOR_OPTIONS } from '../lib/communityOptions';

const PROFILE_PIC_SIZE = 800;
const MAX_FILE_SIZE_MB = 5;
const API_URL = import.meta.env.VITE_API_URL || '';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const CommunityJoin = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    linkedIn: '',
    profession: '',
    company: '',
    bio: '',
    roles: [],
    lookingFor: [],
    profilePic: null,
    profilePicPreview: null,
    membershipFormCompleted: false,
  });
  // Referral code from an invite link (/community/join?ref=<code>)
  const [refCode] = useState(() => new URLSearchParams(window.location.search).get('ref') || '');

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const toggleIn = (field) => (value) => setFormData(prev => {
    const current = prev[field];
    return {
      ...prev,
      [field]: current.includes(value) ? current.filter(v => v !== value) : [...current, value],
    };
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, profilePic: 'Please upload an image file' }));
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setErrors(prev => ({ ...prev, profilePic: `File size must be under ${MAX_FILE_SIZE_MB}MB` }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        if (img.width < PROFILE_PIC_SIZE || img.height < PROFILE_PIC_SIZE) {
          setErrors(prev => ({
            ...prev,
            profilePic: `Image must be at least ${PROFILE_PIC_SIZE}x${PROFILE_PIC_SIZE}px (yours is ${img.width}x${img.height}px)`,
          }));
          return;
        }
        setSelectedFile(file);
        setShowCropper(true);
        setErrors(prev => ({ ...prev, profilePic: null }));
      };
      img.src = event.target?.result;
    };
    reader.readAsDataURL(file);
  };

  const removeProfilePic = () => {
    setFormData(prev => ({ ...prev, profilePic: null, profilePicPreview: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropComplete = (croppedImageBase64) => {
    setFormData(prev => ({
      ...prev,
      profilePic: croppedImageBase64,
      profilePicPreview: croppedImageBase64,
    }));
    setShowCropper(false);
    setSelectedFile(null);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.linkedIn.trim()) newErrors.linkedIn = 'LinkedIn profile is required';
    if (!formData.profession.trim()) newErrors.profession = 'Profession is required';
    if (!formData.profilePic) newErrors.profilePic = 'Profile picture is required';
    if (!formData.membershipFormCompleted) newErrors.membershipFormCompleted = 'Please confirm you completed the membership application form';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      const firstError = document.querySelector('.error-field');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setIsSubmitting(true);

    try {
      const linkedIn = formData.linkedIn.trim();
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        // Accept bare "linkedin.com/in/..." without a scheme
        linkedIn: /^https?:\/\//i.test(linkedIn) ? linkedIn : `https://${linkedIn}`,
        profilePic: formData.profilePicPreview,
        profession: formData.profession,
        company: formData.company,
        bio: formData.bio,
        roles: formData.roles,
        lookingFor: formData.lookingFor,
        ...(refCode ? { ref: refCode } : {}),
      };

      const response = await fetch(`${API_URL}/api/community/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit profile');
      }

      setSubmitSuccess(true);
    } catch (error) {
      console.error('Submission error:', error);
      setSubmitError(error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClasses = (field) => `w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 ${
    errors[field] ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-700'
  } focus:border-itc-green focus:ring-2 focus:ring-itc-green/20 outline-none transition-all`;

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4 transition-colors duration-300">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-10 shadow-xl text-center"
        >
          <div className="w-20 h-20 bg-itc-green/10 dark:bg-itc-green/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-itc-green" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Almost There! 📬</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Check your email and click the verification link. Our team then reviews your profile — you'll go live once it's approved.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
            Haven't filled the membership application yet?{' '}
            <a href={MEMBER_FORM_URL} target="_blank" rel="noopener noreferrer" className="text-itc-green font-medium hover:underline">
              Complete it here
            </a>{' '}— it speeds up approval.
          </p>
          <Link
            to="/community"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-colors"
          >
            Meet the Community <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    );
  }

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

      {/* Image Cropper Modal */}
      {showCropper && selectedFile && (
        <ImageCropper
          imageFile={selectedFile}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          outputSize={PROFILE_PIC_SIZE}
        />
      )}

      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[40rem] h-[40rem] bg-itc-green/8 dark:bg-itc-green/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[40rem] h-[40rem] bg-itc-red/8 dark:bg-itc-red/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 pt-20 pb-12 sm:py-20">
        {/* Header */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="text-center mb-12"
        >
          <motion.div variants={item} className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm font-medium mb-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-itc-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-itc-green"></span>
            </span>
            Italian Tech Club NYC
          </motion.div>

          <motion.h1 variants={item} className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
            Join the
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-itc-green to-itc-red"> Community</span>
          </motion.h1>

          <motion.p variants={item} className="text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Create your member profile so others in the Italian Tech Club can find you and connect on LinkedIn.
          </motion.p>

          {refCode && (
            <motion.div variants={item} className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-itc-green/10 border border-itc-green/20 text-itc-green text-sm font-medium">
              <Check className="w-4 h-4" /> You've been invited by a member — your application is fast-tracked.
            </motion.div>
          )}

          <motion.div variants={item} className="mt-8 max-w-xl mx-auto text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
            <p className="text-sm font-bold text-slate-900 dark:text-white mb-3">How joining works</p>
            <ol className="space-y-2 text-sm text-slate-600 dark:text-slate-400 list-decimal list-inside">
              <li>Complete the ITC membership application form.</li>
              <li>Create your profile below and verify your email.</li>
              <li>Our team reviews and approves — then you're live.</li>
            </ol>
            <a
              href={MEMBER_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-itc-green text-white text-sm font-semibold hover:bg-itc-red transition-colors"
            >
              Open Membership Form <ArrowRight className="w-4 h-4" />
            </a>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Already a member?{' '}
              <Link to="/community/manage" className="text-itc-green font-medium hover:underline">
                Claim your existing profile
              </Link>{' '}instead.
            </p>
          </motion.div>
        </motion.div>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-8"
        >
          {/* Profile Picture */}
          <motion.div variants={item} className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-itc-green" />
              Profile Picture
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Upload a clear photo of yourself. Minimum {PROFILE_PIC_SIZE}x{PROFILE_PIC_SIZE}px, max {MAX_FILE_SIZE_MB}MB.
            </p>

            <div className={`relative ${errors.profilePic ? 'error-field' : ''}`}>
              {formData.profilePicPreview ? (
                <div className="relative w-40 h-40 mx-auto">
                  <img
                    src={formData.profilePicPreview}
                    alt="Profile preview"
                    className="w-full h-full object-cover rounded-2xl border-4 border-itc-green/20"
                  />
                  <button
                    type="button"
                    onClick={removeProfilePic}
                    className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl cursor-pointer hover:border-itc-green dark:hover:border-itc-green hover:bg-itc-green/5 dark:hover:bg-itc-green/10 transition-all">
                  <Upload className="w-10 h-10 text-slate-400 mb-3" />
                  <span className="text-slate-600 dark:text-slate-300 font-medium">Click to upload</span>
                  <span className="text-slate-400 text-sm mt-1">PNG, JPG up to {MAX_FILE_SIZE_MB}MB</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
              {errors.profilePic && (
                <p className="mt-3 text-sm text-red-500 text-center flex items-center justify-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {errors.profilePic}
                </p>
              )}
            </div>
          </motion.div>

          {/* Basic Info */}
          <motion.div variants={item} className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-itc-green" />
              About You
            </h2>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div className={errors.firstName ? 'error-field' : ''}>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className={inputClasses('firstName')}
                  placeholder="Mario"
                />
                {errors.firstName && <p className="mt-1 text-sm text-red-500">{errors.firstName}</p>}
              </div>

              <div className={errors.lastName ? 'error-field' : ''}>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className={inputClasses('lastName')}
                  placeholder="Rossi"
                />
                {errors.lastName && <p className="mt-1 text-sm text-red-500">{errors.lastName}</p>}
              </div>
            </div>

            <div className={`mb-4 ${errors.email ? 'error-field' : ''}`}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={inputClasses('email')}
                placeholder="mario@example.com"
              />
              <p className="mt-1 text-xs text-slate-400">Never shown publicly — only used to manage your profile.</p>
              {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
            </div>

            <div className={errors.linkedIn ? 'error-field' : ''}>
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <Linkedin className="w-4 h-4 text-[#0A66C2]" />
                LinkedIn Profile *
              </label>
              <input
                type="text"
                name="linkedIn"
                value={formData.linkedIn}
                onChange={handleInputChange}
                className={inputClasses('linkedIn')}
                placeholder="linkedin.com/in/yourprofile"
              />
              {errors.linkedIn && <p className="mt-1 text-sm text-red-500">{errors.linkedIn}</p>}
            </div>
          </motion.div>

          {/* Professional Info */}
          <motion.div variants={item} className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-itc-green" />
              What You Do
            </h2>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div className={errors.profession ? 'error-field' : ''}>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Profession *</label>
                <input
                  type="text"
                  name="profession"
                  value={formData.profession}
                  onChange={handleInputChange}
                  className={inputClasses('profession')}
                  placeholder="Software Engineer, Product Manager, Founder..."
                />
                {errors.profession && <p className="mt-1 text-sm text-red-500">{errors.profession}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Company</label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  className={inputClasses('company')}
                  placeholder="Where you work (optional)"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Bio</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                placeholder="A few lines about yourself — your background, what you're working on, what you're passionate about..."
                rows={4}
                maxLength={500}
                className={`${inputClasses('bio')} resize-none`}
              />
              <p className="text-xs text-slate-400 text-right mt-1">
                {formData.bio.length}/500
              </p>
            </div>
          </motion.div>

          {/* Community Signals */}
          <motion.div variants={item} className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-itc-green" />
              Community Signals
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Optional, but this is how members find each other — pick what fits and what you're after.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">I am a...</label>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((option) => {
                  const active = formData.roles.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleIn('roles')(option.value)}
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
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">I'm looking for...</label>
              <div className="flex flex-wrap gap-2">
                {LOOKING_FOR_OPTIONS.map((option) => {
                  const active = formData.lookingFor.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleIn('lookingFor')(option.value)}
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
            </div>
          </motion.div>

          {/* Membership form confirmation */}
          <motion.div variants={item} className={`bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border ${errors.membershipFormCompleted ? 'border-red-300 dark:border-red-800 error-field' : 'border-slate-100 dark:border-slate-800'}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.membershipFormCompleted}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, membershipFormCompleted: e.target.checked }));
                  if (errors.membershipFormCompleted) setErrors(prev => ({ ...prev, membershipFormCompleted: null }));
                }}
                className="mt-0.5 w-5 h-5 flex-shrink-0 rounded border-slate-300 dark:border-slate-600 text-itc-green focus:ring-itc-green/30 accent-itc-green"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                I confirm I have already completed the{' '}
                <a href={MEMBER_FORM_URL} target="_blank" rel="noopener noreferrer" className="text-itc-green font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                  ITC membership application form
                </a>. *
              </span>
            </label>
            {errors.membershipFormCompleted && (
              <p className="mt-3 text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> {errors.membershipFormCompleted}
              </p>
            )}
          </motion.div>

          {/* Submit */}
          <motion.div variants={item} className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-lg hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-all flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Create Your Profile
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {submitError && (
              <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-4">
              By submitting, your name, photo, profession, bio, and LinkedIn will be visible on the community page.
            </p>
          </motion.div>
        </motion.form>
      </div>
    </div>
  );
};

export default CommunityJoin;
