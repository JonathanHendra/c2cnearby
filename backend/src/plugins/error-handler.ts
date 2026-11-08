import type { FastifyError, FastifyInstance } from 'fastify';

import { AppError } from '../common/errors.js';
import { errorEnvelope } from '../common/response.js';

interface ValidationDetail {
  readonly path: string;
  readonly message: string;
}

function validationDetails(error: FastifyError): ValidationDetail[] {
  return (error.validation ?? []).map((issue) => {
    const missing = issue.params?.['missingProperty'];
    return {
      path: issue.instancePath || (typeof missing === 'string' ? missing : ''),
      message: issue.message ?? 'Nilai tidak valid.',
    };
  });
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    return reply
      .status(404)
      .send(errorEnvelope('NOT_FOUND', 'Endpoint tidak ditemukan.', null, request.id));
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        request.log.error({ err: error, code: error.code }, 'request failed');
      }
      return reply
        .status(error.statusCode)
        .send(errorEnvelope(error.code, error.message, error.details, request.id));
    }

    if (error.validation) {
      return reply
        .status(400)
        .send(
          errorEnvelope(
            'VALIDATION_ERROR',
            'Data permintaan tidak valid.',
            validationDetails(error),
            request.id,
          ),
        );
    }

    if (error.statusCode === 429) {
      return reply
        .status(429)
        .send(
          errorEnvelope(
            'RATE_LIMITED',
            'Terlalu banyak permintaan. Coba lagi nanti.',
            null,
            request.id,
          ),
        );
    }

    switch (error.code) {
      case 'FST_ERR_CTP_INVALID_JSON_BODY':
        return reply
          .status(400)
          .send(errorEnvelope('INVALID_JSON', 'Body JSON tidak dapat dibaca.', null, request.id));
      case 'FST_ERR_CTP_BODY_TOO_LARGE':
        return reply
          .status(413)
          .send(errorEnvelope('PAYLOAD_TOO_LARGE', 'Ukuran body melebihi batas.', null, request.id));
      case 'FST_ERR_CTP_INVALID_MEDIA_TYPE':
        return reply
          .status(415)
          .send(
            errorEnvelope('UNSUPPORTED_MEDIA_TYPE', 'Tipe konten tidak didukung.', null, request.id),
          );
      default:
        break;
    }

    request.log.error({ err: error }, 'unhandled error');
    return reply
      .status(500)
      .send(
        errorEnvelope(
          'INTERNAL_ERROR',
          'Terjadi kesalahan pada server.',
          null,
          request.id,
        ),
      );
  });
}
