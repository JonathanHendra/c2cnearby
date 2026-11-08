import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loadConfig, type AppConfig } from '../../src/config/env.js';
import { connectDatabase, disconnectDatabase, type Database } from '../../src/database/index.js';
import { createTestApp, fakeIdentity, resetAuthTables, type TestApp } from '../helpers/auth.js';
import { ensureSchema } from '../helpers/database.js';

let config: AppConfig;
let database: Database;
let harness: TestApp;
let app: FastifyInstance;

interface AdminBody {
  data: {
    admin: { id: string; email: string | null; role: string; is_active: boolean; last_login_at: string | null };
    permissions: string[];
  };
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

describe('admin session', () => {
  it('rejects a token with no admin row', async () => {
    const token = harness.verifier.register('token-nobody', fakeIdentity('nobody'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/session',
      headers: harness.auth(token),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('FORBIDDEN');
  });

  it('rejects an inactive admin', async () => {
    const token = harness.verifier.register('token-inactive', fakeIdentity('inactive'));
    await database.sequelize.query(
      `INSERT INTO admin_users (id, firebase_uid, email, role, is_active, created_at, updated_at)
       VALUES (UUID(), ?, ?, 'moderator', 0, NOW(3), NOW(3))`,
      { replacements: ['inactive', 'inactive@example.test'] },
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/session',
      headers: harness.auth(token),
    });

    expect(response.statusCode).toBe(403);
  });

  it('issues a session with role permissions and records the login time', async () => {
    const token = harness.verifier.register('token-suadmin', fakeIdentity('suadmin'));
    await database.sequelize.query(
      `INSERT INTO admin_users (id, firebase_uid, email, role, is_active, created_at, updated_at)
       VALUES (UUID(), ?, NULL, 'super_admin', 1, NOW(3), NOW(3))`,
      { replacements: ['suadmin'] },
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/session',
      headers: harness.auth(token),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<AdminBody>();
    expect(body.data.admin.role).toBe('super_admin');
    expect(body.data.admin.email).toBe('suadmin@example.test');
    expect(body.data.admin.is_active).toBe(true);
    expect(body.data.admin.last_login_at).not.toBeNull();
    expect(body.data.permissions).toContain('admins:manage');
    expect(body.data.permissions).toContain('audit:read');
  });

  it('exposes /admin/auth/me only to active admins', async () => {
    const userToken = harness.verifier.register('token-user', fakeIdentity('userone'));
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/session',
      headers: harness.auth(userToken),
    });

    const asUser = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/auth/me',
      headers: harness.auth(userToken),
    });
    expect(asUser.statusCode).toBe(403);

    const adminToken = harness.verifier.register('token-mod', fakeIdentity('mod'));
    await database.sequelize.query(
      `INSERT INTO admin_users (id, firebase_uid, email, role, is_active, created_at, updated_at)
       VALUES (UUID(), ?, NULL, 'moderator', 1, NOW(3), NOW(3))`,
      { replacements: ['mod'] },
    );

    const asAdmin = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/auth/me',
      headers: harness.auth(adminToken),
    });

    expect(asAdmin.statusCode).toBe(200);
    const body = asAdmin.json<AdminBody>();
    expect(body.data.admin.role).toBe('moderator');
    expect(body.data.permissions).toContain('listings:moderate');
    expect(body.data.permissions).not.toContain('admins:manage');
  });
});
