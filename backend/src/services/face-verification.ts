import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import { AppError, ConflictError } from '../common/errors.js';

function invalidSignature(code: string): AppError {
  return new AppError(code, 'Callback verifikasi tidak dapat diautentikasi.', 403);
}

export type FaceStatus = 'pending' | 'verified' | 'rejected';

export interface CreateFaceSessionInput {
  readonly userId: string;
  readonly consent: boolean;
}

export interface FaceSessionResult {
  readonly sessionId: string;
  readonly status: FaceStatus;
  /** True when the provider is a simulation, so the UI can label it honestly. */
  readonly development: boolean;
  readonly expiresAt: string | null;
}

export interface FaceCallbackPayload {
  readonly session_id: string;
  readonly status: FaceStatus;
  readonly reason?: string;
}

export interface FaceCallbackResult {
  readonly sessionId: string;
  readonly status: FaceStatus;
}

export interface FaceVerificationProvider {
  readonly name: string;
  readonly development: boolean;
  createSession(input: CreateFaceSessionInput): Promise<FaceSessionResult>;
  getSessionStatus(sessionId: string): Promise<FaceStatus | null>;
  processCallback(payload: FaceCallbackPayload, signature: string | undefined): Promise<FaceCallbackResult>;
  cancelSession(sessionId: string): Promise<void>;
}

interface MockSession {
  readonly userId: string;
  status: FaceStatus;
  readonly createdAt: number;
}

const SESSION_TTL_MS = 30 * 60 * 1000;

/**
 * Development adapter. It stores sessions in memory, always reports `pending`
 * and can only ever reject a session — it never produces a real verification.
 * Production must plug in a licensed e-KYC provider behind this interface.
 */
export class MockFaceVerificationProvider implements FaceVerificationProvider {
  readonly name = 'mock-e-kyc';
  readonly development = true;

  private readonly sessions = new Map<string, MockSession>();

  constructor(private readonly callbackSecret: string) {}

  async createSession(input: CreateFaceSessionInput): Promise<FaceSessionResult> {
    if (!input.consent) {
      throw new ConflictError(
        'FACE_CONSENT_REQUIRED',
        'Persetujuan eksplisit diperlukan sebelum sesi verifikasi wajah dibuat.',
      );
    }
    const sessionId = `mock_${randomUUID()}`;
    this.sessions.set(sessionId, { userId: input.userId, status: 'pending', createdAt: Date.now() });
    return {
      sessionId,
      status: 'pending',
      development: true,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    };
  }

  async getSessionStatus(sessionId: string): Promise<FaceStatus | null> {
    return this.sessions.get(sessionId)?.status ?? null;
  }

  async processCallback(
    payload: FaceCallbackPayload,
    signature: string | undefined,
  ): Promise<FaceCallbackResult> {
    this.assertSignature(payload, signature);

    const session = this.sessions.get(payload.session_id);
    if (!session) {
      throw new ConflictError('FACE_SESSION_UNKNOWN', 'Sesi verifikasi tidak dikenal.');
    }
    if (session.status !== 'pending') {
      throw new ConflictError('FACE_CALLBACK_REPLAY', 'Callback untuk sesi ini sudah diproses.');
    }

    // The mock provider is not allowed to certify a face.
    session.status = payload.status === 'rejected' ? 'rejected' : 'pending';
    return { sessionId: payload.session_id, status: session.status };
  }

  async cancelSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  private assertSignature(payload: FaceCallbackPayload, signature: string | undefined): void {
    if (this.callbackSecret.length === 0) {
      throw new AppError(
        'FACE_CALLBACK_NOT_CONFIGURED',
        'FACE_CALLBACK_SECRET belum dikonfigurasi pada server.',
        503,
      );
    }
    if (!signature) {
      throw invalidSignature('FACE_SIGNATURE_REQUIRED');
    }

    const expected = createHmac('sha256', this.callbackSecret)
      .update(signaturePayload(payload))
      .digest();
    const received = Buffer.from(signature, 'hex');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw invalidSignature('FACE_SIGNATURE_INVALID');
    }
  }
}

/** Canonical string signed by the provider: `<session_id>:<status>`. */
export function signaturePayload(payload: FaceCallbackPayload): string {
  return `${payload.session_id}:${payload.status}`;
}

export function signFaceCallback(payload: FaceCallbackPayload, secret: string): string {
  return createHmac('sha256', secret).update(signaturePayload(payload)).digest('hex');
}
