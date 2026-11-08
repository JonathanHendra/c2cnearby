import type { FastifyInstance } from 'fastify';
import type { Sequelize } from 'sequelize';

import { buildApp } from '../../src/app.js';
import { AppError, ConflictError } from '../../src/common/errors.js';
import type { TokenVerifier, VerifiedIdentity } from '../../src/auth/types.js';
import { InvalidTokenError } from '../../src/auth/types.js';
import type { AppConfig } from '../../src/config/env.js';
import type { Database } from '../../src/database/index.js';
import {
  signFaceCallback,
  type FaceCallbackPayload,
  type FaceCallbackResult,
  type FaceSessionResult,
  type FaceStatus,
  type FaceVerificationProvider,
} from '../../src/services/face-verification.js';

export const TEST_FACE_SECRET = 'phase3-test-face-secret';

export class FakeTokenVerifier implements TokenVerifier {
  readonly name = 'fake';

  private readonly identities = new Map<string, VerifiedIdentity>();

  register(token: string, identity: VerifiedIdentity): string {
    this.identities.set(token, identity);
    return token;
  }

  async verifyIdToken(token: string): Promise<VerifiedIdentity> {
    const identity = this.identities.get(token);
    if (!identity) {
      if (token.endsWith('expired')) {
        throw new InvalidTokenError('Token sudah kedaluwarsa.', true);
      }
      throw new InvalidTokenError('Token tidak valid.');
    }
    return identity;
  }
}

export function fakeIdentity(
  uid: string,
  overrides: Partial<VerifiedIdentity> = {},
): VerifiedIdentity {
  return {
    uid,
    email: `${uid}@example.test`,
    emailVerified: true,
    phoneNumber: null,
    signInProvider: 'google.com',
    displayName: `Nama ${uid}`,
    photoUrl: null,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    ...overrides,
  };
}

/** Records every callback so tests can assert verified transitions. */
export class FakeFaceProvider implements FaceVerificationProvider {
  readonly name = 'fake-ekyc';
  readonly development = false;

  private readonly sessions = new Map<string, FaceStatus>();
  private sequence = 0;

  async createSession(): Promise<FaceSessionResult> {
    this.sequence += 1;
    const sessionId = `face_session_${this.sequence}`;
    this.sessions.set(sessionId, 'pending');
    return {
      sessionId,
      status: 'pending',
      development: false,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }

  async getSessionStatus(sessionId: string): Promise<FaceStatus | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async processCallback(
    payload: FaceCallbackPayload,
    signature: string | undefined,
  ): Promise<FaceCallbackResult> {
    if (!signature || signature !== signFaceCallback(payload, TEST_FACE_SECRET)) {
      throw new AppError('FACE_SIGNATURE_INVALID', 'Callback verifikasi tidak dapat diautentikasi.', 403);
    }
    if (!this.sessions.has(payload.session_id)) {
      throw new ConflictError('FACE_SESSION_UNKNOWN', 'Sesi verifikasi tidak dikenal.');
    }
    this.sessions.set(payload.session_id, payload.status);
    return { sessionId: payload.session_id, status: payload.status };
  }

  async cancelSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

export interface TestApp {
  readonly app: FastifyInstance;
  readonly config: AppConfig;
  readonly database: Database;
  readonly verifier: FakeTokenVerifier;
  readonly faces: FakeFaceProvider;
  auth(token: string): { authorization: string };
}

export async function createTestApp(options: {
  database: Database;
  config: AppConfig;
  verifier?: FakeTokenVerifier;
  faces?: FakeFaceProvider;
  faceProvider?: FaceVerificationProvider;
}): Promise<TestApp> {
  const verifier = options.verifier ?? new FakeTokenVerifier();
  const faces = options.faces ?? new FakeFaceProvider();
  const app = await buildApp({
    config: options.config,
    database: options.database,
    auth: { verifier, faceProvider: options.faceProvider ?? faces },
  });
  await app.ready();

  return {
    app,
    config: options.config,
    database: options.database,
    verifier,
    faces,
    auth: (token: string) => ({ authorization: `Bearer ${token}` }),
  };
}

export async function resetAuthTables(sequelize: Sequelize): Promise<void> {
  const tables = [
    'admin_audit_logs',
    'user_verifications',
    'user_locations',
    'device_tokens',
    'notification_preferences',
    'users',
    'admin_users',
  ];

  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const table of tables) {
      await sequelize.query(`TRUNCATE TABLE \`${table}\``);
    }
  } finally {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}
