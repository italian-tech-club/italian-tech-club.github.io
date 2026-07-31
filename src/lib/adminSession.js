// Admin session persistence. Mirrors memberSession: localStorage, so the panel
// survives a tab close (the server session lives 30 days and renews itself
// while in use). `via` records which sign-in produced the token — an admin
// magic link, or a member session whose email is on the admin allowlist.
const STORAGE_KEY = 'itc_admin_session';

export function getAdminSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.token || (session.expiresAt && new Date(session.expiresAt) <= new Date())) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setAdminSession({ token, expiresAt, email, via = 'admin' }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, expiresAt, email, via }));
  } catch {
    // Storage unavailable (private mode) — session just won't persist.
  }
}

export function clearAdminSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function adminAuthHeaders() {
  const session = getAdminSession();
  return session ? { Authorization: `Bearer ${session.token}` } : {};
}
