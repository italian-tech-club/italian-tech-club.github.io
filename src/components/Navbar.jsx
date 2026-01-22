import React from 'react';
import { motion } from 'framer-motion';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';

const Navbar = () => {
  const { theme } = useTheme();

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
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed w-full bg-white/80 dark:bg-slate-950/80 backdrop-blur-md z-50 border-b border-slate-100 dark:border-slate-800"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex-shrink-0 flex items-center cursor-pointer gap-6" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
            <div className="h-20 flex items-center justify-center overflow-visible">
                <img 
                  src={theme === 'dark' ? "/logo-white.png" : "/logo.png"} 
                  onError={(e) => {
                    // Fallback to logo.png if logo-white.png doesn't exist
                    e.target.onerror = null; 
                    e.target.src = "/logo.png";
                  }}
                  alt="Italian Tech Club" 
                  className="h-[50%] w-auto object-contain max-w-none transition-opacity duration-300" 
                />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white hidden sm:block border-l border-slate-300 dark:border-slate-700 pl-6 py-1">NYC Chapter</span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            {['Who we are', 'What we do', 'Events', 'Team'].map((item) => (
              <a 
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={(e) => scrollToSection(e, item.toLowerCase().replace(/\s+/g, '-'))}
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-itc-green dark:hover:text-itc-green transition-colors"
              >
                {item}
              </a>
            ))}
            <ThemeToggle />
            <a 
              href="https://www.gomry.com/form/Italian-Tech-Club-General-application-form-68uJSn7PbLmevuO2T0c5"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium hover:bg-itc-red dark:hover:bg-itc-red dark:hover:text-white transition-all hover:shadow-lg hover:shadow-itc-red/20 transform hover:-translate-y-0.5"
            >
              Become a Member
            </a>
          </div>
          <div className="md:hidden flex items-center gap-4">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
