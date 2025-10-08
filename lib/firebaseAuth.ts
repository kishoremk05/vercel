/**
 * Firebase Authentication Helper Functions
 * 
 * This file contains all authentication-related functions
 * Uses dynamic imports to avoid initialization issues
 */

// @ts-ignore - Firebase Auth imports
import * as auth from 'firebase/auth';
import { getFirebaseAuth } from './firebaseClient';
import {
  createClient,
  getClientByAuthUid,
  updateClientProfile,
  updateLastLogin,
} from './firestoreClient';

// Type for User (we'll use any to avoid import issues)
type User = any;

// ==================== SIGN UP ====================

/**
 * Sign up a new user with email and password
 */
export async function signupWithEmail(
  email: string,
  password: string,
  name: string
): Promise<{ user: User; clientId: string }> {
  const firebaseAuth = getFirebaseAuth();
  
  try {
    // Create Firebase Auth user
    // @ts-ignore
    const userCredential = await auth.createUserWithEmailAndPassword(firebaseAuth, email, password);
    const user = userCredential.user;
    
    // Update display name
    // @ts-ignore
    await auth.updateProfile(user, { displayName: name });
    
    // Create client document in Firestore
    const clientId = await createClient({
      name: name,
      email: email,
      auth_uid: user.uid,
      activity_status: 'active',
    });
    
    // Create profile document
    await updateClientProfile(clientId, {
      name: name,
      email: email,
      google_auth: false,
    });
    
    console.log('✅ User signed up successfully:', { email, clientId });
    
    return { user, clientId };
  } catch (error: any) {
    console.error('❌ Signup error:', error);
    throw new Error(getAuthErrorMessage(error.code));
  }
}

/**
 * Sign up with Google OAuth
 */
export async function signupWithGoogle(): Promise<{ user: User; clientId: string }> {
  const firebaseAuth = getFirebaseAuth();
  // @ts-ignore
  const provider = new auth.GoogleAuthProvider();
  
  try {
    // @ts-ignore
    const result = await auth.signInWithPopup(firebaseAuth, provider);
    const user = result.user;
    
    console.log('[GoogleAuth] User authenticated:', { uid: user.uid, email: user.email });
    
    // Check if client already exists
    let client = await getClientByAuthUid(user.uid);
    
    if (!client) {
      console.log('[GoogleAuth] Creating new client for:', user.email);
      
      try {
        // Create new client document (uses auth_uid as document ID)
        const clientId = await createClient({
          name: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email!,
          auth_uid: user.uid,
          activity_status: 'active',
        });
        
        console.log('[GoogleAuth] ✅ Client created:', clientId);
        
        // Wait a moment for Firestore to process
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Create profile
        try {
          await updateClientProfile(clientId, {
            name: user.displayName || user.email?.split('@')[0] || 'User',
            email: user.email!,
            google_auth: true,
          });
          console.log('[GoogleAuth] ✅ Profile created');
        } catch (profileError: any) {
          console.error('[GoogleAuth] ⚠️ Profile creation failed (non-fatal):', profileError.message);
          // Continue anyway - profile can be created later
        }
        
        console.log('✅ User signed up with Google:', { email: user.email, clientId });
        
        return { user, clientId };
      } catch (createError: any) {
        console.error('[GoogleAuth] ❌ Client creation failed:', createError);
        throw createError;
      }
    } else {
      // Existing user, just update last login
      console.log('[GoogleAuth] Existing user logging in:', client.id);
      
      try {
        await updateLastLogin(client.id);
        console.log('[GoogleAuth] ✅ Last login updated');
      } catch (loginError: any) {
        console.error('[GoogleAuth] ⚠️ Last login update failed (non-fatal):', loginError.message);
        // Continue anyway - user can still log in
      }
      
      console.log('✅ Existing user logged in with Google:', { email: user.email, clientId: client.id });
      return { user, clientId: client.id };
    }
  } catch (error: any) {
    console.error('❌ Google signup error:', error);
    console.error('❌ Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack,
    });
    throw new Error(getAuthErrorMessage(error.code));
  }
}

// ==================== LOGIN ====================

/**
 * Login with email and password
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<{ user: User; clientId: string }> {
  const firebaseAuth = getFirebaseAuth();
  
  try {
    // Sign in with Firebase Auth
    // @ts-ignore
    const userCredential = await auth.signInWithEmailAndPassword(firebaseAuth, email, password);
    const user = userCredential.user;
    
    // Get client document
    const client = await getClientByAuthUid(user.uid);
    
    if (!client) {
      throw new Error('Client profile not found. Please contact support.');
    }
    
    // Update last login
    await updateLastLogin(client.id);
    
    console.log('✅ User logged in successfully:', { email, clientId: client.id });
    
    return { user, clientId: client.id };
  } catch (error: any) {
    console.error('❌ Login error:', error);
    throw new Error(getAuthErrorMessage(error.code));
  }
}

/**
 * Login with Google OAuth
 */
export async function loginWithGoogle(): Promise<{ user: User; clientId: string }> {
  return signupWithGoogle(); // Same implementation
}

// ==================== LOGOUT ====================

/**
 * Sign out current user and clear all local data
 */
export async function logout(): Promise<void> {
  const firebaseAuth = getFirebaseAuth();
  
  try {
    // @ts-ignore
    await auth.signOut(firebaseAuth);
    
    // Clear ALL local storage data to ensure complete isolation between users
    localStorage.removeItem('companyId');
    localStorage.removeItem('clientId');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('auth_uid'); // Clear auth_uid explicitly
    localStorage.removeItem('businessName');
    localStorage.removeItem('businessEmail');
    localStorage.removeItem('feedbackPageLink');
    localStorage.removeItem('googleReviewLink');
    localStorage.removeItem('customers');
    localStorage.removeItem('tenantKey');
    
    console.log('✅ User logged out successfully - all data cleared');
  } catch (error: any) {
    console.error('❌ Logout error:', error);
    throw new Error('Failed to logout. Please try again.');
  }
}

// ==================== AUTH STATE ====================

/**
 * Get current authenticated user
 */
export function getCurrentUser(): User | null {
  const auth = getFirebaseAuth();
  return auth.currentUser;
}

/**
 * Listen to authentication state changes
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  const firebaseAuth = getFirebaseAuth();
  // @ts-ignore
  return auth.onAuthStateChanged(firebaseAuth, callback);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

// ==================== ERROR HANDLING ====================

/**
 * Convert Firebase error codes to user-friendly messages
 */
function getAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please login instead.';
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/operation-not-allowed':
      return 'Email/password authentication is not enabled. Please contact support.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/user-not-found':
      return 'No account found with this email. Please sign up first.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many failed login attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed. Please try again.';
    case 'auth/cancelled-popup-request':
      return 'Only one popup request is allowed at a time.';
    default:
      return 'An error occurred. Please try again.';
  }
}

// ==================== UTILITIES ====================

/**
 * Wait for auth to be ready
 */
export async function waitForAuth(): Promise<User | null> {
  const firebaseAuth = getFirebaseAuth();
  
  return new Promise((resolve) => {
    // @ts-ignore
    const unsubscribe = auth.onAuthStateChanged(firebaseAuth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

/**
 * Get user's client ID from Firestore
 */
export async function getUserClientId(user: User): Promise<string | null> {
  try {
    const client = await getClientByAuthUid(user.uid);
    return client?.id || null;
  } catch (error) {
    console.error('Error getting client ID:', error);
    return null;
  }
}
