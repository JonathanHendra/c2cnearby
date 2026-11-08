/**
 * Identity facts the backend is willing to trust. They may only come from a
 * verified provider token — never from a request body, header or client state.
 */
export interface VerifiedIdentity {
  readonly uid: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly phoneNumber: string | null;
  readonly signInProvider: string;
  readonly displayName: string | null;
  readonly photoUrl: string | null;
  /** Token expiry when the provider exposes it, so clients can refresh early. */
  readonly expiresAt: Date | null;
}

export interface TokenVerifier {
  /** Provider name used in audit rows and verification records. */
  readonly name: string;
  verifyIdToken(token: string): Promise<VerifiedIdentity>;
}

export class InvalidTokenError extends Error {
  readonly expired: boolean;

  constructor(message: string, expired = false) {
    super(message);
    this.name = 'InvalidTokenError';
    this.expired = expired;
  }
}

export interface AuthDependencies {
  readonly verifier: TokenVerifier;
}
