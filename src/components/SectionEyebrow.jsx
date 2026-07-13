import React from 'react';

// Small uppercase label with a mini tricolor dash — shared section opener.
const SectionEyebrow = ({ children, className = '' }) => (
  <span
    className={`inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 ${className}`}
  >
    <span className="flex h-[5px] w-6 overflow-hidden rounded-full ring-1 ring-inset ring-slate-900/10 dark:ring-white/10" aria-hidden="true">
      <span className="w-1/3 bg-itc-green" />
      <span className="w-1/3 bg-itc-white" />
      <span className="w-1/3 bg-itc-red" />
    </span>
    {children}
  </span>
);

export default SectionEyebrow;
