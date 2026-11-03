import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type Auth,
} from "firebase/auth";

/**
 * Sign-in. Uses Firebase Authentication (email + password, Google) when the project's
 * web config is set in the VITE_FIREBASE_* environment variables. Without it the app runs
 * in "local mode": a profile kept only in this browser, so the site still works.
 */

export interface User {
  uid: string;
  email: string;
  name: string;
  photo?: string;
  local?: boolean; // true = not a real account, this browser only
}

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const authConfigured = !!(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
function fb(): Auth {
  if (!auth) {
    app = initializeApp(cfg as Required<typeof cfg>);
    auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence);
  }
  return auth;
}

const LOCAL_KEY = "postcraft-local-user";

function localUser(): User | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

/** Calls back with the signed-in user (or null) now and whenever it changes. */
export function watchUser(cb: (u: User | null) => void): () => void {
  if (!authConfigured) {
    cb(localUser());
    const on = () => cb(localUser());
    window.addEventListener("postcraft:local-user", on);
    return () => window.removeEventListener("postcraft:local-user", on);
  }
  return onAuthStateChanged(fb(), (u) =>
    cb(u ? { uid: u.uid, email: u.email ?? "", name: u.displayName || (u.email ?? "").split("@")[0], photo: u.photoURL ?? undefined } : null),
  );
}

function setLocal(u: User | null) {
  try {
    if (u) localStorage.setItem(LOCAL_KEY, JSON.stringify(u));
    else localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("postcraft:local-user"));
}

export async function signUpWithEmail(name: string, email: string, password: string) {
  if (!authConfigured) return setLocal({ uid: "local", email, name: name || email.split("@")[0], local: true });
  const cred = await createUserWithEmailAndPassword(fb(), email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
}

export async function signInWithEmail(email: string, password: string) {
  if (!authConfigured) return setLocal({ uid: "local", email, name: email.split("@")[0], local: true });
  await signInWithEmailAndPassword(fb(), email, password);
}

export async function signInWithGoogle() {
  if (!authConfigured) throw new Error("auth/not-configured");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(fb(), provider);
}

export async function resetPassword(email: string) {
  if (!authConfigured) throw new Error("auth/not-configured");
  await sendPasswordResetEmail(fb(), email);
}

export async function signOut() {
  if (!authConfigured) return setLocal(null);
  await fbSignOut(fb());
}

/** Firebase error codes → plain words. */
export function authMessage(e: unknown): string {
  const code = (e as { code?: string; message?: string })?.code ?? (e as Error)?.message ?? "";
  if (code.includes("not-configured")) return "Google sign-in needs the Firebase project to be connected first.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "That email and password don't match. Try again or reset your password.";
  if (code.includes("email-already-in-use")) return "There's already an account with this email — sign in instead.";
  if (code.includes("weak-password")) return "Please use a stronger password (at least 8 characters).";
  if (code.includes("invalid-email")) return "That doesn't look like an email address.";
  if (code.includes("too-many-requests")) return "Too many attempts. Wait a minute and try again.";
  if (code.includes("popup-closed") || code.includes("cancelled-popup")) return "The Google window was closed before finishing.";
  if (code.includes("popup-blocked")) return "Your browser blocked the Google pop-up. Allow pop-ups for this site and try again.";
  if (code.includes("unauthorized-domain")) return "This website isn't allowed to use Google sign-in yet (add it under Authorized domains in Firebase).";
  if (code.includes("network")) return "No connection. Check your internet and try again.";
  return "Something went wrong. Please try again.";
}
