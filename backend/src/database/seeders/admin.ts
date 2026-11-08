import { randomUUID } from 'node:crypto';

import { hashAdminPassword } from '../../auth/admin-password.js';
import type { DatabaseModels } from '../models/index.js';

export const ADMIN_DEFAULT_EMAIL = 'h3ndr45imbolon@gmail.com';
export const ADMIN_DEFAULT_PASSWORD = '31SosMed!#';

export async function ensureAdminSeed(
  models: DatabaseModels,
): Promise<void> {
  const { AdminUser } = models;

  const [existing] = await AdminUser.findOrCreate({
    where: { email: ADMIN_DEFAULT_EMAIL },
    defaults: {
      id: '00000000-0000-4000-8000-000000000001',
      // Admin accounts sign in with email + password; this placeholder only
      // satisfies the legacy unique column and never matches a Firebase uid.
      firebaseUid: `local:${randomUUID()}`,
      email: ADMIN_DEFAULT_EMAIL,
      passwordHash: hashAdminPassword(ADMIN_DEFAULT_PASSWORD),
      role: 'super_admin',
      isActive: true,
    },
  });

  if (!existing) {
    return;
  }

  const needsPassword =
    !existing.passwordHash ||
    existing.passwordHash.length === 0 ||
    existing.passwordHash === '0'.repeat(128);

  if (needsPassword) {
    existing.passwordHash = hashAdminPassword(ADMIN_DEFAULT_PASSWORD);
    await existing.save({ fields: ['passwordHash'] });
  }
}
