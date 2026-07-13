import React from 'react';

// Small uppercase label with a mini tricolor dash — shared section opener.
const SectionEyebrow = ({ children, className = '' }) => (
  <span
    className={`inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 ${className}`}
  >
    <span className="flex h-[5px] w-6 overflow-hidden rounded-full" aria-hidden="true">
      <span className="w-1/3 bg-itc-green" />
      <span className="w-1/3 bg-slate-300 dark:bg-slate-600" />
      <span className="w-1/3 bg-itc-red" />
    </span>
    {children}
  </span>
);

export default SectionEyebrow;
