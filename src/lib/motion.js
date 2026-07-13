// Shared motion system — one easing curve and one reveal language for the whole site.
// Every scroll reveal uses the same soft rise; hovers use springs. Keep it boring here
// so the pages feel calm and consistent.

// easeOutQuint-style curve: fast start, long gentle settle. Never bounces.
export const EASE = [0.22, 1, 0.36, 1];

export const VIEWPORT = { once: true, margin: '-80px' };

// Standard scroll reveal: soft fade + short rise. No slides from the sides.
export const fadeRise = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE },
  },
};

// Container that staggers fadeRise children.
export const staggerContainer = (staggerChildren = 0.08, delayChildren = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren, delayChildren } },
});

// Gentle spring for hover/tap micro-interactions on buttons and cards.
export const hoverSpring = { type: 'spring', stiffness: 400, damping: 28 };

// Props for a lift-on-hover interactive element (buttons, CTAs).
export const lift = {
  whileHover: { y: -3 },
  whileTap: { scale: 0.97 },
  transition: hoverSpring,
};
