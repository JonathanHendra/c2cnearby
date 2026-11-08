import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loadConfig, type AppConfig } from '../../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../../src/database/index.js';
import { createTestSequelize, ensureSchema } from '../helpers/database.js';
import {
  createTestApp,
  fakeIdentity,
  type TestApp,
} from '../helpers/auth.js';
import {
  provisionUser,
  resetMarketplaceTables,
  seedCategories,
  TEST_CATEGORIES,
  type ProvisionedUser,
} from '../helpers/marketplace.js';
import { ListingMediaService } from '../../src/services/listing-media.js';
import { ListingService } from '../../src/services/listing-service.js';
import { UserService } from '../../src/services/user-service.js';
import { createStorageService } from '../../src/storage/storage-service.js';

let config: AppConfig;
let database: Database;
let harness: TestApp;
let app: FastifyInstance;
let listings: ListingService;

function ensureSchemaHelper(): Promise<void> {
  return ensureSchema(database.sequelize);
}

interface ListingPayload {
  id: string;
  post_type: string;
  title: string;
  status: string;
  price: number | null;
  area_label: string;
  distance_m: number | null;
  is_favorite: boolean;
  is_owner: boolean;
  view_count: number;
  favorite_count: number;
  participant_count: number;
  participation_status: string | null;
  images: Array<{ id: string; url: string; thumbnail_url: string; width: number; height: number }>;
  seller: { id: string; username: string; phone?: string };
  expires_at: string | null;
  event_start: string | null;
  event_end: string | null;
}

interface ListingResponse {
  data: { listing: ListingPayload };
}

interface FeedResponse {
  data: { listings: ListingPayload[] };
  meta: { page: number; limit: number; total: number; has_more: boolean; radius_m: number };
}

const ORIGIN = { lat: -6.2, lng: 106.8 };
const NEAR = { lat: -6.2025, lng: 106.8 };
const MID = { lat: -6.226, lng: 106.8 };
const FAR = { lat: -6.3, lng: 106.8 };

let sequence = 0;

function sellBody(overrides: Record<string, unknown> = {}) {
  sequence += 1;
  return {
    post_type: 'sell',
    title: `Sepeda Lipat Uji ${sequence}`,
    description: 'Sepeda lipat kondisi mulus, jarang dipakai, bisa dicoba di tempat.',
    category_id: TEST_CATEGORIES.sell,
    price: 1_500_000,
    price_type: 'negotiable',
    condition: 'used',
    brand: 'Brompton',
    lat: NEAR.lat,
    lng: NEAR.lng,
    area_label: 'Kemang',
    ...overrides,
  };
}

function eventBody(overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  return {
    post_type: 'event',
    title: 'Pasar Loak Komunitas Uji',
    description: 'Bazaar barang bekas warga sekitar, gratis untuk pengunjung.',
    category_id: TEST_CATEGORIES.event,
    lat: MID.lat,
    lng: MID.lng,
    area_label: 'Senopati',
    event_start: start.toISOString(),
    event_end: end.toISOString(),
    event_location: 'Taman Komunitas, pintu barat',
    event_is_free: true,
    ...overrides,
  };
}

async function createListing(
  token: string,
  body: Record<string, unknown>,
): Promise<ListingPayload> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/listings',
    headers: harness.auth(token),
    payload: body,
  });
  if (response.statusCode !== 201) {
    throw new Error(`create failed ${response.statusCode}: ${response.body}`);
  }
  return response.json<ListingResponse>().data.listing;
}

function feedUrl(params: Record<string, string | number>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.set(key, String(value));
  }
  return `/api/v1/listings?${search.toString()}`;
}

async function multipartUpload(
  token: string,
  listingId: string,
  buffer: Buffer,
  filename: string,
  contentType: string,
) {
  const boundary = '----c2cnearbytest';
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  return app.inject({
    method: 'POST',
    url: `/api/v1/listings/${listingId}/images`,
    headers: {
      ...harness.auth(token),
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload,
  });
}

beforeAll(async () => {
  config = loadConfig();
  database = await connectDatabase(config);
  await ensureSchemaHelper();
  harness = await createTestApp({ database, config });
  app = harness.app;
  listings = new ListingService(
    database.models,
    new UserService(database.models),
    new ListingMediaService(createStorageService(config)),
  );
});

beforeEach(async () => {
  await resetMarketplaceTables(database.sequelize);
  await seedCategories(database.sequelize);
});

afterAll(async () => {
  await app.close();
  await disconnectDatabase(database);
  await rm(resolve(config.storage.uploadDir, 'listings'), { recursive: true, force: true });
});

describe('categories', () => {
  it('lists active categories and filters by post type', async () => {
    const all = await app.inject({ method: 'GET', url: '/api/v1/categories' });
    expect(all.statusCode).toBe(200);
    const body = all.json<{ data: { categories: Array<{ slug: string }> } }>();
    expect(body.data.categories).toHaveLength(3);

    const events = await app.inject({
      method: 'GET',
      url: '/api/v1/categories?post_type=event',
    });
    expect(events.statusCode).toBe(200);
    const filtered = events.json<{ data: { categories: Array<{ name: string }> } }>();
    expect(filtered.data.categories.map((category) => category.name)).toEqual(['Komunitas']);
  });
});

describe('listing creation and privacy', () => {
  it('creates a sell post and never exposes private coordinates', async () => {
    const seller = await provisionUser(harness, app, 'seller1', ORIGIN);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/listings',
      headers: harness.auth(seller.token),
      payload: sellBody(),
    });

    expect(response.statusCode).toBe(201);
    const listing = response.json<ListingResponse>().data.listing;
    expect(listing.post_type).toBe('sell');
    expect(listing.status).toBe('active');
    expect(listing.price).toBe(1_500_000);
    expect(listing.area_label).toBe('Kemang');
    expect(listing.is_owner).toBe(true);
    expect(listing.seller.username).toBe(seller.username);
    expect(listing.expires_at).not.toBeNull();

    const serialized = JSON.stringify(listing);
    expect(serialized).not.toContain('location_private');
    expect(serialized).toMatch(/"lat"|"lng"/);

    const geometry = await database.sequelize.query<{
      lat: number;
      lng: number;
    }>(
      `SELECT ST_Latitude(location_private) AS lat, ST_Longitude(location_private) AS lng
         FROM listings WHERE id = ?`,
      { replacements: [listing.id] },
    );
    expect(Number(geometry[0]?.[0]?.lat)).toBeCloseTo(NEAR.lat, 5);
    expect(Number(geometry[0]?.[0]?.lng)).toBeCloseTo(NEAR.lng, 5);
  });

  it('requires a completed profile and type-specific fields', async () => {
    const token = harness.verifier.register('token-incomplete', fakeIdentity('incomplete'));
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/session',
      headers: harness.auth(token),
    });

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/v1/listings',
      headers: harness.auth(token),
      payload: sellBody(),
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json<{ error: { code: string } }>().error.code).toBe('ONBOARDING_REQUIRED');

    const seller = await provisionUser(harness, app, 'fields', ORIGIN);

    const noPrice = await app.inject({
      method: 'POST',
      url: '/api/v1/listings',
      headers: harness.auth(seller.token),
      payload: sellBody({ price: undefined }),
    });
    expect(noPrice.statusCode).toBe(400);
    expect(noPrice.json<{ error: { code: string } }>().error.code).toBe('VALIDATION_ERROR');

    const eventWithoutStart = await app.inject({
      method: 'POST',
      url: '/api/v1/listings',
      headers: harness.auth(seller.token),
      payload: eventBody({ event_start: undefined, event_end: undefined }),
    });
    expect(eventWithoutStart.statusCode).toBe(400);
  });

  it('sets event expiry a week after the event ends', async () => {
    const seller = await provisionUser(harness, app, 'eventowner', ORIGIN);
    const body = eventBody();
    const listing = await createListing(seller.token, body);

    const expected = new Date(
      new Date(body.event_end as string).getTime() + 7 * 24 * 60 * 60 * 1000,
    );
    expect(new Date(listing.expires_at as string).getTime()).toBe(expected.getTime());
    expect(listing.event_start).toBe(body.event_start);
    expect(listing.event_end).toBe(body.event_end);
  });
});

describe('4 km discovery', () => {
  it('returns only active listings inside 4,000 m, nearest first', async () => {
    const seller = await provisionUser(harness, app, 'discover', ORIGIN);

    const near = await createListing(seller.token, sellBody({ title: 'Sepeda Dekat Sekali' }));
    const mid = await createListing(
      seller.token,
      sellBody({
        title: 'Sepeda Radius Tiga Kilometer',
        lat: MID.lat,
        lng: MID.lng,
      }),
    );
    await createListing(
      seller.token,
      sellBody({ title: 'Sepeda Jauh Di Luar Radius', lat: FAR.lat, lng: FAR.lng }),
    );
    await createListing(seller.token, sellBody({ title: 'Sepeda Draft Tersembunyi', status: 'draft' }));

    const response = await app.inject({
      method: 'GET',
      url: feedUrl({ ...ORIGIN, post_type: 'sell' }),
    });

    expect(response.statusCode).toBe(200);
    const feed = response.json<FeedResponse>();
    expect(feed.meta.total).toBe(2);
    expect(feed.meta.radius_m).toBe(4000);
    expect(feed.meta.page).toBe(1);
    expect(feed.data.listings.map((item) => item.id)).toEqual([near.id, mid.id]);
    expect(feed.data.listings.every((item) => (item.distance_m ?? 0) <= 4000)).toBe(true);
    expect(feed.data.listings[0]?.distance_m).toBeLessThan(
      feed.data.listings[1]?.distance_m ?? Number.MAX_SAFE_INTEGER,
    );

    // A client-supplied radius must never widen discovery.
    const widened = await app.inject({
      method: 'GET',
      url: feedUrl({ ...ORIGIN, post_type: 'sell', radius: 50000 }),
    });
    expect(widened.statusCode).toBe(200);
    expect(widened.json<FeedResponse>().meta.total).toBe(2);
  });

  it('paginates and filters by category, post type and search term', async () => {
    const seller = await provisionUser(harness, app, 'filter', ORIGIN);
    await createListing(seller.token, sellBody({ title: 'Kamera Fujifilm Bekas' }));
    await createListing(
      seller.token,
      sellBody({ title: 'Lensa Kamera Manual', category_id: TEST_CATEGORIES.sell }),
    );
    await createListing(seller.token, eventBody({ title: 'Workshop Kamera Komunitas' }));

    const pageOne = await app.inject({
      method: 'GET',
      url: feedUrl({ ...ORIGIN, limit: 1, page: 1 }),
    });
    const first = pageOne.json<FeedResponse>();
    expect(first.data.listings).toHaveLength(1);
    expect(first.meta.has_more).toBe(true);
    expect(first.meta.total).toBe(3);

    const pageTwo = await app.inject({
      method: 'GET',
      url: feedUrl({ ...ORIGIN, limit: 1, page: 2 }),
    });
    expect(pageTwo.json<FeedResponse>().data.listings).toHaveLength(1);

    const events = await app.inject({
      method: 'GET',
      url: feedUrl({ ...ORIGIN, post_type: 'event' }),
    });
    expect(events.json<FeedResponse>().meta.total).toBe(1);
    expect(events.json<FeedResponse>().data.listings[0]?.post_type).toBe('event');

    const search = await app.inject({
      method: 'GET',
      url: feedUrl({ ...ORIGIN, q: 'Fujifilm' }),
    });
    expect(search.json<FeedResponse>().meta.total).toBe(1);
    expect(search.json<FeedResponse>().data.listings[0]?.title).toContain('Fujifilm');
  });

  it('requires coordinates or a saved profile location', async () => {
    const anonymous = await app.inject({ method: 'GET', url: '/api/v1/listings' });
    expect(anonymous.statusCode).toBe(400);
    expect(anonymous.json<{ error: { code: string } }>().error.code).toBe('LOCATION_REQUIRED');

    const reader = await provisionUser(harness, app, 'reader', ORIGIN);
    const savedLocation = await app.inject({
      method: 'GET',
      url: '/api/v1/listings',
      headers: harness.auth(reader.token),
    });
    expect(savedLocation.statusCode).toBe(200);
  });
});

describe('listing detail, ownership and lifecycle', () => {
  it('hides drafts from the public while the owner can read them', async () => {
    const owner = await provisionUser(harness, app, 'draftowner', ORIGIN);
    const draft = await createListing(owner.token, sellBody({ status: 'draft' }));

    const anonymous = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/${draft.id}`,
    });
    expect(anonymous.statusCode).toBe(404);

    const asOwner = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/${draft.id}`,
      headers: harness.auth(owner.token),
    });
    expect(asOwner.statusCode).toBe(200);
    expect(asOwner.json<ListingResponse>().data.listing.status).toBe('draft');
  });

  it('counts public views but not the owner’s own views', async () => {
    const owner = await provisionUser(harness, app, 'viewowner', ORIGIN);
    const listing = await createListing(owner.token, sellBody());

    const first = await app.inject({ method: 'GET', url: `/api/v1/listings/${listing.id}` });
    expect(first.json<ListingResponse>().data.listing.view_count).toBe(1);

    const second = await app.inject({ method: 'GET', url: `/api/v1/listings/${listing.id}` });
    expect(second.json<ListingResponse>().data.listing.view_count).toBe(2);

    const ownView = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/${listing.id}`,
      headers: harness.auth(owner.token),
    });
    expect(ownView.json<ListingResponse>().data.listing.view_count).toBe(2);
  });

  it('rejects foreign edits and invalid status transitions', async () => {
    const owner = await provisionUser(harness, app, 'ownerx', ORIGIN);
    const intruder = await provisionUser(harness, app, 'intruder', ORIGIN);
    const listing = await createListing(owner.token, sellBody());

    const foreign = await app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${listing.id}`,
      headers: harness.auth(intruder.token),
      payload: { title: 'Diambil alih orang lain' },
    });
    expect(foreign.statusCode).toBe(403);

    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${listing.id}`,
      headers: harness.auth(owner.token),
      payload: { title: 'Sepeda Lipat Sudah Diperbarui' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json<ListingResponse>().data.listing.title).toBe(
      'Sepeda Lipat Sudah Diperbarui',
    );

    const sold = await app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${listing.id}`,
      headers: harness.auth(owner.token),
      payload: { status: 'sold' },
    });
    expect(sold.statusCode).toBe(200);
    expect(sold.json<ListingResponse>().data.listing.status).toBe('sold');

    const reopen = await app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${listing.id}`,
      headers: harness.auth(owner.token),
      payload: { status: 'active' },
    });
    expect(reopen.statusCode).toBe(422);
    expect(reopen.json<{ error: { code: string } }>().error.code).toBe(
      'INVALID_STATUS_TRANSITION',
    );

    const event = await createListing(owner.token, eventBody());
    const eventSold = await app.inject({
      method: 'PATCH',
      url: `/api/v1/listings/${event.id}`,
      headers: harness.auth(owner.token),
      payload: { status: 'sold' },
    });
    expect(eventSold.statusCode).toBe(422);
  });

  it('soft deletes own listings from every public surface', async () => {
    const owner = await provisionUser(harness, app, 'deleter', ORIGIN);
    const listing = await createListing(owner.token, sellBody());

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/v1/listings/${listing.id}`,
      headers: harness.auth(owner.token),
    });
    expect(deleted.statusCode).toBe(204);

    const detail = await app.inject({ method: 'GET', url: `/api/v1/listings/${listing.id}` });
    expect(detail.statusCode).toBe(404);

    const feed = await app.inject({ method: 'GET', url: feedUrl(ORIGIN) });
    expect(feed.json<FeedResponse>().meta.total).toBe(0);

    const mine = await app.inject({
      method: 'GET',
      url: '/api/v1/me/listings',
      headers: harness.auth(owner.token),
    });
    expect(mine.json<{ meta: { total: number } }>().meta.total).toBe(0);
  });
});

describe('favorites', () => {
  it('saves idempotently, lists and removes favorites', async () => {
    const owner = await provisionUser(harness, app, 'favowner', ORIGIN);
    const reader = await provisionUser(harness, app, 'favreader', ORIGIN);
    const listing = await createListing(owner.token, sellBody());

    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listing.id}/favorite`,
      headers: harness.auth(reader.token),
    });
    expect(first.statusCode).toBe(200);
    expect(first.json<{ data: { is_favorite: boolean; favorite_count: number } }>().data).toEqual({
      is_favorite: true,
      favorite_count: 1,
    });

    const again = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listing.id}/favorite`,
      headers: harness.auth(reader.token),
    });
    expect(again.json<{ data: { favorite_count: number } }>().data.favorite_count).toBe(1);

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/${listing.id}`,
      headers: harness.auth(reader.token),
    });
    expect(detail.json<ListingResponse>().data.listing.is_favorite).toBe(true);

    const favorites = await app.inject({
      method: 'GET',
      url: '/api/v1/me/favorites',
      headers: harness.auth(reader.token),
    });
    expect(favorites.statusCode).toBe(200);
    expect(favorites.json<FeedResponse>().meta.total).toBe(1);
    expect(favorites.json<FeedResponse>().data.listings[0]?.id).toBe(listing.id);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/listings/${listing.id}/favorite`,
      headers: harness.auth(reader.token),
    });
    expect(removed.json<{ data: { is_favorite: boolean; favorite_count: number } }>().data).toEqual({
      is_favorite: false,
      favorite_count: 0,
    });
  });
});

describe('event participation', () => {
  it('records, updates and cancels participation', async () => {
    const owner = await provisionUser(harness, app, 'eventhost', ORIGIN);
    const guest = await provisionUser(harness, app, 'eventguest', ORIGIN);
    const event = await createListing(owner.token, eventBody());

    const joined = await app.inject({
      method: 'POST',
      url: `/api/v1/events/${event.id}/participate`,
      headers: harness.auth(guest.token),
      payload: { status: 'going' },
    });
    expect(joined.statusCode).toBe(201);
    expect(joined.json<{ data: { participation_status: string; participant_count: number } }>().data).toEqual({
      participation_status: 'going',
      participant_count: 1,
    });

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/listings/${event.id}`,
      headers: harness.auth(guest.token),
    });
    expect(detail.json<ListingResponse>().data.listing.participation_status).toBe('going');
    expect(detail.json<ListingResponse>().data.listing.participant_count).toBe(1);

    const cancelled = await app.inject({
      method: 'DELETE',
      url: `/api/v1/events/${event.id}/participate`,
      headers: harness.auth(guest.token),
    });
    expect(cancelled.json<{ data: { participant_count: number } }>().data.participant_count).toBe(0);

    const hostJoin = await app.inject({
      method: 'POST',
      url: `/api/v1/events/${event.id}/participate`,
      headers: harness.auth(owner.token),
      payload: { status: 'interested' },
    });
    expect(hostJoin.statusCode).toBe(422);
    expect(hostJoin.json<{ error: { code: string } }>().error.code).toBe(
      'EVENT_OWNER_CANNOT_PARTICIPATE',
    );
  });
});

describe('media pipeline', () => {
  it('stores a 1600 px WebP plus a 400 px thumbnail and deletes them', async () => {
    const owner = await provisionUser(harness, app, 'media', ORIGIN);
    const listing = await createListing(owner.token, sellBody());
    const source = await sharp({
      create: { width: 200, height: 150, channels: 3, background: '#3366ff' },
    })
      .png()
      .toBuffer();

    const upload = await multipartUpload(owner.token, listing.id, source, 'foto.png', 'image/png');
    expect(upload.statusCode).toBe(201);
    const body = upload.json<{
      data: { image: { id: string; url: string; thumbnail_url: string; width: number; height: number } };
    }>();
    expect(body.data.image.url).toMatch(/\.webp$/);
    expect(body.data.image.thumbnail_url).toMatch(/-thumb\.webp$/);
    expect(body.data.image.width).toBe(200);
    expect(body.data.image.height).toBe(150);

    const main = await app.inject({
      method: 'GET',
      url: new URL(body.data.image.url).pathname,
    });
    expect(main.statusCode).toBe(200);
    expect(main.headers['content-type']).toContain('image/webp');

    const thumb = await app.inject({
      method: 'GET',
      url: new URL(body.data.image.thumbnail_url).pathname,
    });
    expect(thumb.statusCode).toBe(200);

    const detail = await app.inject({ method: 'GET', url: `/api/v1/listings/${listing.id}` });
    expect(detail.json<ListingResponse>().data.listing.images).toHaveLength(1);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/listings/${listing.id}/images/${body.data.image.id}`,
      headers: harness.auth(owner.token),
    });
    expect(removed.statusCode).toBe(204);

    const after = await app.inject({ method: 'GET', url: `/api/v1/listings/${listing.id}` });
    expect(after.json<ListingResponse>().data.listing.images).toHaveLength(0);
  });

  it('rejects invalid images and enforces the 8 image limit', async () => {
    const owner = await provisionUser(harness, app, 'media2', ORIGIN);
    const listing = await createListing(owner.token, sellBody());
    const source = await sharp({
      create: { width: 120, height: 120, channels: 3, background: '#ffffff' },
    })
      .jpeg()
      .toBuffer();

    const fake = await multipartUpload(
      owner.token,
      listing.id,
      Buffer.from('this is not an image'),
      'fake.png',
      'image/png',
    );
    expect(fake.statusCode).toBe(400);
    expect(fake.json<{ error: { details: Array<{ message: string }> } }>().error.details[0]?.message).toBe(
      'INVALID_IMAGE',
    );

    for (let index = 0; index < 8; index += 1) {
      const upload = await multipartUpload(
        owner.token,
        listing.id,
        source,
        `foto-${index}.jpg`,
        'image/jpeg',
      );
      expect(upload.statusCode).toBe(201);
    }

    const overflow = await multipartUpload(owner.token, listing.id, source, 'sembilan.jpg', 'image/jpeg');
    expect(overflow.statusCode).toBe(422);
    expect(overflow.json<{ error: { code: string } }>().error.code).toBe('LISTING_IMAGE_LIMIT');
  });

  it('refuses image uploads from another account', async () => {
    const owner = await provisionUser(harness, app, 'mediaowner', ORIGIN);
    const intruder = await provisionUser(harness, app, 'mediaintruder', ORIGIN);
    const listing = await createListing(owner.token, sellBody());
    const source = await sharp({
      create: { width: 100, height: 100, channels: 3, background: '#000000' },
    })
      .png()
      .toBuffer();

    const upload = await multipartUpload(intruder.token, listing.id, source, 'x.png', 'image/png');
    expect(upload.statusCode).toBe(403);
  });
});

describe('expiry', () => {
  it('sweeps expired listings and allows renewal', async () => {
    const owner = await provisionUser(harness, app, 'expiry', ORIGIN);
    const listing = await createListing(owner.token, sellBody());

    await database.sequelize.query(
      'UPDATE listings SET expires_at = ? WHERE id = ?',
      { replacements: [new Date(Date.now() - 60_000), listing.id] },
    );

    const feed = await app.inject({ method: 'GET', url: feedUrl(ORIGIN) });
    expect(feed.json<FeedResponse>().meta.total).toBe(0);

    const expired = await listings.expireDue(new Date());
    expect(expired).toBe(1);

    const mine = await app.inject({
      method: 'GET',
      url: '/api/v1/me/listings',
      headers: harness.auth(owner.token),
    });
    expect(mine.json<FeedResponse>().data.listings[0]?.status).toBe('expired');

    const renewed = await app.inject({
      method: 'POST',
      url: `/api/v1/listings/${listing.id}/renew`,
      headers: harness.auth(owner.token),
    });
    expect(renewed.statusCode).toBe(200);
    const renewedListing = renewed.json<ListingResponse>().data.listing;
    expect(renewedListing.status).toBe('active');
    expect(new Date(renewedListing.expires_at as string).getTime()).toBeGreaterThan(Date.now());
  });
});

// Keeps the helper import referenced even if the suite is trimmed later.
void (null as unknown as ProvisionedUser);
