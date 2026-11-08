import { createHmac, timingSafeEqual } from 'node:crypto';

import { InvalidTokenError } from './types.js';

/**
 * Admin sessions are intentionally independent of Firebase: the dashboard signs
 * in with an email + password, and the backend returns its own signed token.
 * The token is stateless (HMAC-SHA256), so no extra table is required.
 */
const TOKEN_PREFIX = 'adm.';
const MAX_TOKEN_LENGTH = 4096;

export interface AdminSessionClaims {
  readonly adminId: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
}

interface TokenPayload {
  readonly sub: string;
  readonly iat: number;
  readonly exp: number;
}

function sign(payloadSegment: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadSegment).digest('base64url');
}

export function isAdminSessionToken(token: string): boolean {
  return token.startsWith(TOKEN_PREFIX);
}

export function issueAdminSessionToken(
  adminId: string,
  secret: string,
  ttlSeconds: number,
): { token: string; expiresAt: Date } {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + ttlSeconds;
  const payload: TokenPayload = { sub: adminId, iat: issuedAt, exp: expiresAt };
  const segment = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return {
    token: `${TOKEN_PREFIX}${segment}.${sign(segment, secret)}`,
    expiresAt: new Date(expiresAt * 1000),
  };
}

export function verifyAdminSessionToken(
  token: string,
  secret: string,
): AdminSessionClaims {
  if (token.length > MAX_TOKEN_LENGTH || !isAdminSessionToken(token)) {
    throw new InvalidTokenError('Token sesi admin tidak valid.');
  }

  const [segment, signature] = token.slice(TOKEN_PREFIX.length).split('.');
  if (!segment || !signature) {
    throw new InvalidTokenError('Token sesi admin tidak valid.');
  }

  const provided = Buffer.from(signature);
  const expected = Buffer.from(sign(segment, secret));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new InvalidTokenError('Token sesi admin tidak valid.');
  }

  let payload: Partial<TokenPayload>;
  try {
    payload = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Partial<TokenPayload>;
  } catch {
    throw new InvalidTokenError('Token sesi admin tidak valid.');
  }

  if (
    typeof payload.sub !== 'string' ||
    payload.sub.length === 0 ||
    typeof payload.exp !== 'number'
  ) {
    throw new InvalidTokenError('Token sesi admin tidak valid.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw new InvalidTokenError('Sesi admin sudah berakhir.', true);
  }

  const issuedAt = typeof payload.iat === 'number' ? payload.iat : payload.exp;
  return {
    adminId: payload.sub,
    issuedAt: new Date(issuedAt * 1000),
    expiresAt: new Date(payload.exp * 1000),
  };
}
