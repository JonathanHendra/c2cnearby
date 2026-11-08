import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';

import {
  verifyRequestIdentity,
  type AuthContext,
  type AuthGuards,
} from '../auth/index.js';
import { ForbiddenError } from '../common/errors.js';
import { ok } from '../common/response.js';
import { unauthorizedEnvelope } from '../common/schemas.js';
import { toUserDto } from '../services/user-service.js';

export interface AuthRoutesOptions {
  readonly ctx: AuthContext;
  readonly guards: AuthGuards;
}

const RATE_LIMIT = { max: 30, timeWindow: '1 minute' } as const;

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (app, options) => {
  const { ctx } = options;

  app.post(
    '/auth/session',
    {
      config: { rateLimit: RATE_LIMIT },
      schema: {
        tags: ['auth'],
        summary: 'Verify a Firebase ID token, provision the profile and return onboarding state',
        response: { 200: Type.Any(), 201: Type.Any(), 401: unauthorizedEnvelope },
      },
    },
    async (request, reply) => {
      const identity = await verifyRequestIdentity(ctx, request);

      const existing = await ctx.users.findByFirebaseUid(identity.uid);
      if (existing?.accountStatus === 'suspended') {
        throw new ForbiddenError('Akun Anda sedang ditangguhkan.');
      }

      const { user, created } = await ctx.users.provision(identity);

      return reply.code(created ? 201 : 200).send(
        ok({
          user: toUserDto(user),
          onboarding: ctx.users.onboarding(user),
          session: {
            provider: ctx.verifier.name,
            sign_in_provider: identity.signInProvider,
            token_expires_at: identity.expiresAt ? identity.expiresAt.toISOString() : null,
          },
        }),
      );
    },
  );
};
