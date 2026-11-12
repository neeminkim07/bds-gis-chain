export const AUTH_CHANGED_EVENT = 'bds-auth-changed';

export function getAuthToken() {
  return sessionStorage.getItem('bdsAuthToken');
}

export function getCachedUser() {
  try {
    return JSON.parse(sessionStorage.getItem('bdsAuthUser') || 'null');
  } catch {
    return null;
  }
}

export function saveAuthSession(token, user) {
  sessionStorage.setItem('bdsAuthToken', token);
  if (user) sessionStorage.setItem('bdsAuthUser', JSON.stringify(user));
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: user || null }));
}

export function clearAuthSession() {
  sessionStorage.removeItem('bdsAuthToken');
  sessionStorage.removeItem('bdsAuthUser');
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: null }));
}

export async function fetchCurrentUser(token = getAuthToken()) {
  if (!token) throw new Error('Bạn chưa đăng nhập.');
  const response = await fetch('/api/auth/me', {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.error?.message || `API trả về HTTP ${response.status}.`);
  const apiUser = data?.data?.user || data?.user || {};
  return { ...(getCachedUser() || {}), ...apiUser };
}
