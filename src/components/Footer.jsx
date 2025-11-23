import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-slate-950 text-slate-400 py-12 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <div className="flex h-4 w-6 opacity-80">
               <div className="w-1/3 bg-itc-green h-full"></div>
               <div className="w-1/3 bg-white h-full"></div>
               <div className="w-1/3 bg-itc-red h-full"></div>
            </div>
            <span className="font-bold text-white tracking-tight">ITC NYC</span>
          </div>
          
          <div className="text-sm">
            &copy; {new Date().getFullYear()} Italian Tech Club. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

