import { InvalidTokenError, type TokenVerifier, type VerifiedIdentity } from './types.js';

/**
 * Development-only verifier. Tokens look like `dev:<uid>` or `dev:<uid>:<phone>`.
 * It is rejected outright when NODE_ENV=production (enforced in `createTokenVerifier`
 * and again here), so it can never become an authentication bypass in production.
 */
export class DevTokenVerifier implements TokenVerifier {
  readonly name = 'dev';

  constructor(nodeEnv: 'development' | 'test' | 'production') {
    if (nodeEnv === 'production') {
      throw new Error('DevTokenVerifier tidak boleh dipakai pada produksi.');
    }
  }

  async verifyIdToken(token: string): Promise<VerifiedIdentity> {
    if (!token.startsWith('dev:')) {
      throw new InvalidTokenError('Token pengembangan tidak valid.');
    }

    const [, uid, phone] = token.split(':');
    if (!uid || !/^[A-Za-z0-9_-]{3,64}$/.test(uid)) {
      throw new InvalidTokenError('Token pengembangan tidak valid.');
    }

    return {
      uid,
      email: `${uid.toLowerCase()}@dev.local`,
      emailVerified: true,
      phoneNumber: phone && phone.length > 0 ? `+${phone.replace(/[^0-9]/g, '')}` : null,
      signInProvider: phone ? 'phone' : 'google.com',
      displayName: null,
      photoUrl: null,
      expiresAt: null,
    };
  }
}
