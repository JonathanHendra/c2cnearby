import type { AppErrorDetails } from './errors.js';

export interface ResponseMeta {
  [key: string]: unknown;
}

export interface SuccessEnvelope<T> {
  data: T;
  meta?: ResponseMeta;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: AppErrorDetails;
    request_id?: string;
  };
}

export function ok<T>(data: T, meta?: ResponseMeta): SuccessEnvelope<T> {
  return meta ? { data, meta } : { data };
}

export function errorEnvelope(
  code: string,
  message: string,
  details: AppErrorDetails = null,
  requestId?: string,
): ErrorEnvelope {
  return {
    error: {
      code,
      message,
      details,
      ...(requestId ? { request_id: requestId } : {}),
    },
  };
}
