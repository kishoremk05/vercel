/**
 * Firebase Configuration Service
 * Centralized service to fetch and cache configuration from Firebase admin_settings/global
 * This ensures all parts of the app use the same SMS server URL and other settings
 */

import { getFirebaseDb } from './firebaseClient';
import { doc, getDoc } from 'firebase/firestore';

interface GlobalConfig {
  smsServerPort?: string;
  feedbackPageUrl?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
  messagingServiceSid?: string;
  updatedAt?: any;
}

let cachedConfig: GlobalConfig | null = null;
let configPromise: Promise<GlobalConfig> | null = null;

/**
 * Fetch global configuration from Firebase admin_settings/global
 * Results are cached in memory to avoid repeated Firestore reads
 */
export async function fetchGlobalConfig(): Promise<GlobalConfig> {
  // Return cached config if available
  if (cachedConfig) {
    return cachedConfig;
  }

  // If already fetching, return the same promise
  if (configPromise) {
    return configPromise;
  }

  // Fetch from Firestore
  configPromise = (async () => {
    try {
      const db = getFirebaseDb();
      const docRef = doc(db, 'admin_settings', 'global');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        cachedConfig = {
          smsServerPort: data.serverConfig?.smsServerPort || data.smsServerPort,
          feedbackPageUrl: data.feedbackUrls?.feedbackPageUrl || data.feedbackPageUrl,
          twilioAccountSid: data.twilio?.accountSid,
          twilioAuthToken: data.twilio?.authToken,
          twilioPhoneNumber: data.twilio?.phoneNumber,
          messagingServiceSid: data.twilio?.messagingServiceSid,
          updatedAt: data.updatedAt,
        };
        
        console.log('✅ Global config loaded from Firebase:', cachedConfig);
        return cachedConfig;
      } else {
        console.warn('⚠️ No global config found in Firebase, using defaults');
        cachedConfig = {};
        return cachedConfig;
      }
    } catch (error: any) {
      // Handle permission errors gracefully
      if (error?.code === 'permission-denied' || error?.message?.includes('permissions')) {
        console.warn('⚠️ Firebase permission denied for global config. Please ensure you are logged in and Firestore rules allow reading admin_settings/global.');
        console.warn('⚠️ Falling back to environment variables and localStorage.');
      } else {
        console.error('❌ Error fetching global config from Firebase:', error);
      }
      // Set empty config so fallbacks are used
      cachedConfig = {};
      return cachedConfig;
    } finally {
      configPromise = null;
    }
  })();

  return configPromise;
}

/**
 * Get the SMS server URL from Firebase config
 * Falls back to environment variable or localhost in development
 */
export async function getSmsServerUrl(): Promise<string> {
  try {
    const config = await fetchGlobalConfig();
    
    if (config.smsServerPort) {
      // Normalize: trim whitespace first
      let raw = String(config.smsServerPort).trim();

      // If the admin stored only a port number like "3002" or ":3002",
      // build an absolute URL using the current page origin so browser
      // fetch() calls are valid. If the value already contains a protocol
      // (http/https) return as-is after trimming trailing slashes.
      if (/^:?\d{1,5}$/.test(raw)) {
        const port = raw.replace(/^:/, "");
        const protocol =
          typeof window !== "undefined" && window.location && window.location.protocol
            ? window.location.protocol
            : "http:";
        const hostname =
          typeof window !== "undefined" && window.location && window.location.hostname
            ? window.location.hostname
            : "localhost";
        raw = `${protocol}//${hostname}:${port}`;
      } else if (!/^https?:\/\//i.test(raw)) {
        // If it's host:port (e.g. "localhost:3002") or a path, prefix protocol/origin
        if (/^[^/]+:\d+/.test(raw)) {
          raw = `http://${raw}`;
        } else if (raw.startsWith("/")) {
          if (typeof window !== "undefined" && window.location && window.location.origin) {
            raw = `${window.location.origin}${raw}`;
          } else {
            raw = `http://localhost${raw}`;
          }
        } else {
          // Best-effort: assume http when not explicitly provided
          raw = `http://${raw}`;
        }
      }

      return String(raw).replace(/\/+$/, "");
    }
  } catch (error) {
    console.error('Error getting SMS server URL from Firebase:', error);
  }

  // Fallback chain
  const fallback =
    (import.meta.env.VITE_API_BASE as string) ||
    localStorage.getItem('smsServerUrl') ||
    'http://localhost:3002';
  return String(fallback).trim().replace(/\/+$/, "");
}

/**
 * Get the feedback page URL from Firebase config
 */
export async function getFeedbackPageUrl(): Promise<string> {
  try {
    const config = await fetchGlobalConfig();
    
    if (config.feedbackPageUrl) {
      return String(config.feedbackPageUrl).trim().replace(/\/+$/, "");
    }
  } catch (error) {
    console.error('Error getting feedback page URL from Firebase:', error);
  }

  // Fallback
  const fb = localStorage.getItem('feedbackPageUrl') || 'http://localhost:5173/feedback';
  return String(fb).trim().replace(/\/+$/, "");
}

/**
 * Get Twilio configuration from Firebase
 */
export async function getTwilioConfig(): Promise<{
  accountSid?: string;
  authToken?: string;
  phoneNumber?: string;
  messagingServiceSid?: string;
}> {
  try {
    const config = await fetchGlobalConfig();
    
    return {
      accountSid: config.twilioAccountSid,
      authToken: config.twilioAuthToken,
      phoneNumber: config.twilioPhoneNumber,
      messagingServiceSid: config.messagingServiceSid,
    };
  } catch (error) {
    console.error('Error getting Twilio config from Firebase:', error);
    return {};
  }
}

/**
 * Clear the cached configuration (useful for forcing a refresh)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  configPromise = null;
  console.log('🔄 Config cache cleared');
}

/**
 * Get synchronous cached config (if available)
 * Use this only after fetchGlobalConfig() has been called at least once
 */
export function getCachedConfig(): GlobalConfig | null {
  return cachedConfig;
}

/**
 * Initialize config on app startup
 * Call this early in your app lifecycle
 */
export async function initializeGlobalConfig(): Promise<void> {
  try {
    await fetchGlobalConfig();
    console.log('✅ Global configuration initialized');
  } catch (error) {
    console.error('❌ Failed to initialize global configuration:', error);
  }
}
