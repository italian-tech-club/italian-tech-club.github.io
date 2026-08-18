import React, { useState } from 'react';

// Picture for an ecosystem organization, best available:
//   1. a logo committed to the repo (only for orgs we have assets for), in the
//      variant that survives the current theme,
//   2. the site's own favicon, resolved at render time,
//   3. a monogram, so a row never renders as an empty square.
//
// Deliberately not used inside the graph itself — at node size a favicon is mush,
// and the map reads better as clean dots.

const initials = (org) =>
  (org.short || org.name)
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

const faviconFor = (url) => {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=128`;
  } catch {
    return null;
  }
};

const EcosystemLogo = ({ org, theme, className = '', size = 'h-12 w-12' }) => {
  // Which source failed, not whether one did: switching theme swaps the asset,
  // and a boolean would keep the replacement hidden too.
  const [broken, setBroken] = useState(null);
  // A one-colour mark needs both variants or it disappears into one of the two
  // themes; `logoDark` is only set where the light one is too dark to survive.
  const asset = (theme === 'dark' && org.logoDark) || org.logo;
  const source = asset || (org.url ? faviconFor(org.url) : null);
  const showImage = source && broken !== source;

  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 ${
        org.logoOnDark ? 'bg-slate-900' : 'bg-white'
      } dark:border-slate-700 ${org.logoOnDark ? 'dark:bg-slate-900' : 'dark:bg-slate-800'} ${className}`}
    >
      {showImage ? (
        <img
          src={source}
          alt=""
          loading="lazy"
          onError={() => setBroken(source)}
          className="h-2/3 w-2/3 object-contain"
        />
      ) : (
        <span className="font-display text-xs font-bold tracking-tight text-slate-500 dark:text-slate-400">
          {initials(org)}
        </span>
      )}
    </span>
  );
};

export default EcosystemLogo;
