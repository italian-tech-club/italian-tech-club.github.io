import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Share2, Home, Check, Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { motion, AnimatePresence } from 'framer-motion';

const WhatsAppQR = () => {
  const whatsappLink = "https://chat.whatsapp.com/CllWSRvWX49GbLT7dGlSTm?mode=gi_t";
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Italian Tech Club WhatsApp',
          text: 'Join our WhatsApp community!',
          url: whatsappLink,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(whatsappLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center overflow-hidden relative transition-colors duration-300">
      {/* Background Blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[40rem] h-[40rem] bg-itc-green/10 dark:bg-itc-green/20 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-normal animate-blob opacity-70" />
        <div className="absolute top-0 -right-40 w-[35rem] h-[35rem] bg-itc-red/10 dark:bg-itc-red/20 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-normal animate-blob animation-delay-2000 opacity-70" />
        <div className="absolute -bottom-40 left-20 w-[30rem] h-[30rem] bg-slate-200/50 dark:bg-slate-800/50 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-normal animate-blob animation-delay-4000 opacity-70" />
      </div>

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

      {/* Main Content */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex flex-col items-center justify-center p-6 w-full max-w-md"
      >
        
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-800 transform hover:scale-[1.01] transition-transform duration-300 w-full">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Join our WhatsApp
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Scan to join the Italian Tech Club community
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 mb-8 mx-auto w-fit shadow-inner relative group">
            <QRCodeSVG 
              value={whatsappLink}
              size={240}
              level="H"
              includeMargin={true}
              imageSettings={{
                src: "/favicon.png",
                x: undefined,
                y: undefined,
                height: 48,
                width: 48,
                excavate: true,
              }}
              className="w-full h-full"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a 
              href={whatsappLink}
              className="flex items-center justify-center bg-itc-green hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-itc-green/20 active:scale-95"
            >
              Join Group
            </a>
            <button 
              onClick={handleShare}
              className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-3 px-6 rounded-xl transition-all duration-200 active:scale-95"
            >
              {copied ? <Check className="w-4 h-4 text-itc-green" /> : <Share2 className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>
        </div>

        <Link 
          to="/" 
          className="mt-8 flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </Link>
      </motion.div>

      {/* Italian Flag Stripe */}
      <div className="fixed bottom-0 left-0 right-0 h-1.5 flex">
        <div className="flex-1 bg-itc-green" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-itc-red" />
      </div>
    </div>
  );
};

export default WhatsAppQR;
