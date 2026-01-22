import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.3,
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut"
    }
  }
};

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
         {/* Green Blob */}
         <div className="absolute -top-40 -left-40 w-[40rem] h-[40rem] animate-blob mix-blend-multiply dark:mix-blend-normal opacity-70"
              style={{ background: 'radial-gradient(circle, rgba(0,146,70,0.2) 0%, rgba(0,146,70,0) 70%)' }}>
         </div>
         {/* Red Blob */}
         <div className="absolute top-0 -right-40 w-[40rem] h-[40rem] animate-blob animation-delay-2000 mix-blend-multiply dark:mix-blend-normal opacity-70"
              style={{ background: 'radial-gradient(circle, rgba(206,43,55,0.2) 0%, rgba(206,43,55,0) 70%)' }}>
         </div>
         {/* Slate Blob */}
         <div className="absolute -bottom-40 left-20 w-[40rem] h-[40rem] animate-blob animation-delay-4000 mix-blend-multiply dark:mix-blend-normal opacity-70"
              style={{ background: 'radial-gradient(circle, rgba(148,163,184,0.2) 0%, rgba(148,163,184,0) 70%)' }}>
         </div>
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.div 
            variants={item}
            className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm font-medium mb-8 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-itc-green/50 dark:hover:border-itc-green/50 transition-colors"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-itc-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-itc-green"></span>
            </span>
            First ITC Chapter in the USA 🇺🇸
          </motion.div>

          <motion.h1 variants={item} className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-8 leading-[1.1]">
            The Italian Tech Club <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-itc-green via-slate-900 to-itc-red dark:from-itc-green dark:via-white dark:to-itc-red bg-300% animate-gradient">
              New York City
            </span>
          </motion.h1>

          <motion.p variants={item} className="mt-6 text-xl md:text-2xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
            The exclusive community for Italian tech professionals, founders, and investors living in the city that never sleeps.
          </motion.p>

          <motion.div 
            variants={item}
            className="mt-12 flex flex-col sm:flex-row justify-center gap-4"
          >
            <a 
              href="https://www.gomry.com/form/Italian-Tech-Club-General-application-form-68uJSn7PbLmevuO2T0c5"
              target="_blank"
              rel="noopener noreferrer"
              className="group px-8 py-4 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:bg-itc-red dark:hover:bg-itc-red dark:hover:text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 hover:shadow-itc-red/30 hover:-translate-y-1"
            >
              Become a Member
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <a href="#who-we-are" className="px-8 py-4 rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-800 hover:border-itc-green dark:hover:border-itc-green hover:text-itc-green dark:hover:text-itc-green transition-all shadow-sm hover:shadow-md flex items-center justify-center hover:-translate-y-1">
              Discover More
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
