import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';

import { verifyAdminPassword } from '../auth/admin-password.js';
import { issueAdminSessionToken } from '../auth/admin-session.js';
import {
  authenticatedAdmin,
  verifyRequestIdentity,
  type AuthContext,
  type AdminAuthRoutesOptions,
} from '../auth/index.js';
import { permissionsFor, type AdminPermission } from '../auth/permissions.js';
import type { AppConfig } from '../config/env.js';
import { ForbiddenError } from '../common/errors.js';
import { forbiddenEnvelope } from '../common/schemas.js';
import { ok } from '../common/response.js';
import { unauthorizedEnvelope } from '../common/schemas.js';
import type { AdminRole, AdminUser } from '../database/models/admin.model.js';

const adminAuthUserSchema = Type.Object({
  id: Type.String(),
  email: Type.String(),
  role: Type.String(),
  is_active: Type.Boolean(),
  last_login_at: Type.Union([Type.String(), Type.Null()]),
});

const adminAuthResponseSchema = Type.Object({
  data: Type.Object({
    admin: adminAuthUserSchema,
    permissions: Type.Array(Type.String()),
    token: Type.String(),
    expires_at: Type.String(),
  }),
});

function toAdminDto(admin: AdminUser): AdminDTO {
  return {
    id: admin.id,
    email: admin.email ?? '',
    role: admin.role,
    is_active: admin.isActive,
    last_login_at: admin.lastLoginAt ? admin.lastLoginAt.toISOString() : null,
  };
}

function sessionPayload(
  admin: AdminUser,
  config: Readonly<AppConfig>,
): {
  admin: AdminDTO;
  permissions: readonly AdminPermission[];
  token: string;
  expires_at: string;
} {
  const { token, expiresAt } = issueAdminSessionToken(
    admin.id,
    config.auth.adminSession.secret,
    config.auth.adminSession.ttlSeconds,
  );

  return {
    admin: toAdminDto(admin),
    permissions: permissionsFor(admin.role),
    token,
    expires_at: expiresAt.toISOString(),
  };
}

async function ensureAdminIdentity(
  ctx: AuthContext,
  request: import('fastify').FastifyRequest,
): Promise<{ admin: AdminUser; email: string | null }> {
  const identity = await verifyRequestIdentity(ctx, request);

  const byFirebase = await ctx.models.AdminUser.findOne({
    where: { firebaseUid: identity.uid },
  });

  const byEmail = identity.email
    ? await ctx.models.AdminUser.findOne({
        where: { email: identity.email.toLowerCase() },
      })
    : null;

  const admin = byFirebase ?? byEmail;
  if (!admin || !admin.isActive) {
    throw new ForbiddenError('Akun ini tidak memiliki akses admin.');
  }

  return { admin, email: identity.email };
}

export const adminAuthRoutes: FastifyPluginAsync<AdminAuthRoutesOptions> = async (
  app,
  options,
) => {
  const { ctx, guards } = options;

  app.post(
    '/admin/auth/session',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['admin-auth'],
        summary: 'Exchange a Firebase token for an admin session; requires an active admin row',
        response: {
          200: Type.Any(),
          401: unauthorizedEnvelope,
          403: forbiddenEnvelope,
        },
      },
    },
    async (request, reply) => {
      const { admin, email } = await ensureAdminIdentity(ctx, request);

      admin.lastLoginAt = new Date();
      if ((admin.email ?? '').length === 0 && email) {
        admin.email = email.toLowerCase();
      }
      await admin.save({ fields: ['lastLoginAt', 'email'] });

      return reply.code(200).send(ok(sessionPayload(admin, ctx.config)));
    },
  );

  app.post(
    '/admin/auth/login',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['admin-auth'],
        summary: 'Log in as an admin with an email and password',
        payload: {
          body: Type.Object({
            email: Type.String({ format: 'email' }),
            password: Type.String({ minLength: 1 }),
          }),
        },
        response: {
          200: adminAuthResponseSchema,
          401: unauthorizedEnvelope,
          403: forbiddenEnvelope,
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body as {
        email: string;
        password: string;
      };

      const admin = await ctx.models.AdminUser.findOne({
        where: { email: email.toLowerCase() },
      });

      if (!admin || !admin.isActive) {
        throw new ForbiddenError('Akun ini belum terdaftar sebagai admin aktif.');
      }

      const valid = verifyAdminPassword(password, admin.passwordHash ?? '');

      if (!valid) {
        throw new ForbiddenError('Email atau kata sandi salah.');
      }

      admin.lastLoginAt = new Date();
      await admin.save({ fields: ['lastLoginAt'] });

      return reply.code(200).send(ok(sessionPayload(admin, ctx.config)));
    },
  );

  app.get(
    '/admin/auth/me',
    {
      preHandler: guards.requireAdmin,
      schema: {
        tags: ['admin-auth'],
        summary: 'Current admin identity and role permissions',
        response: { 401: unauthorizedEnvelope, 403: forbiddenEnvelope },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const admin = authenticatedAdmin(request);
      return ok(sessionPayload(admin, ctx.config));
    },
  );
};

interface AdminDTO {
  readonly id: string;
  readonly email: string;
  readonly role: AdminRole;
  readonly is_active: boolean;
  readonly last_login_at: string | null;
}
