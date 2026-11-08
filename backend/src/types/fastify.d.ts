import type { VerifiedIdentity } from '../auth/types.js';
import type { AppConfig } from '../config/env.js';
import type { AdminUser } from '../database/models/admin.model.js';
import type { User } from '../database/models/user.model.js';
import type { Database } from '../database/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    readonly database: Database;
    readonly appConfig: AppConfig;
  }

  interface FastifyRequest {
    /** Set by the `authenticate` guard after the token and local profile are validated. */
    authUser?: User | undefined;
    /** Verified provider facts; never taken from the request body. */
    identity?: VerifiedIdentity | undefined;
    /** Set by the `requireAdmin`/`authorize` guards. */
    adminUser?: AdminUser | undefined;
  }
}
