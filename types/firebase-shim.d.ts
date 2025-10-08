// Temporary shims to unblock TypeScript while npm install fetches real typings.
// Safe to delete after 'firebase' package is installed successfully.

declare module 'firebase/app' {
  export function initializeApp(config: any): any;
  export function getApps(): any[];
}

declare module 'firebase/auth' {
  export class GoogleAuthProvider {}
  export function getAuth(): any;
  export function signInWithPopup(auth: any, provider: any): Promise<any>;
  export const browserLocalPersistence: any;
  export function setPersistence(auth: any, persistence: any): Promise<void>;
}
