import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

import type { AppConfig } from '../config/env.js';

export async function registerSwagger(app: FastifyInstance, config: AppConfig): Promise<void> {
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'C2C Nearby API',
        description:
          'Hyperlocal C2C marketplace API. Discovery radius and visibility are decided server-side.',
        version: '0.1.0',
      },
      servers: [{ url: '/', description: 'Current host' }],
      tags: [
        { name: 'system', description: 'Liveness, readiness and operational checks' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'Firebase ID token' },
        },
      },
    },
  });

  if (config.isProduction) {
    return;
  }

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true, persistAuthorization: true },
    staticCSP: false,
  });
}
