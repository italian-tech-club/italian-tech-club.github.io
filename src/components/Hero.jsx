import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const Hero = () => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 30 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 1,
        ease: [0.22, 1, 0.36, 1]
      }
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden bg-slate-50">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
         <div className="absolute -top-40 -left-40 w-[40rem] h-[40rem] bg-itc-green/10 rounded-full blur-3xl mix-blend-multiply animate-blob opacity-70" />
         <div className="absolute top-0 -right-40 w-[40rem] h-[40rem] bg-itc-red/10 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-2000 opacity-70" />
         <div className="absolute -bottom-40 left-20 w-[40rem] h-[40rem] bg-slate-200/50 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-4000 opacity-70" />
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.div 
            variants={item}
            className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-white text-slate-600 text-sm font-medium mb-8 border border-slate-200 shadow-sm hover:border-itc-green/50 transition-colors"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-itc-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-itc-green"></span>
            </span>
            First ITC Chapter in the USA 🇺🇸
          </motion.div>

          <motion.h1 variants={item} className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-8 leading-[1.1]">
            The Italian Tech Club <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-itc-green via-slate-900 to-itc-red bg-300% animate-gradient">
              New York City
            </span>
          </motion.h1>

          <motion.p variants={item} className="mt-6 text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
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
              className="group px-8 py-4 rounded-full bg-slate-900 text-white font-semibold hover:bg-itc-red transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 hover:shadow-itc-red/30 hover:-translate-y-1"
            >
              Become a Member
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <a href="#who-we-are" className="px-8 py-4 rounded-full bg-white text-slate-700 font-semibold border border-slate-200 hover:border-itc-green hover:text-itc-green transition-all shadow-sm hover:shadow-md flex items-center justify-center hover:-translate-y-1">
              Discover More
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
