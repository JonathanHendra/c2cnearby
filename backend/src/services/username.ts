import { randomBytes } from 'node:crypto';

export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

const RESERVED = new Set([
  'admin',
  'administrator',
  'c2c',
  'c2cnearby',
  'help',
  'bantuan',
  'support',
  'official',
  'moderator',
  'system',
  'sistem',
  'root',
  'security',
  'keamanan',
  'me',
  'api',
  'null',
  'undefined',
]);

export type UsernameProblem = 'format' | 'reserved';

/** Lower-cases and trims input exactly the way it will be stored. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): UsernameProblem | null {
  const username = normalizeUsername(raw);
  if (!USERNAME_PATTERN.test(username)) {
    return 'format';
  }
  if (RESERVED.has(username) || username.startsWith('pengguna_')) {
    return 'reserved';
  }
  return null;
}

/** Temporary unique handle assigned at provisioning until the user picks one. */
export function generatePlaceholderUsername(): string {
  return `pengguna_${randomBytes(4).toString('hex')}`;
}
