import React from 'react';

// A partner's logo on the tile its asset needs. Some logos are light-on-dark
// variants, so the tile follows `logoOnDark` rather than the page theme —
// otherwise a white wordmark disappears in light mode.
const PartnerLogo = ({ partner, className = '', imageClassName = 'max-h-12' }) => (
  <div
    className={`flex items-center justify-center rounded-2xl px-6 py-5 ${
      partner.logoOnDark
        ? 'bg-slate-900 dark:bg-black'
        : 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
    } ${className}`}
  >
    <img src={partner.logo} alt={partner.name} className={`${imageClassName} w-auto object-contain`} />
  </div>
);

export default PartnerLogo;
