import type { FastifyRequest } from 'fastify';

import { ForbiddenError, UnauthenticatedError } from '../common/errors.js';
import type { AppConfig } from '../config/env.js';
import type { DatabaseModels } from '../database/models/index.js';
import type { AdminUser } from '../database/models/admin.model.js';
import type { User } from '../database/models/user.model.js';
import type { UserService } from '../services/user-service.js';
import {
  isAdminSessionToken,
  verifyAdminSessionToken,
  type AdminSessionClaims,
} from './admin-session.js';
import { DevTokenVerifier } from './dev-verifier.js';
import { FirebaseTokenVerifier } from './firebase-verifier.js';
import { hasPermission, type AdminPermission } from './permissions.js';
import { InvalidTokenError, type TokenVerifier, type VerifiedIdentity } from './types.js';

export interface AuthContext {
  readonly config: AppConfig;
  readonly models: DatabaseModels;
  readonly users: UserService;
  readonly verifier: TokenVerifier;
}

export function createTokenVerifier(config: AppConfig): TokenVerifier {
  if (config.auth.driver === 'dev') {
    return new DevTokenVerifier(config.nodeEnv);
  }
  return new FirebaseTokenVerifier(config);
}

function bearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (typeof header !== 'string') {
    throw new UnauthenticatedError('Header Authorization tidak ditemukan.');
  }
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new UnauthenticatedError('Format Authorization harus "Bearer <token>".');
  }
  return token;
}

async function verify(ctx: AuthContext, request: FastifyRequest): Promise<VerifiedIdentity> {
  const token = bearerToken(request);
  try {
    return await ctx.verifier.verifyIdToken(token);
  } catch (error) {
    if (error instanceof InvalidTokenError) {
      if (error.expired) {
        throw new UnauthenticatedError(
          'Token sudah kedaluwarsa. Segarkan sesi lalu coba lagi.',
        );
      }
      throw new UnauthenticatedError('Token tidak valid.');
    }
    throw error;
  }
}

export interface AdminAuthRoutesOptions {
  readonly ctx: AuthContext;
  readonly guards: AuthGuards;
}

export interface AuthGuards {
  /** Requires a verified token AND a provisioned, active local user. */
  authenticate(request: FastifyRequest): Promise<void>;
  /** Anonymous requests continue; a present-but-invalid token still fails. */
  optionalAuthenticate(request: FastifyRequest): Promise<void>;
  /** Requires a verified token from an active admin account (firebase_uid or email). */
  requireAdmin(request: FastifyRequest): Promise<void>;
  /** Admin guard plus a specific permission from the role matrix. */
  authorize(permission: AdminPermission): (request: FastifyRequest) => Promise<void>;
}

export function createAuthGuards(ctx: AuthContext): AuthGuards {
  const authenticate = async (request: FastifyRequest): Promise<void> => {
    const identity = await verify(ctx, request);
    const user: User | null = await ctx.users.findByFirebaseUid(identity.uid);

    if (!user) {
      throw new UnauthenticatedError(
        'Profil belum dibuat. Panggil POST /api/v1/auth/session terlebih dahulu.',
      );
    }
    if (user.accountStatus === 'suspended') {
      throw new ForbiddenError('Akun Anda sedang ditangguhkan.');
    }
    if (user.accountStatus === 'deactivated') {
      throw new ForbiddenError('Akun Anda sedang dalam proses penghapusan.');
    }

    request.identity = identity;
    request.authUser = user;
  };

  const optionalAuthenticate = async (request: FastifyRequest): Promise<void> => {
    if (typeof request.headers.authorization === 'string') {
      await authenticate(request);
    }
  };

  const requireAdmin = async (request: FastifyRequest): Promise<void> => {
    const token = bearerToken(request);

    // Password-based admin sessions (dashboard) never touch Firebase: the
    // backend issued this token itself at POST /admin/auth/login.
    if (isAdminSessionToken(token)) {
      let claims: AdminSessionClaims;
      try {
        claims = verifyAdminSessionToken(token, ctx.config.auth.adminSession.secret);
      } catch (error) {
        if (error instanceof InvalidTokenError) {
          throw new UnauthenticatedError(
            error.expired
              ? 'Sesi admin sudah berakhir. Silakan masuk kembali.'
              : 'Token sesi admin tidak valid.',
          );
        }
        throw error;
      }

      const sessionAdmin = await ctx.models.AdminUser.findByPk(claims.adminId);
      if (!sessionAdmin || !sessionAdmin.isActive) {
        throw new ForbiddenError('Akun admin ini tidak aktif.');
      }

      request.identity = {
        uid: `admin:${sessionAdmin.id}`,
        email: sessionAdmin.email,
        emailVerified: true,
        phoneNumber: null,
        signInProvider: 'password',
        displayName: null,
        photoUrl: null,
        expiresAt: claims.expiresAt,
      };
      request.adminUser = sessionAdmin;
      return;
    }

    const identity = await verify(ctx, request);

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

    request.identity = identity;
    request.adminUser = admin;
  };

  const authorize =
    (permission: AdminPermission) =>
    async (request: FastifyRequest): Promise<void> => {
      await requireAdmin(request);
      const admin = request.adminUser;
      if (!admin || !hasPermission(admin.role, permission)) {
        throw new ForbiddenError(`Peran ${admin?.role ?? 'unknown'} tidak memiliki izin ${permission}.`);
      }
    };

  return { authenticate, optionalAuthenticate, requireAdmin, authorize };
}

/** Verifies the bearer token without requiring a provisioned profile. */
export async function verifyRequestIdentity(
  ctx: AuthContext,
  request: FastifyRequest,
): Promise<VerifiedIdentity> {
  return verify(ctx, request);
}

/** Resolves the authenticated user for handlers after `authenticate` ran. */
export function authenticatedUser(request: FastifyRequest): User {
  const user = request.authUser;
  if (!user) {
    throw new UnauthenticatedError();
  }
  return user;
}

export function authenticatedIdentity(request: FastifyRequest): VerifiedIdentity {
  const identity = request.identity;
  if (!identity) {
    throw new UnauthenticatedError();
  }
  return identity;
}

export function authenticatedAdmin(request: FastifyRequest): AdminUser {
  const admin = request.adminUser;
  if (!admin) {
    throw new ForbiddenError('Akses admin diperlukan.');
  }
  return admin;
}
