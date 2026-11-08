import { Type } from '@sinclair/typebox';

/** Shared error envelope schema used by Swagger documentation. */
export const errorEnvelopeSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    details: Type.Any(),
    request_id: Type.Optional(Type.String()),
  }),
});

export const unauthorizedEnvelope = errorEnvelopeSchema;
export const forbiddenEnvelope = errorEnvelopeSchema;
export const notFoundEnvelope = errorEnvelopeSchema;
export const validationEnvelope = errorEnvelopeSchema;
