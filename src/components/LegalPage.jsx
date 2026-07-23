import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

// Shared layout for static legal pages (Privacy Policy, Terms of Service).
const LegalPage = ({ title, lastUpdated, children }) => {
  useEffect(() => {
    document.title = `${title} · Italian Tech Club NYC`;
  }, [title]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-20">
        <Link
          to="/"
          className="p-3 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-itc-green dark:hover:text-itc-green transition-all shadow-sm hover:shadow-md"
        >
          <Home className="w-5 h-5" />
        </Link>
        <ThemeToggle className="shadow-sm hover:shadow-md" />
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-24 pb-20">
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-10">Last updated: {lastUpdated}</p>

        <div className="prose-legal space-y-6 text-slate-700 dark:text-slate-300 leading-relaxed [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-900 dark:[&_h2]:text-white [&_h2]:mt-8 [&_h2]:mb-3 [&_a]:text-itc-green [&_a]:font-medium hover:[&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1">
          {children}
        </div>
      </div>
    </div>
  );
};

export default LegalPage;
