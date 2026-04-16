"use client";

import type { User } from "./types";

/**
 * Stub auth layer — stores a fake user in localStorage.
 * Phase 1 will replace this with Cognito (via amazon-cognito-identity-js
 * or amplify/auth). The API surface below matches what we'll keep.
 */

const KEY = "rs.session";

export type Session = { user: User; token: string };

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function signIn(email: string, password: string): Session {
  void password; // real Cognito SRP flow wired in Phase 1
  const session: Session = {
    user: {
      id: `u-${Math.random().toString(36).slice(2, 10)}`,
      email,
      name: email.split("@")[0].replace(/\./g, " "),
    },
    token: `mock.${Math.random().toString(36).slice(2)}`,
  };
  window.localStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

export function signUp(email: string, password: string, name?: string): Session {
  const s = signIn(email, password);
  if (name) {
    s.user.name = name;
    window.localStorage.setItem(KEY, JSON.stringify(s));
  }
  return s;
}

export function signOut(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
