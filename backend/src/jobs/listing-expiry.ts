import { EXPIRY_SWEEP_INTERVAL_MS } from '../config/constants.js';
import type { FastifyInstance } from 'fastify';
import type { ListingService } from '../services/listing-service.js';

/**
 * Marks active listings whose expires_at has passed. The schema index
 * `idx_listings_expiry (status, expires_at)` keeps the sweep cheap.
 */
export async function sweepExpiredListings(
  listings: ListingService,
  app: FastifyInstance,
): Promise<number> {
  const expired = await listings.expireDue();
  if (expired > 0) {
    app.log.info({ expired }, 'listings marked expired');
  }
  return expired;
}

/** Starts the background sweep. Timers are unref'd so shutdown is not blocked. */
export function startListingExpiryJob(
  listings: ListingService,
  app: FastifyInstance,
  intervalMs: number = EXPIRY_SWEEP_INTERVAL_MS,
): NodeJS.Timeout {
  const timer = setInterval(() => {
    void sweepExpiredListings(listings, app).catch((error: unknown) => {
      app.log.error({ err: error }, 'listing expiry sweep failed');
    });
  }, intervalMs);
  timer.unref();
  return timer;
}
