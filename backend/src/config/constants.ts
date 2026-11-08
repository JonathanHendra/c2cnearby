/** Discovery radius in meters. Decided by the backend; clients cannot widen it. */
export const DISCOVERY_RADIUS_M = 4_000;

/** Approximate degree padding used to build the bounding box before exact distance filtering. */
export const DISCOVERY_BOUNDING_BOX_DEGREES = 0.036;

export const PAGINATION = {
  defaultLimit: 20,
  maxLimit: 50,
} as const;

/** Default lifetime of a published sell/information post. */
export const LISTING_RETENTION_DAYS = 30;

/** Events stay visible for a week after they end so people can still find them. */
export const EVENT_EXPIRY_AFTER_END_DAYS = 7;

/** How often the background sweep marks expired listings. */
export const EXPIRY_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

export const API_PREFIX = '/api/v1';

export const UPLOAD_LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxFiles: 8,
} as const;
