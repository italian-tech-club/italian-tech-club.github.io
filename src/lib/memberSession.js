import { getAdminSession } from './adminSession';

// Member session persistence. The token is issued by the manage magic-link
// flow (GET /api/community/manage?token=) and unlocks the full directory +
// member-only actions for 30 days.
const STORAGE_KEY = 'itc_member_session';

export function getMemberSession() {
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

export function setMemberSession({ token, expiresAt, member }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, expiresAt, member }));
  } catch {
    // Storage unavailable (private mode) — session just won't persist.
  }
}

export function clearMemberSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Whatever token unlocks the community for this browser: the member session, or
// an admin session (the API resolves it to that admin's own profile).
export function getCommunitySession() {
  return getMemberSession() || getAdminSession();
}

export function memberAuthHeaders() {
  const session = getCommunitySession();
  return session ? { Authorization: `Bearer ${session.token}` } : {};
}
