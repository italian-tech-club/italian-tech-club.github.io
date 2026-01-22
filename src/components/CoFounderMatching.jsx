import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Upload, 
  User, 
  Briefcase, 
  Lightbulb, 
  Heart, 
  Sparkles,
  ArrowRight,
  Check,
  AlertCircle,
  X,
  Image as ImageIcon,
  Crop
} from 'lucide-react';
import ImageCropper from './ImageCropper';
import ThemeToggle from './ThemeToggle';

const PROFILE_PIC_SIZE = 400; // Required dimensions in pixels
const MAX_FILE_SIZE_MB = 5;
// In production, use Vercel API. In development, use local Express server
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const ROLE_OPTIONS = [
  { value: 'technical', label: 'Technical', emoji: '👨‍💻', description: 'Engineer, Developer, Data Scientist' },
  { value: 'non-technical', label: 'Non-Technical', emoji: '📊', description: 'Business, Marketing, Operations' },
  { value: 'design', label: 'Design', emoji: '🎨', description: 'Product Design, UX/UI, Creative' },
  { value: 'hybrid', label: 'Hybrid', emoji: '🔀', description: 'Mix of technical & business skills' },
];

const STAGE_OPTIONS = [
  { value: 'idea', label: 'Have an idea', emoji: '💡', description: 'Got a concept, looking for co-founders' },
  { value: 'exploring', label: 'Exploring', emoji: '🔍', description: 'Open to joining the right team' },
  { value: 'building', label: 'Already building', emoji: '🚀', description: 'Working on something, need help' },
  { value: 'experienced', label: 'Serial founder', emoji: '🏆', description: 'Done this before, ready again' },
];

const COMMITMENT_OPTIONS = [
  { value: 'fulltime', label: 'Full-time ready', emoji: '⚡' },
  { value: 'parttime', label: 'Part-time to start', emoji: '🌙' },
  { value: 'depends', label: 'Depends on the opportunity', emoji: '🤔' },
];

const PROMPTS = [
  { id: 'superpower', label: 'My superpower is...', placeholder: 'e.g., "Turning complex problems into simple solutions" or "Getting the first 100 users for any product"', icon: Sparkles },
  { id: 'obsession', label: 'The problem I can\'t stop thinking about...', placeholder: 'e.g., "Why is healthcare billing so broken?" or "How to make sustainable living accessible"', icon: Lightbulb },
  { id: 'cofounder_type', label: 'I\'m the type of co-founder who...', placeholder: 'e.g., "Will be your biggest cheerleader and toughest critic" or "Prefers async work with weekly deep-dives"', icon: User },
  { id: 'looking_for', label: 'I work best with someone who...', placeholder: 'e.g., "Challenges my assumptions respectfully" or "Balances my big-picture thinking with execution"', icon: Heart },
  { id: 'dealbreaker', label: 'A dealbreaker for me is...', placeholder: 'e.g., "Someone who isn\'t transparent about challenges" or "Not willing to do customer discovery"', icon: AlertCircle },
];

const INDUSTRIES = [
  'AI/ML', 'FinTech', 'HealthTech', 'EdTech', 'Climate/Sustainability', 
  'Consumer', 'B2B SaaS', 'E-commerce', 'Real Estate', 'Food & Beverage',
  'Entertainment', 'Travel', 'Social Impact', 'Hardware', 'Open to anything'
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

const CoFounderMatching = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    linkedIn: '',
    role: '',
    stage: '',
    commitment: '',
    industries: [],
    profilePic: null,
    profilePicPreview: null,
    prompts: {
      superpower: '',
      obsession: '',
      cofounder_type: '',
      looking_for: '',
      dealbreaker: '',
    },
    bio: '',
  });
  
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

  const handlePromptChange = (promptId, value) => {
    setFormData(prev => ({
      ...prev,
      prompts: { ...prev.prompts, [promptId]: value }
    }));
  };

  const handleRoleSelect = (role) => {
    setFormData(prev => ({ ...prev, role }));
    if (errors.role) setErrors(prev => ({ ...prev, role: null }));
  };

  const handleStageSelect = (stage) => {
    setFormData(prev => ({ ...prev, stage }));
    if (errors.stage) setErrors(prev => ({ ...prev, stage: null }));
  };

  const handleCommitmentSelect = (commitment) => {
    setFormData(prev => ({ ...prev, commitment }));
  };

  const handleIndustryToggle = (industry) => {
    setFormData(prev => {
      const industries = prev.industries.includes(industry)
        ? prev.industries.filter(i => i !== industry)
        : [...prev.industries, industry];
      return { ...prev, industries };
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, profilePic: 'Please upload an image file' }));
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setErrors(prev => ({ ...prev, profilePic: `File size must be under ${MAX_FILE_SIZE_MB}MB` }));
      return;
    }

    // Validate minimum dimensions before opening cropper
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        if (img.width < PROFILE_PIC_SIZE || img.height < PROFILE_PIC_SIZE) {
          setErrors(prev => ({ 
            ...prev, 
            profilePic: `Image must be at least ${PROFILE_PIC_SIZE}x${PROFILE_PIC_SIZE}px (yours is ${img.width}x${img.height}px)` 
          }));
          return;
        }
        // Open cropper
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
      profilePicPreview: croppedImageBase64
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
    if (!formData.role) newErrors.role = 'Please select your role';
    if (!formData.stage) newErrors.stage = 'Please select your current stage';
    if (!formData.profilePic) newErrors.profilePic = 'Profile picture is required';
    
    // Validate at least 3 prompts are filled
    const filledPrompts = Object.values(formData.prompts).filter(p => p.trim().length > 0);
    if (filledPrompts.length < 3) {
      newErrors.prompts = 'Please answer at least 3 prompts';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    
    if (!validateForm()) {
      // Scroll to first error
      const firstError = document.querySelector('.error-field');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Prepare payload with base64 image
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        linkedIn: formData.linkedIn,
        profilePic: formData.profilePicPreview, // Base64 string
        role: formData.role,
        stage: formData.stage,
        commitment: formData.commitment,
        industries: formData.industries,
        prompts: formData.prompts,
        bio: formData.bio,
      };

      const response = await fetch(`${API_URL}/api/cofounder/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">You're In! 🎉</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Thanks for submitting your profile! We'll review your application and match you with potential co-founders from the Italian Tech Club community.
          </p>
          <a 
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-colors"
          >
            Back to Homepage
          </a>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      {/* Image Cropper Modal */}
      {showCropper && selectedFile && (
        <ImageCropper
          imageFile={selectedFile}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}

      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[40rem] h-[40rem] bg-itc-green/8 dark:bg-itc-green/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[40rem] h-[40rem] bg-itc-red/8 dark:bg-itc-red/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 w-[40rem] h-[40rem] bg-amber-100/50 dark:bg-amber-900/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-12 sm:py-20">
        {/* Header */}
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="text-center mb-12"
        >
          <motion.div variants={item} className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm font-medium mb-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-itc-red opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-itc-red"></span>
            </span>
            Italian Tech Club NYC
          </motion.div>
          
          <motion.h1 variants={item} className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
            Find Your 
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-itc-green to-itc-red"> Co-Founder</span>
          </motion.h1>
          
          <motion.p variants={item} className="text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            The best startups are built by great teams. Tell us about yourself, and we'll help you find your perfect match from the Italian Tech community.
          </motion.p>
        </motion.div>

        {/* Form */}
        <motion.form 
          onSubmit={handleSubmit}
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-8"
        >
          {/* Profile Picture Section */}
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

          {/* Basic Info Section */}
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
                  className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 ${errors.firstName ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-700'} focus:border-itc-green focus:ring-2 focus:ring-itc-green/20 outline-none transition-all`}
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
                  className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 ${errors.lastName ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-700'} focus:border-itc-green focus:ring-2 focus:ring-itc-green/20 outline-none transition-all`}
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
                className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 ${errors.email ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-700'} focus:border-itc-green focus:ring-2 focus:ring-itc-green/20 outline-none transition-all`}
                placeholder="mario@example.com"
              />
              {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
            </div>

            <div className={errors.linkedIn ? 'error-field' : ''}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">LinkedIn Profile *</label>
              <input
                type="url"
                name="linkedIn"
                value={formData.linkedIn}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 ${errors.linkedIn ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-700'} focus:border-itc-green focus:ring-2 focus:ring-itc-green/20 outline-none transition-all`}
                placeholder="https://linkedin.com/in/yourprofile"
              />
              {errors.linkedIn && <p className="mt-1 text-sm text-red-500">{errors.linkedIn}</p>}
            </div>
          </motion.div>

          {/* Role Selection */}
          <motion.div variants={item} className={`bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800 ${errors.role ? 'error-field' : ''}`}>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-itc-green" />
              What's Your Role? *
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Select the role that best describes your skill set</p>
            
            <div className="grid sm:grid-cols-2 gap-3">
              {ROLE_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleRoleSelect(option.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    formData.role === option.value 
                      ? 'border-itc-green bg-itc-green/5 dark:bg-itc-green/10' 
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span className="text-2xl mb-2 block">{option.emoji}</span>
                  <span className="font-semibold text-slate-900 dark:text-white block">{option.label}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">{option.description}</span>
                </button>
              ))}
            </div>
            {errors.role && <p className="mt-3 text-sm text-red-500">{errors.role}</p>}
          </motion.div>

          {/* Stage Selection */}
          <motion.div variants={item} className={`bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800 ${errors.stage ? 'error-field' : ''}`}>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-itc-green" />
              Where Are You At? *
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">What's your current entrepreneurial stage?</p>
            
            <div className="grid sm:grid-cols-2 gap-3">
              {STAGE_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleStageSelect(option.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    formData.stage === option.value 
                      ? 'border-itc-green bg-itc-green/5 dark:bg-itc-green/10' 
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span className="text-2xl mb-2 block">{option.emoji}</span>
                  <span className="font-semibold text-slate-900 dark:text-white block">{option.label}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">{option.description}</span>
                </button>
              ))}
            </div>
            {errors.stage && <p className="mt-3 text-sm text-red-500">{errors.stage}</p>}
          </motion.div>

          {/* Commitment Level */}
          <motion.div variants={item} className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Your Availability</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">How much time can you commit?</p>
            
            <div className="flex flex-wrap gap-3">
              {COMMITMENT_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleCommitmentSelect(option.value)}
                  className={`px-5 py-3 rounded-full border-2 font-medium transition-all ${
                    formData.commitment === option.value 
                      ? 'border-itc-green bg-itc-green text-white' 
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {option.emoji} {option.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Industries */}
          <motion.div variants={item} className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Industries of Interest</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Select all that excite you</p>
            
            <div className="flex flex-wrap gap-2">
              {INDUSTRIES.map(industry => (
                <button
                  key={industry}
                  type="button"
                  onClick={() => handleIndustryToggle(industry)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    formData.industries.includes(industry)
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {industry}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Hinge-Style Prompts */}
          <motion.div variants={item} className={`bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800 ${errors.prompts ? 'error-field' : ''}`}>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-itc-green" />
              Tell Us More
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Answer at least 3 prompts to help us find your perfect match
            </p>
            
            <div className="space-y-6">
              {PROMPTS.map(prompt => {
                const Icon = prompt.icon;
                return (
                  <div key={prompt.id}>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                      <Icon className="w-4 h-4 text-itc-green" />
                      {prompt.label}
                    </label>
                    <textarea
                      value={formData.prompts[prompt.id]}
                      onChange={(e) => handlePromptChange(prompt.id, e.target.value)}
                      placeholder={prompt.placeholder}
                      rows={3}
                      maxLength={300}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-itc-green focus:ring-2 focus:ring-itc-green/20 outline-none transition-all resize-none"
                    />
                    <p className="text-xs text-slate-400 text-right mt-1">
                      {formData.prompts[prompt.id].length}/300
                    </p>
                  </div>
                );
              })}
            </div>
            {errors.prompts && (
              <p className="mt-3 text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> {errors.prompts}
              </p>
            )}
          </motion.div>

          {/* Short Bio */}
          <motion.div variants={item} className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Anything Else?</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Share anything else you'd like potential co-founders to know
            </p>
            
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              placeholder="Your background, achievements, what makes you unique, or anything else..."
              rows={4}
              maxLength={500}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-itc-green focus:ring-2 focus:ring-itc-green/20 outline-none transition-all resize-none"
            />
            <p className="text-xs text-slate-400 text-right mt-1">
              {formData.bio.length}/500
            </p>
          </motion.div>

          {/* Submit Button */}
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
                  Submit Your Profile
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
              By submitting, you agree to be contacted by Italian Tech Club NYC for co-founder matching purposes.
            </p>
          </motion.div>
        </motion.form>
      </div>
    </div>
  );
};

export default CoFounderMatching;
