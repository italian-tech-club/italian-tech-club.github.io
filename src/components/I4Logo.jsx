import React from 'react';

// The I⁴ mark, drawn in I³/NYC's own geometry rather than set in a typeface.
// Their "I" is a plain slab bar and their exponent sits nearly at cap height,
// so a font-set "I⁴" reads as a different family entirely. The bar, the slash
// and the NYC letterforms are their exact outlines, lifted from i3nyc.svg; only
// the exponent is new — a geometric 4 built to the same metrics as their 3
// (cap height 130, baseline 141, 24-wide stem, 21-wide diagonal).
//
// Everything stays in their 246-unit coordinate space, so the proportions hold
// at any size. Ink is currentColor; exponent and slash carry I³'s purple.

const I_BAR = 'M36.1836 63.6425V189.763H11.3074V63.6425H36.1836Z';
// Outer contour then counter, filled even-odd: stem, crossbar, diagonal, hole.
const FOUR = 'M118.5 11H142.5V141H118.5V120H46L118.5 11Z M87.19 96L118.5 48.94V96H87.19Z';
const SLASH = 'M170.786 188.952H143.748L204.089 59.2236H231.127L170.786 188.952Z';
const NYC = 'M372.876 189.281H339.304L286.962 89.4687V189.281H262.595V58.4242H296.167L348.509 158.236V58.4242H372.876V189.281ZM382.66 58.4242H412.802L443.305 113.113L474.35 58.4242H503.77L455.579 138.743V189.281H429.769V138.382L382.66 58.4242ZM592.699 146.324H617.246C613.817 172.856 591.797 191.627 560.572 191.627C521.585 191.627 499.385 165.095 499.385 123.221C499.385 81.8881 523.21 56.0778 561.293 56.0778C591.977 56.0778 612.914 73.5855 617.246 100.84H592.699C587.826 82.6101 575.552 76.6538 561.113 76.6538C541.439 76.6538 526.098 92.8981 526.098 123.221C526.098 154.446 541.439 171.051 560.211 171.051C575.913 171.051 588.367 164.192 592.699 146.324Z';

// Tight boxes: the bare mark ends where the 4 does, the lockup where the C does.
const VIEW_BOX = { mark: '4 4 146 192', lockup: '4 4 621 192' };

const I4Logo = ({ className = '', showNyc = false }) => (
  <svg
    viewBox={showNyc ? VIEW_BOX.lockup : VIEW_BOX.mark}
    className={className}
    role="img"
    aria-label={showNyc ? 'I⁴/NYC' : 'I⁴'}
    fill="none"
  >
    <path d={I_BAR} fill="currentColor" />
    <path d={FOUR} fillRule="evenodd" clipRule="evenodd" className="fill-i3-purple dark:fill-i3-purpleLit" />
    {showNyc && (
      <>
        <path d={SLASH} className="fill-i3-purple dark:fill-i3-purpleLit" />
        <path d={NYC} fill="currentColor" />
      </>
    )}
  </svg>
);

export default I4Logo;
