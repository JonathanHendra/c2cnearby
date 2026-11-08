import { scryptSync, timingSafeEqual } from 'node:crypto';

/** Salt is fixed so hashes stay comparable across restarts and deployments. */
const ADMIN_PASSWORD_SALT = 'c2c-nearby-admin-salt';
const KEY_LENGTH = 64;

export function hashAdminPassword(plain: string): string {
  return scryptSync(plain, ADMIN_PASSWORD_SALT, KEY_LENGTH).toString('hex');
}

export function verifyAdminPassword(plain: string, hash: string): boolean {
  if (!hash) {
    return false;
  }
  const derived = Buffer.from(hashAdminPassword(plain), 'utf8');
  const stored = Buffer.from(hash, 'utf8');
  return derived.length === stored.length && timingSafeEqual(derived, stored);
}
