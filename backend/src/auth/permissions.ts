import type { AdminRole } from '../database/models/admin.model.js';

export const ADMIN_PERMISSIONS = [
  'dashboard:read',
  'users:read',
  'users:status',
  'verifications:read',
  'verifications:review',
  'listings:read',
  'listings:moderate',
  'categories:read',
  'categories:write',
  'reports:read',
  'reports:resolve',
  'agreements:read',
  'reviews:read',
  'reviews:moderate',
  'settings:read',
  'settings:write',
  'admins:manage',
  'audit:read',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const MODERATION: readonly AdminPermission[] = [
  'dashboard:read',
  'users:read',
  'listings:read',
  'listings:moderate',
  'reports:read',
  'reports:resolve',
  'reviews:read',
  'reviews:moderate',
  'categories:read',
];

const SUPPORT: readonly AdminPermission[] = [
  'dashboard:read',
  'users:read',
  'agreements:read',
  'verifications:read',
  'listings:read',
];

const VERIFICATION_MANAGER: readonly AdminPermission[] = [
  'dashboard:read',
  'users:read',
  'verifications:read',
  'verifications:review',
  'users:status',
];

const ADMIN: readonly AdminPermission[] = [
  'dashboard:read',
  'users:read',
  'users:status',
  'verifications:read',
  'verifications:review',
  'listings:read',
  'listings:moderate',
  'categories:read',
  'categories:write',
  'reports:read',
  'reports:resolve',
  'agreements:read',
  'reviews:read',
  'reviews:moderate',
  'settings:read',
];

/**
 * Role -> permission matrix. The database row stays authoritative: permissions are
 * derived from `admin_users.role` on every request, never from a token claim.
 */
export const ROLE_PERMISSIONS: Readonly<Record<AdminRole, readonly AdminPermission[]>> = {
  super_admin: ADMIN_PERMISSIONS,
  admin: ADMIN,
  moderator: MODERATION,
  verification_manager: VERIFICATION_MANAGER,
  support: SUPPORT,
};

export function permissionsFor(role: AdminRole): readonly AdminPermission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
