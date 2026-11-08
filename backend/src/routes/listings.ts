import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';

import {
  authenticatedUser,
  type AuthContext,
  type AuthGuards,
} from '../auth/index.js';
import { ValidationError } from '../common/errors.js';
import { ok } from '../common/response.js';
import { unauthorizedEnvelope } from '../common/schemas.js';
import type { PostType } from '../database/models/category.model.js';
import type { ListingCondition, ListingStatus, PriceType } from '../database/models/listing.model.js';
import type { ListingService } from '../services/listing-service.js';

export interface ListingRoutesOptions {
  readonly ctx: AuthContext;
  readonly guards: AuthGuards;
  readonly listings: ListingService;
}

interface FeedQuery {
  lat?: number;
  lng?: number;
  post_type?: PostType;
  category_id?: string;
  seller_id?: string;
  q?: string;
  page?: number;
  limit?: number;
}

interface IdParams {
  id: string;
}

interface ImageParams {
  id: string;
  imageId: string;
}

interface ListingBody {
  post_type: PostType;
  title: string;
  description: string;
  category_id?: string | null;
  price?: number | null;
  price_type?: PriceType | null;
  condition?: ListingCondition | null;
  brand?: string | null;
  lat?: number;
  lng?: number;
  area_label?: string | null;
  event_start?: string | null;
  event_end?: string | null;
  event_location?: string | null;
  event_is_free?: boolean | null;
  event_link?: string | null;
  information_link?: string | null;
  status?: 'draft' | 'active';
}

interface ListingPatchBody {
  title?: string;
  description?: string;
  category_id?: string | null;
  price?: number | null;
  price_type?: PriceType | null;
  condition?: ListingCondition | null;
  brand?: string | null;
  lat?: number;
  lng?: number;
  area_label?: string | null;
  event_start?: string | null;
  event_end?: string | null;
  event_location?: string | null;
  event_is_free?: boolean | null;
  event_link?: string | null;
  information_link?: string | null;
  status?: ListingStatus;
}

interface ParticipationBody {
  status?: 'interested' | 'going';
}

interface PageQuery {
  page?: number;
  limit?: number;
}

const sessionGuard = { security: [{ bearerAuth: [] }] } as const;

const postType = Type.Union([
  Type.Literal('sell'),
  Type.Literal('event'),
  Type.Literal('information'),
]);

const latitude = Type.Number({ minimum: -90, maximum: 90 });
const longitude = Type.Number({ minimum: -180, maximum: 180 });

const pagination = {
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
};

const idParams = Type.Object({ id: Type.String({ minLength: 1, maxLength: 36 }) });

function createInput(body: ListingBody) {
  return {
    postType: body.post_type,
    title: body.title,
    description: body.description,
    categoryId: body.category_id,
    price: body.price,
    priceType: body.price_type,
    condition: body.condition,
    brand: body.brand,
    lat: body.lat,
    lng: body.lng,
    areaLabel: body.area_label,
    eventStart: body.event_start,
    eventEnd: body.event_end,
    eventLocation: body.event_location,
    eventIsFree: body.event_is_free,
    eventLink: body.event_link,
    informationLink: body.information_link,
    status: body.status,
  };
}

function patchInput(body: ListingPatchBody) {
  return {
    title: body.title,
    description: body.description,
    categoryId: body.category_id,
    price: body.price,
    priceType: body.price_type,
    condition: body.condition,
    brand: body.brand,
    lat: body.lat,
    lng: body.lng,
    areaLabel: body.area_label,
    eventStart: body.event_start,
    eventEnd: body.event_end,
    eventLocation: body.event_location,
    eventIsFree: body.event_is_free,
    eventLink: body.event_link,
    informationLink: body.information_link,
    status: body.status,
  };
}

export const listingRoutes: FastifyPluginAsync<ListingRoutesOptions> = async (app, options) => {
  const { guards, listings } = options;

  app.get(
    '/categories',
    {
      schema: {
        tags: ['listings'],
        summary: 'Active categories, optionally filtered by post type',
        querystring: Type.Object(
          { post_type: Type.Optional(postType) },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const query = request.query as { post_type?: PostType };
      return ok({ categories: await listings.categories(query.post_type) });
    },
  );

  app.get(
    '/listings',
    {
      preHandler: guards.optionalAuthenticate,
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: {
        tags: ['listings'],
        summary: 'Feed within the fixed 4 km radius (lat/lng or saved profile location)',
        querystring: Type.Object(
          {
            lat: Type.Optional(latitude),
            lng: Type.Optional(longitude),
            post_type: Type.Optional(postType),
            category_id: Type.Optional(Type.String({ minLength: 1, maxLength: 36 })),
            seller_id: Type.Optional(Type.String({ minLength: 1, maxLength: 36 })),
            q: Type.Optional(Type.String({ maxLength: 100 })),
            ...pagination,
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const query = request.query as FeedQuery;
      const result = await listings.feed(
        {
          lat: query.lat,
          lng: query.lng,
          postType: query.post_type,
          categoryId: query.category_id,
          sellerId: query.seller_id,
          query: query.q,
          page: query.page,
          limit: query.limit,
        },
        request.authUser ?? null,
      );

      return ok(
        { listings: result.items },
        {
          page: result.page,
          limit: result.limit,
          total: result.total,
          has_more: result.has_more,
          radius_m: result.radius_m,
        },
      );
    },
  );

  app.get<{ Params: IdParams }>(
    '/listings/:id',
    {
      preHandler: guards.optionalAuthenticate,
      schema: {
        tags: ['listings'],
        summary: 'Public listing detail; owner sees drafts',
        params: idParams,
        querystring: Type.Object(
          {
            lat: Type.Optional(latitude),
            lng: Type.Optional(longitude),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const query = request.query as { lat?: number; lng?: number };
      const listing = await listings.get(request.params.id, request.authUser ?? null, {
        lat: query.lat,
        lng: query.lng,
      });
      return ok({ listing });
    },
  );

  app.post<{ Body: ListingBody }>(
    '/listings',
    {
      preHandler: guards.authenticate,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['listings'],
        summary: 'Create a sell, event or information post',
        body: Type.Object(
          {
            post_type: postType,
            title: Type.String({ minLength: 5, maxLength: 150 }),
            description: Type.String({ minLength: 10, maxLength: 5000 }),
            category_id: Type.Optional(
              Type.Union([Type.String({ minLength: 1, maxLength: 36 }), Type.Null()]),
            ),
            price: Type.Optional(Type.Union([Type.Number({ minimum: 0 }), Type.Null()])),
            price_type: Type.Optional(
              Type.Union([Type.Literal('fixed'), Type.Literal('negotiable'), Type.Null()]),
            ),
            condition: Type.Optional(
              Type.Union([Type.Literal('new'), Type.Literal('used'), Type.Null()]),
            ),
            brand: Type.Optional(Type.Union([Type.String({ maxLength: 80 }), Type.Null()])),
            lat: Type.Optional(latitude),
            lng: Type.Optional(longitude),
            area_label: Type.Optional(
              Type.Union([Type.String({ minLength: 2, maxLength: 150 }), Type.Null()]),
            ),
            event_start: Type.Optional(
              Type.Union([Type.String({ maxLength: 40 }), Type.Null()]),
            ),
            event_end: Type.Optional(
              Type.Union([Type.String({ maxLength: 40 }), Type.Null()]),
            ),
            event_location: Type.Optional(
              Type.Union([Type.String({ maxLength: 255 }), Type.Null()]),
            ),
            event_is_free: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
            event_link: Type.Optional(
              Type.Union([Type.String({ maxLength: 500 }), Type.Null()]),
            ),
            information_link: Type.Optional(
              Type.Union([Type.String({ maxLength: 500 }), Type.Null()]),
            ),
            status: Type.Optional(
              Type.Union([Type.Literal('draft'), Type.Literal('active')]),
            ),
          },
          { additionalProperties: false },
        ),
        ...sessionGuard,
        response: { 401: unauthorizedEnvelope },
      },
    },
    async (request, reply) => {
      const user = authenticatedUser(request);
      const listing = await listings.create(user, createInput(request.body));
      return reply.status(201).send(ok({ listing }));
    },
  );

  app.patch<{ Params: IdParams; Body: ListingPatchBody }>(
    '/listings/:id',
    {
      preHandler: guards.authenticate,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['listings'],
        summary: 'Update own listing and validated status transitions',
        params: idParams,
        body: Type.Object(
          {
            title: Type.Optional(Type.String({ minLength: 5, maxLength: 150 })),
            description: Type.Optional(Type.String({ minLength: 10, maxLength: 5000 })),
            category_id: Type.Optional(
              Type.Union([Type.String({ minLength: 1, maxLength: 36 }), Type.Null()]),
            ),
            price: Type.Optional(Type.Union([Type.Number({ minimum: 0 }), Type.Null()])),
            price_type: Type.Optional(
              Type.Union([Type.Literal('fixed'), Type.Literal('negotiable'), Type.Null()]),
            ),
            condition: Type.Optional(
              Type.Union([Type.Literal('new'), Type.Literal('used'), Type.Null()]),
            ),
            brand: Type.Optional(Type.Union([Type.String({ maxLength: 80 }), Type.Null()])),
            lat: Type.Optional(latitude),
            lng: Type.Optional(longitude),
            area_label: Type.Optional(
              Type.Union([Type.String({ minLength: 2, maxLength: 150 }), Type.Null()]),
            ),
            event_start: Type.Optional(
              Type.Union([Type.String({ maxLength: 40 }), Type.Null()]),
            ),
            event_end: Type.Optional(
              Type.Union([Type.String({ maxLength: 40 }), Type.Null()]),
            ),
            event_location: Type.Optional(
              Type.Union([Type.String({ maxLength: 255 }), Type.Null()]),
            ),
            event_is_free: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
            event_link: Type.Optional(
              Type.Union([Type.String({ maxLength: 500 }), Type.Null()]),
            ),
            information_link: Type.Optional(
              Type.Union([Type.String({ maxLength: 500 }), Type.Null()]),
            ),
            status: Type.Optional(
              Type.Union([
                Type.Literal('draft'),
                Type.Literal('active'),
                Type.Literal('hidden'),
                Type.Literal('sold'),
                Type.Literal('completed'),
                Type.Literal('rejected'),
                Type.Literal('expired'),
              ]),
            ),
          },
          { additionalProperties: false },
        ),
        ...sessionGuard,
      },
    },
    async (request) => {
      const user = authenticatedUser(request);
      const listing = await listings.update(user, request.params.id, patchInput(request.body));
      return ok({ listing });
    },
  );

  app.delete<{ Params: IdParams }>(
    '/listings/:id',
    {
      preHandler: guards.authenticate,
      schema: {
        tags: ['listings'],
        summary: 'Soft delete own listing',
        params: idParams,
        ...sessionGuard,
      },
    },
    async (request, reply) => {
      const user = authenticatedUser(request);
      await listings.remove(user, request.params.id);
      return reply.status(204).send();
    },
  );

  app.post<{ Params: IdParams }>(
    '/listings/:id/renew',
    {
      preHandler: guards.authenticate,
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['listings'],
        summary: 'Renew an active or expired listing',
        params: idParams,
        ...sessionGuard,
      },
    },
    async (request) => {
      const user = authenticatedUser(request);
      return ok({ listing: await listings.renew(user, request.params.id) });
    },
  );

  app.post<{ Params: IdParams }>(
    '/listings/:id/images',
    {
      preHandler: guards.authenticate,
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['listings'],
        summary: 'Upload an image (1600 px WebP + 400 px thumbnail)',
        consumes: ['multipart/form-data'],
        params: idParams,
        ...sessionGuard,
      },
    },
    async (request, reply) => {
      const user = authenticatedUser(request);
      const file = await request.file();
      if (!file) {
        throw new ValidationError('Berkas gambar wajib dikirim pada field "file".', [
          { path: 'file', message: 'wajib diisi' },
        ]);
      }
      if (!file.mimetype.startsWith('image/')) {
        throw new ValidationError('Tipe berkas harus gambar.', [
          { path: 'file', message: 'image/* diperlukan' },
        ]);
      }

      const result = await listings.addImage(user, request.params.id, await file.toBuffer());
      return reply.status(201).send(ok(result));
    },
  );

  app.delete<{ Params: ImageParams }>(
    '/listings/:id/images/:imageId',
    {
      preHandler: guards.authenticate,
      schema: {
        tags: ['listings'],
        summary: 'Remove one of own listing images',
        params: Type.Object({
          id: Type.String({ minLength: 1, maxLength: 36 }),
          imageId: Type.String({ minLength: 1, maxLength: 36 }),
        }),
        ...sessionGuard,
      },
    },
    async (request, reply) => {
      const user = authenticatedUser(request);
      await listings.removeImage(user, request.params.id, request.params.imageId);
      return reply.status(204).send();
    },
  );

  app.post<{ Params: IdParams }>(
    '/listings/:id/favorite',
    {
      preHandler: guards.authenticate,
      schema: {
        tags: ['favorites'],
        summary: 'Save a listing (idempotent)',
        params: idParams,
        ...sessionGuard,
      },
    },
    async (request) => {
      const user = authenticatedUser(request);
      return ok(await listings.setFavorite(user, request.params.id, true));
    },
  );

  app.delete<{ Params: IdParams }>(
    '/listings/:id/favorite',
    {
      preHandler: guards.authenticate,
      schema: {
        tags: ['favorites'],
        summary: 'Remove a saved listing (idempotent)',
        params: idParams,
        ...sessionGuard,
      },
    },
    async (request) => {
      const user = authenticatedUser(request);
      return ok(await listings.setFavorite(user, request.params.id, false));
    },
  );

  app.get<{ Querystring: PageQuery & { post_type?: PostType } }>(
    '/me/favorites',
    {
      preHandler: guards.authenticate,
      schema: {
        tags: ['favorites'],
        summary: 'Own saved listings, paginated',
        querystring: Type.Object(
          {
            post_type: Type.Optional(postType),
            ...pagination,
          },
          { additionalProperties: false },
        ),
        ...sessionGuard,
      },
    },
    async (request) => {
      const user = authenticatedUser(request);
      const result = await listings.favorites(user, {
        postType: request.query.post_type,
        page: request.query.page,
        limit: request.query.limit,
      });
      return ok(
        { listings: result.items },
        {
          page: result.page,
          limit: result.limit,
          total: result.total,
          has_more: result.has_more,
        },
      );
    },
  );

  app.get<{ Querystring: PageQuery & { status?: ListingStatus } }>(
    '/me/listings',
    {
      preHandler: guards.authenticate,
      schema: {
        tags: ['listings'],
        summary: 'Own listings in every status, newest first',
        querystring: Type.Object(
          {
            status: Type.Optional(
              Type.Union([
                Type.Literal('draft'),
                Type.Literal('active'),
                Type.Literal('hidden'),
                Type.Literal('sold'),
                Type.Literal('completed'),
                Type.Literal('rejected'),
                Type.Literal('expired'),
              ]),
            ),
            ...pagination,
          },
          { additionalProperties: false },
        ),
        ...sessionGuard,
      },
    },
    async (request) => {
      const user = authenticatedUser(request);
      const result = await listings.mine(user, {
        status: request.query.status,
        page: request.query.page,
        limit: request.query.limit,
      });
      return ok(
        { listings: result.items },
        {
          page: result.page,
          limit: result.limit,
          total: result.total,
          has_more: result.has_more,
        },
      );
    },
  );

  app.post<{ Params: IdParams; Body: ParticipationBody }>(
    '/events/:id/participate',
    {
      preHandler: guards.authenticate,
      schema: {
        tags: ['events'],
        summary: 'Mark interest or going for an event',
        params: idParams,
        body: Type.Object(
          {
            status: Type.Optional(
              Type.Union([Type.Literal('interested'), Type.Literal('going')]),
            ),
          },
          { additionalProperties: false },
        ),
        ...sessionGuard,
      },
    },
    async (request, reply) => {
      const user = authenticatedUser(request);
      const result = await listings.participate(
        user,
        request.params.id,
        request.body.status ?? 'interested',
      );
      return reply.status(201).send(ok(result));
    },
  );

  app.delete<{ Params: IdParams }>(
    '/events/:id/participate',
    {
      preHandler: guards.authenticate,
      schema: {
        tags: ['events'],
        summary: 'Cancel event participation',
        params: idParams,
        ...sessionGuard,
      },
    },
    async (request) => {
      const user = authenticatedUser(request);
      return ok(await listings.cancelParticipation(user, request.params.id));
    },
  );

};
