import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';

import { UPLOAD_LIMITS } from '../config/constants.js';

export async function registerMultipart(app: FastifyInstance): Promise<void> {
  await app.register(multipart, {
    limits: {
      fileSize: UPLOAD_LIMITS.maxFileSizeBytes,
      files: UPLOAD_LIMITS.maxFiles,
      fields: 20,
    },
    throwFileSizeLimit: true,
  });
}
