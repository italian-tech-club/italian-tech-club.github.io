import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { COMMUNITY_ENABLED } from '../config';
import { EASE } from '../lib/motion';

const NAV_ITEMS = ['Who we are', 'What we do', 'Events', 'Team', ...(COMMUNITY_ENABLED ? ['Community'] : []), 'Sponsor'];

const MEMBER_FORM_URL = 'https://www.gomry.com/form/Italian-Tech-Club-General-application-form-68uJSn7PbLmevuO2T0c5';

const Navbar = () => {
  const { theme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToSection = (e, id) => {
    e.preventDefault();
    setMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: EASE }}
      className={`fixed w-full z-50 backdrop-blur-md transition-[background-color,box-shadow,border-color] duration-300 ease-out-quint border-b ${
        scrolled
          ? 'bg-white/90 dark:bg-slate-950/90 border-slate-200/80 dark:border-slate-800 shadow-sm shadow-slate-900/5'
          : 'bg-white/70 dark:bg-slate-950/70 border-transparent'
      }`}
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

          {/* Desktop nav */}
          <div className="hidden md:flex items-center space-x-8">
            {NAV_ITEMS.map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={(e) => scrollToSection(e, item.toLowerCase().replace(/\s+/g, '-'))}
                className="relative text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors duration-300 group py-1"
              >
                {item}
                <span className="absolute left-0 -bottom-0.5 h-px w-full origin-left scale-x-0 group-hover:scale-x-100 bg-itc-green transition-transform duration-300 ease-out-quint" />
              </a>
            ))}
            <ThemeToggle />
            <a
              href={MEMBER_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium hover:bg-itc-red dark:hover:bg-itc-red dark:hover:text-white transition-all duration-300 ease-out-quint hover:shadow-lg hover:shadow-itc-red/20 hover:-translate-y-0.5"
            >
              Become a Member
            </a>
          </div>

          {/* Mobile controls */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-300"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="md:hidden overflow-hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800"
          >
            <div className="px-4 py-4 flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={(e) => scrollToSection(e, item.toLowerCase().replace(/\s+/g, '-'))}
                  className="px-4 py-3 rounded-xl text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-itc-green dark:hover:text-itc-green transition-colors duration-200"
                >
                  {item}
                </a>
              ))}
              <a
                href={MEMBER_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 px-4 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-base font-semibold text-center hover:bg-itc-red dark:hover:bg-itc-red dark:hover:text-white transition-colors duration-300"
              >
                Become a Member
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
