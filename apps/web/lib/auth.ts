"use client";

import type { User } from "./types";
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
} from "amazon-cognito-identity-js";

/**
 * Dual-mode auth layer.
 *
 * - If NEXT_PUBLIC_USER_POOL_ID and NEXT_PUBLIC_USER_POOL_CLIENT_ID are set
 *   → real Cognito SRP flow.
 * - Otherwise → localStorage mock (same UX, zero AWS cost).
 *
 * Call sites (login/signup pages, app layout) don't need to know which mode
 * is active.
 */

const POOL_ID = process.env.NEXT_PUBLIC_USER_POOL_ID ?? "";
const CLIENT_ID = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID ?? "";
const USE_REAL = !!(POOL_ID && CLIENT_ID);

const pool = USE_REAL
  ? new CognitoUserPool({ UserPoolId: POOL_ID, ClientId: CLIENT_ID })
  : null;

// ─── Public types ───────────────────────────────────────────────────

export type Session = { user: User; token: string };

// ─── Get current session ────────────────────────────────────────────

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;

  if (USE_REAL && pool) {
    const cognitoUser = pool.getCurrentUser();
    if (!cognitoUser) return null;
    // getSession() hydrates tokens from localStorage *synchronously* even
    // though it takes a callback — the callback runs in-line. After it
    // returns, getSignInUserSession() exposes the cached session.
    cognitoUser.getSession(() => {});
    const session = cognitoUser.getSignInUserSession();
    if (!session?.isValid()) return null;
    const payload = session.getIdToken().payload;
    return {
      user: {
        id: payload.sub as string,
        email: payload.email as string,
        name: (payload.name as string) ?? (payload.email as string),
      },
      token: session.getIdToken().getJwtToken(),
    };
  }

  // Mock mode
  const raw = window.localStorage.getItem("rs.session");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

// ─── Sign in ────────────────────────────────────────────────────────

export function signIn(email: string, password: string): Promise<Session> {
  if (USE_REAL && pool) {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({ Username: email, Pool: pool! });
      const authDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });
      cognitoUser.authenticateUser(authDetails, {
        onSuccess(result) {
          const payload = result.getIdToken().payload;
          resolve({
            user: {
              id: payload.sub as string,
              email: payload.email as string,
              name: (payload.name as string) ?? (payload.email as string),
            },
            token: result.getIdToken().getJwtToken(),
          });
        },
        onFailure(err) {
          reject(new Error(err.message ?? "Authentication failed"));
        },
      });
    });
  }

  // Mock mode
  const session: Session = {
    user: {
      id: `u-${Math.random().toString(36).slice(2, 10)}`,
      email,
      name: email.split("@")[0].replace(/\./g, " "),
    },
    token: `mock.${Math.random().toString(36).slice(2)}`,
  };
  window.localStorage.setItem("rs.session", JSON.stringify(session));
  return Promise.resolve(session);
}

// ─── Sign up ────────────────────────────────────────────────────────

export function signUp(
  email: string,
  password: string,
  name?: string,
): Promise<{ needsConfirmation: boolean; session?: Session }> {
  if (USE_REAL && pool) {
    return new Promise((resolve, reject) => {
      const attrs: CognitoUserAttribute[] = [
        new CognitoUserAttribute({ Name: "email", Value: email }),
      ];
      if (name) {
        attrs.push(new CognitoUserAttribute({ Name: "name", Value: name }));
      }
      pool!.signUp(email, password, attrs, [], (err, result) => {
        if (err) return reject(new Error(err.message ?? "Signup failed"));
        resolve({ needsConfirmation: !result?.userConfirmed });
      });
    });
  }

  // Mock mode — sign in immediately
  return signIn(email, password).then((s) => ({
    needsConfirmation: false,
    session: s,
  }));
}

// ─── Confirm signup (verification code) ─────────────────────────────

export function confirmSignUp(email: string, code: string): Promise<void> {
  if (USE_REAL && pool) {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({ Username: email, Pool: pool! });
      cognitoUser.confirmRegistration(code, true, (err) => {
        if (err) return reject(new Error(err.message ?? "Confirmation failed"));
        resolve();
      });
    });
  }
  return Promise.resolve();
}

// ─── Forgot / reset password ────────────────────────────────────────

/** Initiates a forgot-password flow — Cognito emails a 6-digit code. */
export function requestPasswordReset(email: string): Promise<void> {
  if (USE_REAL && pool) {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({ Username: email, Pool: pool! });
      cognitoUser.forgotPassword({
        onSuccess: () => resolve(),
        onFailure: (err) => reject(new Error(err.message ?? "Could not start password reset")),
      });
    });
  }
  return Promise.resolve();
}

/** Confirms the reset with the emailed code + a new password. */
export function confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
  if (USE_REAL && pool) {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({ Username: email, Pool: pool! });
      cognitoUser.confirmPassword(code, newPassword, {
        onSuccess: () => resolve(),
        onFailure: (err) => reject(new Error(err.message ?? "Could not reset password")),
      });
    });
  }
  return Promise.resolve();
}

// ─── Sign out ───────────────────────────────────────────────────────

export function signOut(): void {
  if (typeof window === "undefined") return;
  if (USE_REAL && pool) {
    const user = pool.getCurrentUser();
    user?.signOut();
    return;
  }
  window.localStorage.removeItem("rs.session");
}

// ─── Helper: get current JWT (for API calls) ────────────────────────

export function getToken(): string | null {
  const s = getSession();
  return s?.token ?? null;
}

// ─── Expose mode for debugging ──────────────────────────────────────

export const authMode: "cognito" | "mock" = USE_REAL ? "cognito" : "mock";
