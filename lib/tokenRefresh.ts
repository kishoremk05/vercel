/**
 * Firebase Token Auto-Refresh Utility
 * Automatically refreshes expired Firebase ID tokens before API calls
 */

import { getFirebaseAuth } from './firebaseClient';

/**
 * Get a fresh Firebase ID token, refreshing if necessary
 * @param forceRefresh - Force token refresh even if not expired
 * @returns Fresh ID token or null if not authenticated
 */
export async function getFreshIdToken(forceRefresh = false): Promise<string | null> {
  try {
    const auth = getFirebaseAuth();
    const user = auth?.currentUser;
    
    if (!user) {
      // No firebase client-side user available. Fall back to any token stored
      // in localStorage (useful for demo/local dev flows where we store a
      // token manually). This is a safe fallback for dev only.
      const fallback = localStorage.getItem('adminToken') || null;
      if (fallback) {
        console.warn('[tokenRefresh] No authenticated user found - using localStorage fallback token');
        return fallback;
      }
      console.warn('[tokenRefresh] No authenticated user found');
      return null;
    }

    // Get fresh token (Firebase SDK handles caching and auto-refresh)
    const idToken = await user.getIdToken(forceRefresh);
    
    // Update localStorage
    if (idToken) {
      localStorage.setItem('adminToken', idToken);
      console.log('[tokenRefresh] ✅ Token refreshed successfully');
    }
    
    return idToken;
  } catch (error) {
    console.error('[tokenRefresh] Failed to refresh token:', error);
    return null;
  }
}

/**
 * Get a fresh Firebase ID token for admin, refreshing if necessary
 * @param forceRefresh - Force token refresh even if not expired
 * @returns Fresh ID token or null if not authenticated
 */
export async function getAdminIdToken(forceRefresh = false): Promise<string | null> {
  try {
    const auth = getFirebaseAuth();
    const user = auth?.currentUser;

    if (!user) {
      // Fallback to localStorage token for dev/demo flows
      const fallback = localStorage.getItem('adminToken') || null;
      if (fallback) {
        console.warn('[tokenRefresh] No authenticated admin user - using localStorage fallback token');
        return fallback;
      }
      console.warn('[tokenRefresh] No authenticated admin user found');
      return null;
    }

    // Get fresh token (Firebase SDK handles caching and auto-refresh)
    const idToken = await user.getIdToken(forceRefresh);

    // Update localStorage
    if (idToken) {
      localStorage.setItem('adminToken', idToken);
      console.log('[tokenRefresh] ✅ Admin token refreshed successfully');
    }

    return idToken;
  } catch (error) {
    console.error('[tokenRefresh] Failed to refresh admin token:', error);
    return null;
  }
}

/**
 * Make an authenticated fetch request with automatic token refresh on 401
 * @param url - Request URL
 * @param options - Fetch options
 * @param retryCount - Current retry attempt (internal use)
 * @returns Fetch response
 */
export async function fetchWithTokenRefresh(
  url: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<Response> {
  const MAX_RETRIES = 2;

  try {
    // Get fresh token
    const token = await getFreshIdToken(retryCount > 0);

    if (!token) {
      throw new Error('No authentication token available');
    }

    // Attempt to derive admin UID from token payload to set X-Admin-UID header
    let adminUid: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      adminUid = payload?.uid || payload?.user_id || payload?.sub || null;
    } catch (e) {
      // ignore parsing errors
    }

    // Add Authorization and optional X-Admin-UID header
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
      Authorization: `Bearer ${token}`,
    };
    if (adminUid) headers['X-Admin-UID'] = String(adminUid);

    // Make request
    const response = await fetch(url, { ...options, headers });

    // If 401 and we haven't retried too many times, refresh token and retry
    if (response.status === 401 && retryCount < MAX_RETRIES) {
      console.log(`[tokenRefresh] Got 401, refreshing token (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      
      // Force refresh token
      const freshToken = await getFreshIdToken(true);

      if (freshToken) {
        // Retry with fresh token
        return fetchWithTokenRefresh(url, options, retryCount + 1);
      }
    }

    return response;
  } catch (error) {
    console.error('[tokenRefresh] Fetch failed:', error);
    throw error;
  }
}

/**
 * Setup automatic token refresh before expiration
 * Firebase tokens expire after 1 hour - refresh proactively at 50 minutes
 */
export function setupAutoTokenRefresh(): () => void {
  const REFRESH_INTERVAL = 50 * 60 * 1000; // 50 minutes
  
  console.log('[tokenRefresh] Setting up auto-refresh (every 50 minutes)');
  
  const intervalId = setInterval(async () => {
    try {
      const token = await getFreshIdToken(true);
      if (token) {
        console.log('[tokenRefresh] ✅ Auto-refresh successful');
      } else {
        console.warn('[tokenRefresh] Auto-refresh failed - user may be logged out');
      }
    } catch (error) {
      console.error('[tokenRefresh] Auto-refresh error:', error);
    }
  }, REFRESH_INTERVAL);

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
    console.log('[tokenRefresh] Auto-refresh stopped');
  };
}

/**
 * Check if token is likely expired and needs refresh
 * @returns true if token should be refreshed
 */
export function shouldRefreshToken(): boolean {
  try {
    const token = localStorage.getItem('adminToken');
    if (!token) return true;

    // Parse JWT to check expiration (basic check)
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = exp - now;

    // Refresh if less than 5 minutes until expiry
    return timeUntilExpiry < 5 * 60 * 1000;
  } catch (error) {
    // If we can't parse token, assume it needs refresh
    return true;
  }
}
