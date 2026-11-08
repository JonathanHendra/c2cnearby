import { access } from 'node:fs/promises';
import { join } from 'node:path';

import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loadConfig, type AppConfig } from '../../src/config/env.js';
import { connectDatabase, disconnectDatabase, type Database } from '../../src/database/index.js';
import { signFaceCallback } from '../../src/services/face-verification.js';
import {
  createTestApp,
  fakeIdentity,
  resetAuthTables,
  TEST_FACE_SECRET,
  type FakeTokenVerifier,
  type TestApp,
} from '../helpers/auth.js';
import { ensureSchema } from '../helpers/database.js';

let config: AppConfig;
let database: Database;
let harness: TestApp;
let app: FastifyInstance;

interface FaceBody {
  data: {
    session: { id: string; status: string; provider: string; development: boolean; notice: string | null };
    onboarding: { state: string };
  };
}

async function provision(
  verifier: FakeTokenVerifier,
  uid: string,
): Promise<{ token: string; userId: string }> {
  const token = verifier.register(`token-${uid}`, fakeIdentity(uid));
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/session',
    headers: harness.auth(token),
  });
  expect(response.statusCode).toBe(201);
  return {
    token,
    userId: response.json<{ data: { user: { id: string } } }>().data.user.id,
  };
}

/** Face verification is only reachable after profile + phone onboarding. */
async function provisionVerifiedPhone(
  verifier: FakeTokenVerifier,
  uid: string,
): Promise<{ token: string; userId: string }> {
  const token = verifier.register(
    `token-${uid}`,
    fakeIdentity(uid, { phoneNumber: '+628111222333' }),
  );
  const session = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/session',
    headers: harness.auth(token),
  });
  expect(session.statusCode).toBe(201);
  const userId = session.json<{ data: { user: { id: string } } }>().data.user.id;

  const username = await app.inject({
    method: 'PATCH',
    url: '/api/v1/me/username',
    headers: harness.auth(token),
    payload: { username: `${uid}_warga` },
  });
  expect(username.statusCode).toBe(200);

  const profile = await app.inject({
    method: 'PATCH',
    url: '/api/v1/me',
    headers: harness.auth(token),
    payload: { display_name: `Nama ${uid}`, area_label: 'Kel. Cibinong' },
  });
  expect(profile.statusCode).toBe(200);

  const phone = await app.inject({
    method: 'POST',
    url: '/api/v1/me/phone/verify',
    headers: harness.auth(token),
    payload: {},
  });
  expect(phone.statusCode).toBe(200);

  return { token, userId };
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

describe('face verification adapter', () => {
  it('requires explicit consent', async () => {
    const { token } = await provisionVerifiedPhone(harness.verifier, 'oka');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/me/verification/face/session',
      headers: harness.auth(token),
      payload: { consent: false },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json<{ error: { code: string } }>().error.code).toBe(
      'FACE_CONSENT_REQUIRED',
    );
  });

  it('creates a pending session and exposes it to its owner only', async () => {
    const owner = await provisionVerifiedPhone(harness.verifier, 'putri');
    const stranger = await provision(harness.verifier, 'qori');

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/me/verification/face/session',
      headers: harness.auth(owner.token),
      payload: { consent: true },
    });

    expect(created.statusCode).toBe(201);
    const session = created.json<FaceBody>().data.session;
    expect(session.status).toBe('pending');
    expect(session.development).toBe(false);

    const own = await app.inject({
      method: 'GET',
      url: `/api/v1/me/verification/face/session/${session.id}`,
      headers: harness.auth(owner.token),
    });
    expect(own.statusCode).toBe(200);

    const foreign = await app.inject({
      method: 'GET',
      url: `/api/v1/me/verification/face/session/${session.id}`,
      headers: harness.auth(stranger.token),
    });
    expect(foreign.statusCode).toBe(404);
    expect(foreign.json<{ error: { code: string } }>().error.code).toBe(
      'FACE_SESSION_NOT_FOUND',
    );
  });

  it('rejects an unsigned callback and accepts a correctly signed one once', async () => {
    const { token } = await provisionVerifiedPhone(harness.verifier, 'rian');

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/me/verification/face/session',
      headers: harness.auth(token),
      payload: { consent: true },
    });
    const sessionId = created.json<FaceBody>().data.session.id;

    const unsigned = await app.inject({
      method: 'POST',
      url: '/api/v1/me/verification/face/callback',
      payload: { session_id: sessionId, status: 'verified' },
    });
    expect(unsigned.statusCode).toBe(403);
    expect(unsigned.json<{ error: { code: string } }>().error.code).toBe(
      'FACE_SIGNATURE_INVALID',
    );

    const payload = { session_id: sessionId, status: 'verified' as const };
    const signature = signFaceCallback(payload, TEST_FACE_SECRET);

    const signed = await app.inject({
      method: 'POST',
      url: '/api/v1/me/verification/face/callback',
      headers: { 'x-face-signature': signature },
      payload,
    });

    expect(signed.statusCode).toBe(200);
    expect(signed.json<FaceBody>().data.onboarding.state).toBe('verified');

    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/me/verification/face/callback',
      headers: { 'x-face-signature': signature },
      payload,
    });
    expect(replay.statusCode).toBe(409);
    expect(replay.json<{ error: { code: string } }>().error.code).toBe(
      'FACE_CALLBACK_REPLAY',
    );
  });
});

describe('POST /api/v1/me/avatar', () => {
  function multipart(png: Buffer): {
    payload: Buffer;
    contentType: string;
  } {
    const boundary = '----c2c-test-boundary';
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
          'Content-Disposition: form-data; name="file"; filename="avatar.png"\r\n' +
          'Content-Type: image/png\r\n\r\n',
      ),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return { payload, contentType: `multipart/form-data; boundary=${boundary}` };
  }

  it('converts the upload to a 512 px WebP and updates the profile', async () => {
    const { token, userId } = await provision(harness.verifier, 'sinta');
    const png = await sharp({
      create: { width: 900, height: 600, channels: 3, background: '#4f46e5' },
    })
      .png()
      .toBuffer();

    const body = multipart(png);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/me/avatar',
      headers: { ...harness.auth(token), 'content-type': body.contentType },
      payload: body.payload,
    });

    expect(response.statusCode).toBe(200);
    const json = response.json<{
      data: { user: { avatar_url: string }; image: { url: string; width: number; height: number; mime: string } };
    }>();
    expect(json.data.image.mime).toBe('image/webp');
    expect(json.data.image.width).toBe(512);
    expect(json.data.image.height).toBe(512);
    expect(json.data.user.avatar_url).toContain('/uploads/avatars/');

    await expect(access(join(config.storage.uploadDir, 'avatars', `${userId}.webp`))).resolves.toBeUndefined();
  });

  it('rejects a non-image payload with INVALID_IMAGE', async () => {
    const { token } = await provision(harness.verifier, 'tono');
    const body = multipart(Buffer.from('bukan gambar sama sekali'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/me/avatar',
      headers: { ...harness.auth(token), 'content-type': body.contentType },
      payload: body.payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('VALIDATION_ERROR');
  });
});
