import React from 'react';
import { motion } from 'framer-motion';

const Navbar = () => {
  const scrollToSection = (e, id) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed w-full bg-white/80 backdrop-blur-md z-50 border-b border-slate-100"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex-shrink-0 flex items-center cursor-pointer gap-6" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
            <div className="h-20 flex items-center justify-center overflow-visible">
                <img src="/logo.png" alt="Italian Tech Club" className="h-[50%] w-auto object-contain max-w-none" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900 hidden sm:block border-l border-slate-300 pl-6 py-1">NYC Chapter</span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            {['Who we are', 'What we do', 'Events'].map((item) => (
              <a 
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={(e) => scrollToSection(e, item.toLowerCase().replace(/\s+/g, '-'))}
                className="text-sm font-medium text-slate-600 hover:text-itc-green transition-colors"
              >
                {item}
              </a>
            ))}
            <a 
              href="https://www.gomry.com/form/Italian-Tech-Club-General-application-form-68uJSn7PbLmevuO2T0c5"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-itc-red transition-all hover:shadow-lg hover:shadow-itc-red/20 transform hover:-translate-y-0.5"
            >
              Become a Member
            </a>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
