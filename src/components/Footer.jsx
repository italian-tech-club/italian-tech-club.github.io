import React from 'react';

const chapters = [
  { name: 'Barcelona', flag: '🇪🇸', url: 'https://www.italiantechclub.com' },
  { name: 'Madrid', flag: '🇪🇸', url: 'https://www.italiantechclub.com' },
  { name: 'Valencia', flag: '🇪🇸', url: 'https://www.italiantechclub.com' },
  { name: 'Berlin', flag: '🇩🇪', url: 'https://www.italiantechclub.com' },
  { name: 'Paris', flag: '🇫🇷', url: 'https://www.italiantechparis.com' },
  { name: 'San Francisco', flag: '🇺🇸', url: 'https://www.italiantechclub.com' },
  { name: 'Amsterdam', flag: '🇳🇱', url: 'https://www.italiantechclub.com' },
  { name: 'London', flag: '🇬🇧', url: 'https://www.italiantechclub.com' },
];

const Footer = () => {
  return (
    <footer className="bg-slate-950 text-slate-400 py-16 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-12">
          
          {/* Brand Section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-4 w-6 opacity-80">
                 <div className="w-1/3 bg-itc-green h-full"></div>
                 <div className="w-1/3 bg-white h-full"></div>
                 <div className="w-1/3 bg-itc-red h-full"></div>
              </div>
              <span className="font-bold text-white tracking-tight">ITC NYC</span>
            </div>
            <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
              Connecting Italian professionals in the world's most vibrant tech ecosystem.
            </p>
          </div>

          {/* Chapters Grid */}
          <div className="flex-1 w-full lg:w-auto">
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-6">Our Chapters</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-y-4 gap-x-8">
              {chapters.map((city) => (
                <a 
                  key={city.name}
                  href={city.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 text-sm hover:text-white transition-colors"
                >
                  <span className="text-base filter grayscale group-hover:grayscale-0 transition-all duration-300">{city.flag}</span>
                  <span>{city.name}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-sm opacity-60">
          <div>
            &copy; {new Date().getFullYear()} Italian Tech Club. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
