import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import {
  authenticatedIdentity,
  authenticatedUser,
  type AuthContext,
  type AuthGuards,
} from '../auth/index.js';
import {
  AppError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../common/errors.js';
import { ok } from '../common/response.js';
import { unauthorizedEnvelope } from '../common/schemas.js';
import type { UserVerification } from '../database/models/user.model.js';
import type { FaceCallbackPayload, FaceVerificationProvider } from '../services/face-verification.js';
import { ACCOUNT_DELETION_GRACE_DAYS, toUserDto, type ProfileUpdateInput } from '../services/user-service.js';
import type { AvatarStorage } from '../storage/avatar-storage.js';

export interface MeRoutesOptions {
  readonly ctx: AuthContext;
  readonly guards: AuthGuards;
  readonly faces: FaceVerificationProvider;
  readonly avatars: AvatarStorage;
}

interface ProfileBody {
  display_name?: string;
  full_name?: string;
  bio?: string;
  area_label?: string;
}

interface UsernameBody {
  username: string;
}

interface PhoneVerifyBody {
  id_token?: string;
}

interface LocationBody {
  lat: number;
  lng: number;
  area_label?: string | null;
}

interface FaceSessionBody {
  consent: boolean;
}

interface FaceSessionParams {
  id: string;
}

const sessionGuard = { security: [{ bearerAuth: [] }] } as const;

function profileInput(body: ProfileBody): ProfileUpdateInput {
  return {
    displayName: body.display_name,
    fullName: body.full_name,
    bio: body.bio,
    areaLabel: body.area_label,
  };
}

export const meRoutes: FastifyPluginAsync<MeRoutesOptions> = async (app, options) => {
  const { ctx, guards, faces, avatars } = options;

  app.get(
    '/me',
    {
      preHandler: guards.authenticate,
      schema: {
        tags: ['profile'],
        summary: 'Own profile with onboarding state',
        response: { 401: unauthorizedEnvelope },
        ...sessionGuard,
      },
    },
    async (request) => {
      const user = authenticatedUser(request);
      return ok({
        user: toUserDto(user),
        onboarding: ctx.users.onboarding(user),
        location: await ctx.users.getLocation(user.id),
      });
    },
  );

  app.patch<{ Body: ProfileBody }>(
    '/me',
    {
      preHandler: guards.authenticate,
      schema: {
        tags: ['profile'],
        summary: 'Update display name, bio and area label',
        body: Type.Object(
          {
            display_name: Type.Optional(Type.String({ maxLength: 100 })),
            full_name: Type.Optional(Type.String({ maxLength: 120 })),
            bio: Type.Optional(Type.String({ maxLength: 280 })),
            area_label: Type.Optional(Type.String({ maxLength: 120 })),
          },
          { additionalProperties: false },
        ),
        ...sessionGuard,
      },
    },
    async (request) => {
      const user = authenticatedUser(request);
      const updated = await ctx.users.updateProfile(user, profileInput(request.body));
      return ok({ user: toUserDto(updated), onboarding: ctx.users.onboarding(updated) });
    },
  );

  app.patch<{ Body: UsernameBody }>(
    '/me/username',
    {
      preHandler: guards.authenticate,
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['profile'],
        summary: 'Claim a unique username',
        body: Type.Object(
          { username: Type.String({ minLength: 3, maxLength: 30 }) },
          { additionalProperties: false },
        ),
        ...sessionGuard,
      },
    },
    async (request) => {
      const user = authenticatedUser(request);
      const updated = await ctx.users.changeUsername(user, request.body.username);
      return ok({ user: toUserDto(updated), onboarding: ctx.users.onboarding(updated) });
    },
  );

  app.post(
    '/me/avatar',
    {
      preHandler: guards.authenticate,
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['profile'],
        summary: 'Upload an avatar; stored as a 512 px WebP',
        consumes: ['multipart/form-data'],
        ...sessionGuard,
      },
    },
    async (request) => {
      const user = authenticatedUser(request);
      const file = await request.file();
      if (!file) {
        throw new ValidationError('Berkas gambar wajib dikirim pada field "file".', [
          { path: 'file', message: 'wajib diisi' },
        ]);
      }
      if (!file.mimetype.startsWith('image/')) {
        throw new ValidationError('Tipe berkas harus gambar.', [
          { path: 'file', message: 'image/* diperlukan' },
        ]);
      }

      const buffer = await file.toBuffer();
      const stored = await avatars.save(user.id, buffer);
      const updated = await ctx.users.setAvatar(user, stored.url);

      return ok({
        user: toUserDto(updated),
        image: {
          url: stored.url,
          width: stored.width,
          height: stored.height,
          mime: stored.mime,
          size: stored.size,
        },
      });
    },
  );

  app.post<{ Body: PhoneVerifyBody }>(
    '/me/phone/verify',
    {
      preHandler: guards.authenticate,
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['onboarding'],
        summary: 'Mirror a Firebase phone credential into the local profile',
        body: Type.Object(
          { id_token: Type.Optional(Type.String({ minLength: 20 })) },
          { additionalProperties: false },
        ),
        ...sessionGuard,
      },
    },
    async (request) => {
      const user = authenticatedUser(request);
      const identity = authenticatedIdentity(request);

      if (!user.profileCompleted) {
        throw new AppError(
          'ONBOARDING_REQUIRED',
          'Lengkapi profil (username, nama tampilan, area) sebelum verifikasi telepon.',
          403,
          { required_step: 'profile' },
        );
      }

      // The phone credential may arrive as a fresh token after the Firebase Phone
      // Auth challenge; otherwise the session token itself must carry the number.
      const phone = request.body.id_token
        ? (await ctx.verifier.verifyIdToken(request.body.id_token)).phoneNumber
        : identity.phoneNumber;

      if (!phone) {
        throw new BusinessRuleError(
          'PHONE_NOT_VERIFIED',
          'Token tidak memuat nomor telepon terverifikasi. Selesaikan verifikasi Firebase Phone Auth terlebih dahulu.',
        );
      }

      const updated = await ctx.users.markPhoneVerified(user, phone);
      return ok({ user: toUserDto(updated), onboarding: ctx.users.onboarding(updated) });
    },
  );

  app.get(
    '/me/location',
    {
      preHandler: guards.authenticate,
      schema: { tags: ['onboarding'], summary: 'Own private location', ...sessionGuard },
    },
    async (request) => {
      const user = authenticatedUser(request);
      return ok({ location: await ctx.users.getLocation(user.id) });
    },
  );

  app.put<{ Body: LocationBody }>(
    '/me/location',
    {
      preHandler: guards.authenticate,
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['onboarding'],
        summary: 'Store own location as a POINT (private)',
        body: Type.Object(
          {
            lat: Type.Number(),
            lng: Type.Number(),
            area_label: Type.Optional(Type.Union([Type.String({ maxLength: 120 }), Type.Null()])),
          },
          { additionalProperties: false },
        ),
        ...sessionGuard,
      },
    },
    async (request) => {
      const user = authenticatedUser(request);
      const location = await ctx.users.setLocation(user, {
        lat: request.body.lat,
        lng: request.body.lng,
        areaLabel: request.body.area_label,
      });
      return ok({ location });
    },
  );

  app.post<{ Body: FaceSessionBody }>(
    '/me/verification/face/session',
    {
      preHandler: guards.authenticate,
      config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
      schema: {
        tags: ['onboarding'],
        summary: 'Create a face verification session (mock provider in development)',
        body: Type.Object({ consent: Type.Boolean() }, { additionalProperties: false }),
        ...sessionGuard,
      },
    },
    async (request, reply) => {
      const user = authenticatedUser(request);

      if (!user.profileCompleted || !user.phoneVerified) {
        throw new AppError(
          'ONBOARDING_REQUIRED',
          'Selesaikan profil dan verifikasi telepon sebelum verifikasi wajah.',
          403,
          { required_step: user.profileCompleted ? 'phone' : 'profile' },
        );
      }

      if (!request.body.consent) {
        throw new BusinessRuleError(
          'FACE_CONSENT_REQUIRED',
          'Persetujuan eksplisit diperlukan sebelum verifikasi wajah.',
        );
      }

      const session = await faces.createSession({ userId: user.id, consent: true });

      await ctx.models.UserVerification.create({
        userId: user.id,
        verificationType: 'face',
        provider: faces.name,
        providerReference: session.sessionId,
        status: 'pending',
        verifiedAt: null,
        expiresAt: session.expiresAt ? new Date(session.expiresAt) : null,
      });

      user.faceVerificationStatus = 'pending';
      await user.save({ fields: ['faceVerificationStatus'] });

      return reply.status(201).send(
        ok({
          session: {
            id: session.sessionId,
            status: session.status,
            provider: faces.name,
            development: session.development,
            expires_at: session.expiresAt,
            notice: session.development
              ? 'Simulasi pengembangan — bukan verifikasi resmi.'
              : null,
          },
          onboarding: ctx.users.onboarding(user),
        }),
      );
    },
  );

  app.get<{ Params: FaceSessionParams }>(
    '/me/verification/face/session/:id',
    {
      preHandler: guards.authenticate,
      schema: { tags: ['onboarding'], summary: 'Face verification session status', ...sessionGuard },
    },
    async (request) => {
      const user = authenticatedUser(request);
      const record = await findOwnedSession(ctx, request, request.params.id);

      const providerStatus = await faces.getSessionStatus(request.params.id);
      return ok({
        session: {
          id: request.params.id,
          status: providerStatus ?? record.status,
          provider: record.provider,
          development: faces.development,
          notice: faces.development ? 'Simulasi pengembangan — bukan verifikasi resmi.' : null,
        },
        onboarding: ctx.users.onboarding(user),
      });
    },
  );

  /**
   * Provider callback. Authenticated by the provider signature, not by a user
   * token: the signature binds the call to one session and is single-use.
   */
  app.post<{ Body: FaceCallbackPayload }>(
    '/me/verification/face/callback',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['onboarding'],
        summary: 'Face verification provider callback (HMAC signed, replay protected)',
        body: Type.Object(
          {
            session_id: Type.String({ minLength: 1, maxLength: 190 }),
            status: Type.Union([Type.Literal('pending'), Type.Literal('verified'), Type.Literal('rejected')]),
            reason: Type.Optional(Type.String({ maxLength: 500 })),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const signatureHeader = request.headers['x-face-signature'];
      const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

      const result = await faces.processCallback(request.body, signature);

      const record = await ctx.models.UserVerification.findOne({
        where: { provider: faces.name, providerReference: result.sessionId, verificationType: 'face' },
      });
      if (!record) {
        throw new NotFoundError('Sesi verifikasi', 'FACE_SESSION_NOT_FOUND');
      }
      if (record.status !== 'pending') {
        throw new ConflictError(
          'FACE_CALLBACK_REPLAY',
          'Callback untuk sesi verifikasi ini sudah diproses.',
        );
      }

      record.status = result.status === 'verified' ? 'verified' : result.status === 'rejected' ? 'rejected' : 'pending';
      record.verifiedAt = result.status === 'verified' ? new Date() : null;
      await record.save();

      const user = await ctx.users.requireUserById(record.userId);
      user.faceVerificationStatus = record.status === 'pending' ? 'pending' : record.status;
      await user.save({ fields: ['faceVerificationStatus'] });

      return ok({
        session: { id: result.sessionId, status: record.status },
        onboarding: ctx.users.onboarding(user),
      });
    },
  );

  app.delete(
    '/me',
    {
      preHandler: guards.authenticate,
      config: { rateLimit: { max: 3, timeWindow: '1 hour' } },
      schema: {
        tags: ['profile'],
        summary: 'Request account deletion (30 day grace period, cancels on next sign-in)',
        ...sessionGuard,
      },
    },
    async (request, reply) => {
      const user = authenticatedUser(request);
      const requestedAt = await ctx.users.requestDeletion(user);
      const purgeAfter = new Date(
        requestedAt.getTime() + ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000,
      );

      return reply.status(202).send(
        ok({
          deletion_requested_at: requestedAt.toISOString(),
          grace_days: ACCOUNT_DELETION_GRACE_DAYS,
          purge_after: purgeAfter.toISOString(),
          message: 'Permintaan penghapusan dicatat. Masuk kembali sebelum tanggal tersebut untuk membatalkan.',
        }),
      );
    },
  );
};

async function findOwnedSession(
  ctx: AuthContext,
  request: FastifyRequest,
  sessionId: string,
): Promise<UserVerification> {
  const user = authenticatedUser(request);

  const record = await ctx.models.UserVerification.findOne({
    where: { userId: user.id, providerReference: sessionId, verificationType: 'face' },
  });
  if (!record) {
    throw new NotFoundError('Sesi verifikasi', 'FACE_SESSION_NOT_FOUND');
  }
  return record;
}
