import { getAdminIdToken } from './tokenRefresh';

// Use VITE_API_BASE when provided (production). If it's not set at build-time
// (e.g. an accidental omission on Vercel), fall back at runtime to the
// deployed Render server so the frontend doesn't call relative /api/* and
// get 404s from the static site host.
const BUILD_API_BASE = (import.meta.env.VITE_API_BASE as string) || '';
function apiUrl(path: string) {
  // Determine effective base: prefer build-time, otherwise pick a safe runtime fallback
  let effectiveBase = BUILD_API_BASE;
  try {
    if (!effectiveBase) {
      // In local dev we want relative paths; in deployed sites default to Render API
      const host = window?.location?.hostname || '';
      if (host === 'localhost' || host === '127.0.0.1') {
        effectiveBase = '';
      } else {
        effectiveBase = 'https://server-cibp.onrender.com';
      }
    }
  } catch (e) {
    // If anything goes wrong, fall back to build-time value (possibly empty)
    effectiveBase = BUILD_API_BASE;
  }

  if (!effectiveBase) return path;
  // Ensure no double slashes
  return effectiveBase.replace(/\/+$/, '') + (path.startsWith('/') ? path : '/' + path);
}

export async function apiSignup(payload: { name: string; email: string; password: string; tenantKey: string }) {
  const res = await fetch(apiUrl('/auth/signup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Signup failed');
  return res.json();
}

export async function apiLogin(payload: { email: string }) {
  const res = await fetch(apiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Login failed');
  return res.json();
}

/**
 * Fetch wrapper with admin token refresh logic
 * @param url - API endpoint
 * @param options - Fetch options
 * @returns Response object
 */
export async function fetchWithAdminToken(url: string, options: RequestInit = {}): Promise<Response> {
  try {
    // Get fresh admin token
    const token = await getAdminIdToken();

    if (!token) {
      throw new Error('Admin token is missing. Please sign in again.');
    }

    // Attach Authorization header
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);

    // Perform fetch
    const response = await fetch(url, { ...options, headers });

    // Handle 401 Unauthorized
    if (response.status === 401) {
      console.warn('[fetchWithAdminToken] Token expired. Retrying with forced refresh.');
      const refreshedToken = await getAdminIdToken(true);

      if (!refreshedToken) {
        throw new Error('Failed to refresh admin token. Please sign in again.');
      }

      headers.set('Authorization', `Bearer ${refreshedToken}`);
      return fetch(url, { ...options, headers });
    }

    return response;
  } catch (error) {
    console.error('[fetchWithAdminToken] API request failed:', error);
    throw error;
  }
}
