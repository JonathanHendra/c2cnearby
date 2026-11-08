export type AppErrorDetails = unknown;

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: AppErrorDetails;

  constructor(code: string, message: string, statusCode = 500, details: AppErrorDetails = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Data permintaan tidak valid.', details: AppErrorDetails = null) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Sesi tidak valid atau sudah berakhir.') {
    super('UNAUTHENTICATED', message, 401);
    this.name = 'UnauthenticatedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Anda tidak memiliki akses ke sumber daya ini.') {
    super('FORBIDDEN', message, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Sumber daya', code = 'NOT_FOUND') {
    super(code, `${resource} tidak ditemukan.`, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string, details: AppErrorDetails = null) {
    super(code, message, 409, details);
    this.name = 'ConflictError';
  }
}

export class BusinessRuleError extends AppError {
  constructor(code: string, message: string, details: AppErrorDetails = null) {
    super(code, message, 422, details);
    this.name = 'BusinessRuleError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(code: string, message: string, details: AppErrorDetails = null) {
    super(code, message, 503, details);
    this.name = 'ServiceUnavailableError';
  }
}
