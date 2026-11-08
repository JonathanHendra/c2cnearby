import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';

import { ServiceUnavailableError } from '../common/errors.js';
import { ok } from '../common/response.js';
import { DISCOVERY_RADIUS_M } from '../config/constants.js';
import { checkMigrationStatus } from '../database/migration-runner.js';

const errorSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    details: Type.Any(),
    request_id: Type.Optional(Type.String()),
  }),
});

const healthSchema = Type.Object({
  data: Type.Object({
    status: Type.String(),
    uptime_seconds: Type.Number(),
    timestamp: Type.String(),
  }),
});

const readinessSchema = Type.Object({
  data: Type.Object({
    status: Type.String(),
    database: Type.String(),
    migrations: Type.Object({
      applied: Type.Number(),
      pending: Type.Number(),
      latest: Type.Union([Type.String(), Type.Null()]),
    }),
    discovery_radius_m: Type.Number(),
  }),
});

export async function systemRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/healthz',
    {
      schema: {
        tags: ['system'],
        summary: 'Liveness probe — never touches the database',
        response: { 200: healthSchema },
      },
    },
    async () => {
      return ok({
        status: 'ok',
        uptime_seconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    },
  );

  app.get(
    '/readyz',
    {
      schema: {
        tags: ['system'],
        summary: 'Readiness probe — database connectivity and migration state',
        response: { 200: readinessSchema, 503: errorSchema },
      },
    },
    async () => {
      try {
        await app.database.sequelize.query('SELECT 1');
      } catch {
        throw new ServiceUnavailableError(
          'DB_UNAVAILABLE',
          'Database tidak dapat dihubungi.',
        );
      }

      const status = await checkMigrationStatus(app.database.sequelize);

      return ok({
        status: 'ready',
        database: 'up',
        migrations: {
          applied: status.applied.length,
          pending: status.pending.length,
          latest: status.latest,
        },
        discovery_radius_m: DISCOVERY_RADIUS_M,
      });
    },
  );
}

