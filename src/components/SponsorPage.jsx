import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Handshake,
  ArrowRight,
  Check,
  AlertCircle,
  Building2,
  Megaphone,
  MapPin,
  Gift,
  Repeat,
  UtensilsCrossed,
  Home,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SPONSORSHIP_OPTIONS = [
  { value: 'event', label: 'Sponsor an event', icon: Megaphone },
  { value: 'venue', label: 'Provide a venue', icon: MapPin },
  { value: 'food-drinks', label: 'Food & drinks', icon: UtensilsCrossed },
  { value: 'prizes', label: 'Prizes / swag', icon: Gift },
  { value: 'recurring', label: 'Recurring partnership', icon: Repeat },
];

const PERKS = [
  'Brand visibility with 500+ Italian tech professionals in NYC',
  'Speaking opportunities at our events',
  'Direct access to founders, engineers, and operators',
  'Logo on event materials and our website',
];

const SponsorPage = () => {
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    website: '',
    sponsorshipType: 'event',
    message: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.companyName.trim()) newErrors.companyName = 'Company name is required';
    if (!formData.contactName.trim()) newErrors.contactName = 'Contact name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.message.trim()) newErrors.message = 'Tell us a bit about your idea';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const website = formData.website.trim();
      const payload = {
        ...formData,
        // Accept bare domains like "acme.com"
        website: website && !/^https?:\/\//i.test(website) ? `https://${website}` : website,
      };
      const response = await fetch(`${API_URL}/api/sponsor/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit inquiry');
      }
      setSubmitSuccess(true);
    } catch (error) {
      console.error('Sponsor inquiry error:', error);
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
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Grazie! 🇮🇹</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            We received your inquiry and will get back to you at <span className="font-medium">{formData.email}</span> soon.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-colors"
          >
            Back to Homepage
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

      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[40rem] h-[40rem] bg-itc-green/8 dark:bg-itc-green/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[40rem] h-[40rem] bg-itc-red/8 dark:bg-itc-red/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left: pitch */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-itc-green/10 text-itc-green text-sm font-medium mb-6">
              <Handshake className="w-4 h-4" />
              Partner with us
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
              Sponsor an
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-itc-green to-itc-red"> ITC Event</span>
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
              Want to put your company in front of the Italian tech community in New York?
              Partner with us on one of our upcoming events — from aperitivo networking nights to tech talks and demo days.
            </p>
            <ul className="space-y-4">
              {PERKS.map((perk) => (
                <li key={perk} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-itc-green/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 text-itc-green" />
                  </div>
                  <span className="text-slate-700 dark:text-slate-300">{perk}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Right: form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6, ease: 'easeOut' }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-itc-green" />
                Sponsorship Inquiry
              </h3>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Company *</label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleInputChange}
                    className={inputClasses('companyName')}
                    placeholder="Acme Inc."
                  />
                  {errors.companyName && <p className="mt-1 text-sm text-red-500">{errors.companyName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Your Name *</label>
                  <input
                    type="text"
                    name="contactName"
                    value={formData.contactName}
                    onChange={handleInputChange}
                    className={inputClasses('contactName')}
                    placeholder="Mario Rossi"
                  />
                  {errors.contactName && <p className="mt-1 text-sm text-red-500">{errors.contactName}</p>}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Work Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={inputClasses('email')}
                    placeholder="mario@acme.com"
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Website</label>
                  <input
                    type="text"
                    name="website"
                    value={formData.website}
                    onChange={handleInputChange}
                    className={inputClasses('website')}
                    placeholder="acme.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">How would you like to collaborate?</label>
                <div className="flex flex-wrap gap-2">
                  {SPONSORSHIP_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, sponsorshipType: option.value }))}
                        className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                          formData.sponsorshipType === option.value
                            ? 'bg-itc-green text-white'
                            : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-itc-green/50'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Message *</label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  rows={4}
                  maxLength={2000}
                  className={`${inputClasses('message')} resize-none`}
                  placeholder="Tell us about your company and how you'd like to collaborate with the Italian Tech Club..."
                />
                {errors.message && <p className="mt-1 text-sm text-red-500">{errors.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:bg-itc-green dark:hover:bg-itc-green dark:hover:text-white transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    Send Inquiry
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {submitError && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                Your inquiry goes straight to ciao@italiantechclubnyc.com
              </p>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default SponsorPage;
