import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';
import { loadConfig, type AppConfig } from '../../src/config/env.js';
import { connectDatabase, disconnectDatabase, type Database } from '../../src/database/index.js';
import { migrations } from '../../src/database/migrations/index.js';
import { ensureSchema } from '../helpers/database.js';

let config: AppConfig;
let database: Database;
let app: FastifyInstance;

beforeAll(async () => {
  config = loadConfig();
  database = await connectDatabase(config);
  await ensureSchema(database.sequelize);
  app = await buildApp({ config, database });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await disconnectDatabase(database);
});

describe('system routes', () => {
  it('serves /healthz without touching the database', async () => {
    const response = await app.inject({ method: 'GET', url: '/healthz' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.headers['x-request-id']).toBeTruthy();
    const body = response.json<{ data: { status: string; uptime_seconds: number } }>();
    expect(body.data.status).toBe('ok');
    expect(typeof body.data.uptime_seconds).toBe('number');
  });

  it('mirrors the probes under /api/v1', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/healthz' });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ data: { status: string } }>().data.status).toBe('ok');
  });

  it('propagates a caller supplied request id', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { 'x-request-id': 'phase2-test-request' },
    });
    expect(response.headers['x-request-id']).toBe('phase2-test-request');
  });

  it('reports ready when the schema is migrated', async () => {
    const response = await app.inject({ method: 'GET', url: '/readyz' });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      data: {
        status: string;
        database: string;
        migrations: { applied: number; pending: number; latest: string | null };
        discovery_radius_m: number;
      };
    }>();
    expect(body.data.status).toBe('ready');
    expect(body.data.database).toBe('up');
    expect(body.data.migrations.pending).toBe(0);
    expect(body.data.migrations.applied).toBe(migrations.length);
    expect(body.data.discovery_radius_m).toBe(4000);
  });

  it('fails readiness with DB_MIGRATIONS_PENDING when a migration is missing', async () => {
    const latest = migrations.at(-1);
    expect(latest).toBeDefined();
    if (!latest) {
      return;
    }

    await database.sequelize.query('DELETE FROM SequelizeMeta WHERE name = ?', {
      replacements: [latest.name],
    });

    try {
      const response = await app.inject({ method: 'GET', url: '/readyz' });
      expect(response.statusCode).toBe(503);
      const body = response.json<{
        error: { code: string; message: string; details: { pending: string[] }; request_id: string };
      }>();
      expect(body.error.code).toBe('DB_MIGRATIONS_PENDING');
      expect(body.error.details.pending).toContain(latest.name);
      expect(body.error.request_id).toBeTruthy();
    } finally {
      await database.sequelize.query('INSERT INTO SequelizeMeta (name) VALUES (?)', {
        replacements: [latest.name],
      });
    }
  });

  it('returns the error envelope for unknown routes', async () => {
    const response = await app.inject({ method: 'GET', url: '/does-not-exist' });
    expect(response.statusCode).toBe(404);
    const body = response.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message.length).toBeGreaterThan(0);
  });

  it('sets baseline security headers', async () => {
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['x-frame-options']).toBeDefined();
  });

  it('serves Swagger UI outside production', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs' });
    expect([200, 302]).toContain(response.statusCode);
  });
});
