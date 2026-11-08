import type { FastifyInstance } from 'fastify';
import type { Sequelize } from 'sequelize';

import { createTestApp, fakeIdentity, type TestApp } from './auth.js';

export const TEST_CATEGORIES = {
  sell: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  event: 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
  information: 'cccccccc-3333-4333-8333-cccccccccccc',
} as const;

/** Clears every table Phase 4 writes to. FKs are disabled for the truncate. */
export async function resetMarketplaceTables(sequelize: Sequelize): Promise<void> {
  const tables = [
    'listing_images',
    'favorites',
    'event_participants',
    'listings',
    'categories',
    'user_locations',
    'user_verifications',
    'users',
  ];

  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const table of tables) {
      await sequelize.query(`TRUNCATE TABLE \`${table}\``);
    }
  } finally {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

export async function seedCategories(sequelize: Sequelize): Promise<void> {
  await sequelize.query(
    `INSERT INTO categories (id, name, slug, post_type, sort_order, is_active, created_at, updated_at)
     VALUES
       (?, 'Elektronik', 'elektronik', 'sell', 1, 1, NOW(3), NOW(3)),
       (?, 'Komunitas', 'komunitas', 'event', 2, 1, NOW(3), NOW(3)),
       (?, 'Info Lingkungan', 'info-lingkungan', 'information', 3, 1, NOW(3), NOW(3))`,
    {
      replacements: [TEST_CATEGORIES.sell, TEST_CATEGORIES.event, TEST_CATEGORIES.information],
    },
  );
}

export interface ProvisionedUser {
  readonly token: string;
  readonly id: string;
  readonly username: string;
}

export async function provisionUser(
  harness: TestApp,
  app: FastifyInstance,
  uid: string,
  coords?: { lat: number; lng: number },
): Promise<ProvisionedUser> {
  const token = harness.verifier.register(`token-${uid}`, fakeIdentity(uid));
  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/session',
    headers: harness.auth(token),
  });
  if (created.statusCode !== 201) {
    throw new Error(`provision failed: ${created.statusCode} ${created.body}`);
  }
  const id = created.json<{ data: { user: { id: string } } }>().data.user.id;

  const username = `u_${uid.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 12)}`;
  const claimed = await app.inject({
    method: 'PATCH',
    url: '/api/v1/me/username',
    headers: harness.auth(token),
    payload: { username },
  });
  if (claimed.statusCode !== 200) {
    throw new Error(`username failed: ${claimed.statusCode} ${claimed.body}`);
  }

  const profile = await app.inject({
    method: 'PATCH',
    url: '/api/v1/me',
    headers: harness.auth(token),
    payload: { display_name: `Nama ${uid}`, area_label: 'Kemang, Jakarta Selatan' },
  });
  if (profile.statusCode !== 200) {
    throw new Error(`profile failed: ${profile.statusCode} ${profile.body}`);
  }

  if (coords) {
    const location = await app.inject({
      method: 'PUT',
      url: '/api/v1/me/location',
      headers: harness.auth(token),
      payload: { ...coords, area_label: 'Kemang' },
    });
    if (location.statusCode !== 200) {
      throw new Error(`location failed: ${location.statusCode} ${location.body}`);
    }
  }

  return { token, id, username };
}

export async function freshApp(options: {
  config: Parameters<typeof createTestApp>[0]['config'];
  database: Parameters<typeof createTestApp>[0]['database'];
}): Promise<TestApp> {
  return createTestApp(options);
}
