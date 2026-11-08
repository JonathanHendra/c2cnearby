import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loadConfig, type AppConfig } from '../../src/config/env.js';
import { connectDatabase, disconnectDatabase, type Database } from '../../src/database/index.js';
import {
  createTestApp,
  fakeIdentity,
  resetAuthTables,
  type TestApp,
} from '../helpers/auth.js';
import { ensureSchema } from '../helpers/database.js';

let config: AppConfig;
let database: Database;
let harness: TestApp;
let app: FastifyInstance;

beforeAll(async () => {
  config = loadConfig();
  database = await connectDatabase(config);
  await ensureSchema(database.sequelize);
  harness = await createTestApp({ database, config });
  app = harness.app;
});

beforeEach(async () => {
  await resetAuthTables(database.sequelize);
});

afterAll(async () => {
  await app.close();
  await disconnectDatabase(database);
});

interface SessionBody {
  data: {
    user: {
      id: string;
      username: string;
      display_name: string | null;
      profile_completed: boolean;
      account_status: string;
      phone_verified: boolean;
    };
    onboarding: {
      state: string;
      required_step: string | null;
      capabilities: { browse: boolean; sell: boolean; chat: boolean };
    };
    session: { provider: string; sign_in_provider: string; token_expires_at: string | null };
  };
}

describe('POST /api/v1/auth/session', () => {
  it('provisions a new profile from a verified token', async () => {
    const token = harness.verifier.register('token-alice', fakeIdentity('alice'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/session',
      headers: harness.auth(token),
    });

    expect(response.statusCode).toBe(201);
    const body = response.json<SessionBody>();
    expect(body.data.user.username).toMatch(/^pengguna_[0-9a-f]{8}$/);
    expect(body.data.user.display_name).toBe('Nama alice');
    expect(body.data.user.profile_completed).toBe(false);
    expect(body.data.user.account_status).toBe('active');
    expect(body.data.onboarding.state).toBe('incomplete');
    expect(body.data.onboarding.required_step).toBe('profile');
    expect(body.data.onboarding.capabilities.browse).toBe(true);
    expect(body.data.session.provider).toBe('fake');
    expect(body.data.session.sign_in_provider).toBe('google.com');
  });

  it('is idempotent for an existing firebase uid', async () => {
    const token = harness.verifier.register('token-bob', fakeIdentity('bob'));

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/session',
      headers: harness.auth(token),
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/session',
      headers: harness.auth(token),
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json<SessionBody>().data.user.id).toBe(
      first.json<SessionBody>().data.user.id,
    );
  });

  it('rejects a missing bearer token with 401 UNAUTHENTICATED', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/session' });

    expect(response.statusCode).toBe(401);
    const body = response.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects an expired token with a refresh hint', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/session',
      headers: { authorization: 'Bearer something-expired' },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe('UNAUTHENTICATED');
    expect(body.error.message).toContain('kedaluwarsa');
  });

  it('blocks a suspended account', async () => {
    const token = harness.verifier.register('token-carol', fakeIdentity('carol'));
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/session',
      headers: harness.auth(token),
    });
    const userId = created.json<SessionBody>().data.user.id;

    await database.sequelize.query('UPDATE users SET account_status = ? WHERE id = ?', {
      replacements: ['suspended', userId],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/session',
      headers: harness.auth(token),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('FORBIDDEN');
  });

  it('requires session provisioning before private endpoints', async () => {
    const token = harness.verifier.register('token-dave', fakeIdentity('dave'));

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: harness.auth(token),
    });

    expect(response.statusCode).toBe(401);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('UNAUTHENTICATED');
  });
});
