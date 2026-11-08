import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';

import { createAuthGuards, createTokenVerifier, type AuthContext } from './auth/index.js';
import type { TokenVerifier } from './auth/types.js';
import { API_PREFIX, UPLOAD_LIMITS } from './config/constants.js';
import type { AppConfig } from './config/env.js';
import type { Database } from './database/index.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerMultipart } from './plugins/multipart.js';
import { registerSecurity } from './plugins/security.js';
import { registerSwagger } from './plugins/swagger.js';
import { startListingExpiryJob, sweepExpiredListings } from './jobs/listing-expiry.js';
import { adminAuthRoutes } from './routes/admin-auth.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { inboxRoutes } from './routes/inbox.js';
import { listingRoutes } from './routes/listings.js';
import { meRoutes } from './routes/me.js';
import { systemRoutes } from './routes/system.js';
import {
  MockFaceVerificationProvider,
  type FaceVerificationProvider,
} from './services/face-verification.js';
import { ListingMediaService } from './services/listing-media.js';
import { ListingService } from './services/listing-service.js';
import { UserService } from './services/user-service.js';
import { AvatarStorage } from './storage/avatar-storage.js';
import { createStorageService } from './storage/storage-service.js';

/** Test seams: production always resolves the Firebase verifier and mock face provider. */
export interface AuthOverrides {
  readonly verifier?: TokenVerifier;
  readonly faceProvider?: FaceVerificationProvider;
}

export interface BuildAppOptions {
  readonly config: AppConfig;
  readonly database: Database;
  readonly auth?: AuthOverrides;
}

const MAX_REQUEST_ID_LENGTH = 128;

function resolveRequestId(header: string | string[] | undefined): string {
  const candidate = Array.isArray(header) ? header[0] : header;
  if (candidate && candidate.length > 0 && candidate.length <= MAX_REQUEST_ID_LENGTH) {
    return candidate;
  }
  return randomUUID();
}

function loggerOptions(config: AppConfig): false | Record<string, unknown> {
  if (config.nodeEnv === 'test') {
    return false;
  }

  const base = {
    level: config.logLevel,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'phone_private',
        'location_private',
      ],
      censor: '[redacted]',
    },
  };

  if (config.nodeEnv === 'development') {
    return {
      ...base,
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'SYS:standard', singleLine: true, ignore: 'pid,hostname' },
      },
    };
  }

  return base;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { config, database } = options;

  const app = Fastify({
    logger: loggerOptions(config),
    genReqId: (request) => resolveRequestId(request.headers['x-request-id']),
    trustProxy: config.isProduction,
    bodyLimit: UPLOAD_LIMITS.maxFileSizeBytes,
  });

  app.decorate('database', database);
  app.decorate('appConfig', config);

  registerErrorHandler(app);

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-request-id', request.id);
    return payload;
  });

  await registerSecurity(app, config);
  await registerSwagger(app, config);
  await registerMultipart(app);

  const verifier = options.auth?.verifier ?? createTokenVerifier(config);
  const users = new UserService(database.models);
  const faces =
    options.auth?.faceProvider ?? new MockFaceVerificationProvider(config.face.callbackSecret);
  const avatars = new AvatarStorage(config);
  await avatars.ensureDirectory();

  const storage = createStorageService(config);
  await mkdir(resolve(config.storage.uploadDir), { recursive: true });
  const listings = new ListingService(
    database.models,
    users,
    new ListingMediaService(storage),
  );

  await app.register(fastifyStatic, {
    root: resolve(config.storage.uploadDir),
    prefix: '/uploads',
    decorateReply: false,
    index: false,
  });

  const ctx: AuthContext = { config, models: database.models, users, verifier };
  const guards = createAuthGuards(ctx);

  await app.register(systemRoutes);
  await app.register(systemRoutes, { prefix: API_PREFIX });
  await app.register(authRoutes, { prefix: API_PREFIX, ctx, guards });
  await app.register(meRoutes, { prefix: API_PREFIX, ctx, guards, faces, avatars });
  await app.register(adminAuthRoutes, { prefix: API_PREFIX, ctx, guards });
  await app.register(adminRoutes, { prefix: API_PREFIX, ctx, guards });
  await app.register(inboxRoutes, { prefix: API_PREFIX, ctx, guards });
  await app.register(listingRoutes, { prefix: API_PREFIX, ctx, guards, listings });

  if (config.nodeEnv !== 'test') {
    void sweepExpiredListings(listings, app).catch((error: unknown) => {
      app.log.error({ err: error }, 'initial listing expiry sweep failed');
    });
    const timer = startListingExpiryJob(listings, app);
    app.addHook('onClose', async () => {
      clearInterval(timer);
    });
  }

  return app;
}
