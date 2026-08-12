/**
 * Shutting an account out of Firebase Auth.
 *
 * Two independent operations, and they were sharing one try/catch:
 *
 *   updateUser({ disabled: true })  stops the next sign-in
 *   revokeRefreshTokens(uid)        kills the sessions already open
 *
 * With both inside one block, a success followed by a failure reported as a
 * total failure, and — worse — a failure on the *first* call skipped the second
 * silently. The interesting case is the reverse of what the old flag said: the
 * account can be disabled (no new logins) while an existing ID token stays valid
 * for up to an hour. Reporting "authDisabled: false" for that is precisely
 * backwards, and it is the state where someone still has access.
 *
 * Each is attempted independently and reported independently. Neither throws:
 * the Firestore state is the authority for access, and it has already been
 * written by the time this runs — a caller that rolled back on an Auth hiccup
 * would leave a person the operator believes is locked out still signed in.
 */

import { getAuth } from "firebase-admin/auth";

export interface AccessRevocation {
  /** Firebase Auth account marked disabled — blocks future sign-ins. */
  authDisabled: boolean;
  /** Refresh tokens revoked — ends sessions that are already open. */
  tokensRevoked: boolean;
  /** True when either step failed and the operator has something to follow up. */
  needsAttention: boolean;
}

export async function revokeAuthAccess(uid: string): Promise<AccessRevocation> {
  let authDisabled = true;
  let tokensRevoked = true;

  try {
    await getAuth().updateUser(uid, { disabled: true });
  } catch {
    authDisabled = false;
  }

  // Attempted even if the line above failed — these are not a sequence, and
  // ending live sessions is the more urgent of the two.
  try {
    await getAuth().revokeRefreshTokens(uid);
  } catch {
    tokensRevoked = false;
  }

  return { authDisabled, tokensRevoked, needsAttention: !authDisabled || !tokensRevoked };
}

/** Re-enable sign-in. Tokens are not restored — there is nothing to restore. */
export async function restoreAuthAccess(uid: string): Promise<{ authEnabled: boolean }> {
  try {
    await getAuth().updateUser(uid, { disabled: false });
    return { authEnabled: true };
  } catch {
    return { authEnabled: false };
  }
}
