// Feature flags (build-time). Set in .env / Vercel env vars.
// Community pages are hidden until the feature is ready for launch.
export const COMMUNITY_ENABLED = import.meta.env.VITE_COMMUNITY_ENABLED === 'true';
