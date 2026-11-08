import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loadConfig, type AppConfig } from '../../src/config/env.js';
import { connectDatabase, disconnectDatabase, type Database } from '../../src/database/index.js';
import {
  createTestApp,
  fakeIdentity,
  resetAuthTables,
  type FakeTokenVerifier,
  type TestApp,
} from '../helpers/auth.js';
import { ensureSchema } from '../helpers/database.js';

let config: AppConfig;
let database: Database;
let harness: TestApp;
let app: FastifyInstance;

interface ProfileBody {
  data: {
    user: {
      id: string;
      username: string;
      display_name: string | null;
      area_label: string | null;
      profile_completed: boolean;
      phone_verified: boolean;
      phone: string | null;
      phone_masked: string | null;
      username_chosen: boolean;
      account_status: string;
    };
    onboarding: { state: string; required_step: string | null; capabilities: { sell: boolean; chat: boolean } };
  };
}

async function provision(
  verifier: FakeTokenVerifier,
  uid: string,
  phone: string | null = null,
): Promise<{ token: string; userId: string }> {
  const token = verifier.register(`token-${uid}`, fakeIdentity(uid, { phoneNumber: phone }));
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/session',
    headers: harness.auth(token),
  });
  expect(response.statusCode).toBe(201);
  return { token, userId: response.json<ProfileBody>().data.user.id };
}

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

describe('profile onboarding', () => {
  it('completes the profile once username, display name and area are set', async () => {
    const { token } = await provision(harness.verifier, 'erin');

    const username = await app.inject({
      method: 'PATCH',
      url: '/api/v1/me/username',
      headers: harness.auth(token),
      payload: { username: 'Erin_Sari' },
    });
    expect(username.statusCode).toBe(200);
    expect(username.json<ProfileBody>().data.user.username).toBe('erin_sari');
    expect(username.json<ProfileBody>().data.user.username_chosen).toBe(true);

    const profile = await app.inject({
      method: 'PATCH',
      url: '/api/v1/me',
      headers: harness.auth(token),
      payload: { display_name: 'Erin Sari', area_label: 'Kel. Cibinong, Karawang' },
    });

    expect(profile.statusCode).toBe(200);
    const body = profile.json<ProfileBody>();
    expect(body.data.user.profile_completed).toBe(true);
    expect(body.data.onboarding.state).toBe('profile_completed');
    expect(body.data.onboarding.required_step).toBe('phone');
    expect(body.data.onboarding.capabilities.sell).toBe(true);
    expect(body.data.onboarding.capabilities.chat).toBe(false);
  });

  it('rejects an invalid username format', async () => {
    const { token } = await provision(harness.verifier, 'fajar');

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/me/username',
      headers: harness.auth(token),
      payload: { username: 'ab' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects reserved usernames', async () => {
    const { token } = await provision(harness.verifier, 'gita');

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/me/username',
      headers: harness.auth(token),
      payload: { username: 'admin' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('USERNAME_RESERVED');
  });

  it('rejects a username already taken by another user', async () => {
    const first = await provision(harness.verifier, 'hadi');
    const second = await provision(harness.verifier, 'indah');

    const claim = await app.inject({
      method: 'PATCH',
      url: '/api/v1/me/username',
      headers: harness.auth(second.token),
      payload: { username: 'hadi_utama' },
    });
    expect(claim.statusCode).toBe(200);

    const conflict = await app.inject({
      method: 'PATCH',
      url: '/api/v1/me/username',
      headers: harness.auth(first.token),
      payload: { username: 'hadi_utama' },
    });

    expect(conflict.statusCode).toBe(409);
    expect(conflict.json<{ error: { code: string } }>().error.code).toBe('USERNAME_TAKEN');
  });

  it('mirrors a Firebase phone credential and masks the number', async () => {
    const { token } = await provision(harness.verifier, 'joko', '+628123456789');

    await app.inject({
      method: 'PATCH',
      url: '/api/v1/me/username',
      headers: harness.auth(token),
      payload: { username: 'joko_utama' },
    });
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/me',
      headers: harness.auth(token),
      payload: { display_name: 'Joko Utama', area_label: 'Kel. Cibinong' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/me/phone/verify',
      headers: harness.auth(token),
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<ProfileBody>();
    expect(body.data.user.phone_verified).toBe(true);
    expect(body.data.user.phone).toBe('+628123456789');
    expect(body.data.user.phone_masked).toBe('+628•••••789');
    expect(body.data.onboarding.state).toBe('phone_verified');
  });

  it('refuses phone verification when the token carries no number', async () => {
    const { token } = await provision(harness.verifier, 'kiki');

    await app.inject({
      method: 'PATCH',
      url: '/api/v1/me/username',
      headers: harness.auth(token),
      payload: { username: 'kiki_aja' },
    });
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/me',
      headers: harness.auth(token),
      payload: { display_name: 'Kiki Aja', area_label: 'Kel. Cibinong' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/me/phone/verify',
      headers: harness.auth(token),
      payload: {},
    });

    expect(response.statusCode).toBe(422);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('PHONE_NOT_VERIFIED');
  });

  it('stores and returns the private location', async () => {
    const { token } = await provision(harness.verifier, 'lukman');

    const put = await app.inject({
      method: 'PUT',
      url: '/api/v1/me/location',
      headers: harness.auth(token),
      payload: { lat: -6.4025, lng: 106.7942, area_label: 'Kel. Sukmajaya' },
    });
    expect(put.statusCode).toBe(200);

    const get = await app.inject({
      method: 'GET',
      url: '/api/v1/me/location',
      headers: harness.auth(token),
    });

    expect(get.statusCode).toBe(200);
    const location = get.json<{ data: { location: { lat: number; lng: number; area_label: string } } }>()
      .data.location;
    expect(location.lat).toBeCloseTo(-6.4025, 5);
    expect(location.lng).toBeCloseTo(106.7942, 5);
    expect(location.area_label).toBe('Kel. Sukmajaya');
  });

  it('rejects an out-of-range coordinate', async () => {
    const { token } = await provision(harness.verifier, 'mira');

    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/me/location',
      headers: harness.auth(token),
      payload: { lat: 91, lng: 106.8 },
    });

    expect(response.statusCode).toBe(400);
  });

  it('requests deletion, then cancels it on the next sign-in', async () => {
    const { token } = await provision(harness.verifier, 'nanda');

    const deletion = await app.inject({
      method: 'DELETE',
      url: '/api/v1/me',
      headers: harness.auth(token),
    });
    expect(deletion.statusCode).toBe(202);
    const payload = deletion.json<{
      data: { grace_days: number; purge_after: string; deletion_requested_at: string };
    }>();
    expect(payload.data.grace_days).toBe(30);
    expect(new Date(payload.data.purge_after).getTime()).toBeGreaterThan(
      new Date(payload.data.deletion_requested_at).getTime(),
    );

    const blocked = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: harness.auth(token),
    });
    expect(blocked.statusCode).toBe(403);

    const resign = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/session',
      headers: harness.auth(token),
    });
    expect(resign.statusCode).toBe(200);
    expect(resign.json<ProfileBody>().data.user.account_status).toBe('active');
  });
});
