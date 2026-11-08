import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

import type { AppConfig } from '../config/env.js';
import { InvalidTokenError, type TokenVerifier, type VerifiedIdentity } from './types.js';

/**
 * Verifies Firebase ID tokens with the Admin SDK. Verification happens on every
 * request (with revocation checks), so a disabled account loses access at once.
 */
export class FirebaseTokenVerifier implements TokenVerifier {
  readonly name = 'firebase';

  constructor(config: AppConfig) {
    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: config.auth.firebase.projectId,
          clientEmail: config.auth.firebase.clientEmail,
          privateKey: config.auth.firebase.privateKey,
        }),
      });
    }
  }

  async verifyIdToken(token: string): Promise<VerifiedIdentity> {
    try {
      const decoded = await getAuth().verifyIdToken(token, true);
      const provider =
        decoded.firebase?.sign_in_provider ??
        (decoded.phone_number ? 'phone' : 'unknown');

      return {
        uid: decoded.uid,
        email: typeof decoded.email === 'string' ? decoded.email : null,
        emailVerified: decoded.email_verified === true,
        phoneNumber: typeof decoded.phone_number === 'string' ? decoded.phone_number : null,
        signInProvider: provider,
        displayName: typeof decoded.name === 'string' ? decoded.name : null,
        photoUrl: typeof decoded.picture === 'string' ? decoded.picture : null,
        expiresAt: typeof decoded.exp === 'number' ? new Date(decoded.exp * 1000) : null,
      };
    } catch (error) {
      const code = (error as { code?: string }).code ?? '';
      if (code === 'auth/id-token-expired') {
        throw new InvalidTokenError('Token sudah kedaluwarsa.', true);
      }
      throw new InvalidTokenError('Token Firebase tidak valid.');
    }
  }
}
