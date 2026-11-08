import { randomUUID } from 'node:crypto';

import {
  AppError,
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../common/errors.js';
import {
  EVENT_EXPIRY_AFTER_END_DAYS,
  LISTING_RETENTION_DAYS,
  PAGINATION,
} from '../config/constants.js';
import type { PostType } from '../database/models/category.model.js';
import type { DatabaseModels } from '../database/models/index.js';
import type {
  Listing,
  ListingCondition,
  ListingStatus,
  PriceType,
} from '../database/models/listing.model.js';
import type { User } from '../database/models/user.model.js';
import {
  ListingRepository,
  type DiscoveryOrigin,
  type ListingImageRow,
  type ListingRow,
  type ListingUpdateRecord,
} from '../repositories/listing-repository.js';
import type { ListingMediaService } from './listing-media.js';
import { toImageDto, toListingDto, type ListingDTO, type ListingImageDTO } from './listing-dto.js';
import type { UserService } from './user-service.js';

export interface OriginInput {
  readonly lat?: number | undefined;
  readonly lng?: number | undefined;
}

export interface ListingCreateInput extends OriginInput {
  readonly postType: PostType;
  readonly title: string;
  readonly description: string;
  readonly categoryId?: string | null | undefined;
  readonly price?: number | null | undefined;
  readonly priceType?: PriceType | null | undefined;
  readonly condition?: ListingCondition | null | undefined;
  readonly brand?: string | null | undefined;
  readonly areaLabel?: string | null | undefined;
  readonly eventStart?: string | null | undefined;
  readonly eventEnd?: string | null | undefined;
  readonly eventLocation?: string | null | undefined;
  readonly eventIsFree?: boolean | null | undefined;
  readonly eventLink?: string | null | undefined;
  readonly informationLink?: string | null | undefined;
  readonly status?: 'draft' | 'active' | undefined;
}

export interface ListingUpdateInput extends OriginInput {
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly categoryId?: string | null | undefined;
  readonly price?: number | null | undefined;
  readonly priceType?: PriceType | null | undefined;
  readonly condition?: ListingCondition | null | undefined;
  readonly brand?: string | null | undefined;
  readonly areaLabel?: string | null | undefined;
  readonly eventStart?: string | null | undefined;
  readonly eventEnd?: string | null | undefined;
  readonly eventLocation?: string | null | undefined;
  readonly eventIsFree?: boolean | null | undefined;
  readonly eventLink?: string | null | undefined;
  readonly informationLink?: string | null | undefined;
  readonly status?: ListingStatus | undefined;
}

export interface FeedInput extends OriginInput {
  readonly postType?: PostType | undefined;
  readonly categoryId?: string | undefined;
  readonly sellerId?: string | undefined;
  readonly query?: string | undefined;
  readonly page?: number | undefined;
  readonly limit?: number | undefined;
}

export interface PageResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly has_more: boolean;
}

const STATUS_TRANSITIONS: Readonly<Record<ListingStatus, readonly ListingStatus[]>> = {
  draft: ['active'],
  active: ['hidden', 'sold', 'completed'],
  hidden: ['active'],
  sold: ['completed', 'hidden'],
  completed: [],
  expired: ['active'],
  rejected: [],
};

const URL_MAX = 500;

function details(path: string, message: string) {
  return [{ path, message }];
}

function requireString(
  value: string | null | undefined,
  path: string,
  min: number,
  max: number,
): string {
  const trimmed = (value ?? '').trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new ValidationError(`${path} harus ${min}–${max} karakter.`, details(path, `panjang ${min}–${max}`));
  }
  return trimmed;
}

function optionalTrimmed(value: string | null | undefined, max: number, path: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new ValidationError(`${path} maksimal ${max} karakter.`, details(path, `maksimal ${max}`));
  }
  return trimmed.length === 0 ? null : trimmed;
}

function optionalUrl(value: string | null | undefined, path: string): string | null {
  const trimmed = optionalTrimmed(value, URL_MAX, path);
  if (trimmed === null) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ValidationError(`${path} harus URL yang valid.`, details(path, 'URL tidak valid'));
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ValidationError(`${path} harus http atau https.`, details(path, 'protokol tidak didukung'));
  }
  return trimmed;
}

function parseDate(value: string | null | undefined, path: string): Date | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${path} bukan tanggal yang valid.`, details(path, 'ISO-8601 diperlukan'));
  }
  return date;
}

function validateCoordinates(lat: number, lng: number): DiscoveryOrigin {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new ValidationError('Latitude tidak valid.', details('lat', '-90..90'));
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new ValidationError('Longitude tidak valid.', details('lng', '-180..180'));
  }
  return { lat, lng };
}

function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function computeExpiry(
  postType: PostType,
  eventEnd: Date | null,
  from: Date,
): Date {
  if (postType === 'event') {
    return addDays(eventEnd ?? from, EVENT_EXPIRY_AFTER_END_DAYS);
  }
  return addDays(from, LISTING_RETENTION_DAYS);
}

export class ListingService {
  private readonly repo: ListingRepository;

  constructor(
    models: DatabaseModels,
    private readonly users: UserService,
    private readonly media: ListingMediaService,
  ) {
    if (!models.Listing.sequelize) {
      throw new Error('Sequelize belum terpasang pada model Listing.');
    }
    this.repo = new ListingRepository(models.Listing.sequelize, models);
  }

  async categories(postType?: PostType) {
    const rows = await this.repo.categories(postType);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      post_type: row.post_type,
      icon: row.icon,
      image_url: row.image_url,
      sort_order: Number(row.sort_order),
    }));
  }

  async feed(input: FeedInput, viewer: User | null): Promise<PageResult<ListingDTO> & { radius_m: number }> {
    const origin = await this.resolveOrigin(input, viewer, true);
    const page = input.page ?? 1;
    const limit = Math.min(input.limit ?? PAGINATION.defaultLimit, PAGINATION.maxLimit);

    const result = await this.repo.feed({
      origin,
      postType: input.postType,
      categoryId: input.categoryId,
      sellerId: input.sellerId,
      query: input.query,
      page,
      limit,
      viewerId: viewer?.id ?? null,
    });
    const images = await this.loadImages(result.rows);

    return {
      items: result.rows.map((row) => toListingDto(row, images.get(row.id) ?? [], viewer?.id ?? null)),
      total: result.total,
      page,
      limit,
      has_more: page * limit < result.total,
      radius_m: 4_000,
    };
  }

  async get(
    id: string,
    viewer: User | null,
    input: OriginInput = {},
  ): Promise<ListingDTO> {
    const origin = await this.resolveOrigin(input, viewer, false);
    const row = await this.repo.findById(id, viewer?.id ?? null, origin);
    if (!row) {
      throw new NotFoundError('Posting', 'LISTING_NOT_FOUND');
    }

    const isOwner = viewer !== null && row.seller_id === viewer.id;
    const expired =
      row.expires_at !== null && new Date(row.expires_at).getTime() <= Date.now();
    const publiclyVisible = row.status === 'active' && !expired;

    if (!publiclyVisible && !isOwner) {
      throw new NotFoundError('Posting', 'LISTING_NOT_FOUND');
    }

    let effective = row;
    if (publiclyVisible && !isOwner) {
      await this.repo.incrementView(row.id);
      effective = { ...row, view_count: Number(row.view_count) + 1 };
    }

    const images = await this.repo.imagesFor([row.id]);
    return toListingDto(effective, images, viewer?.id ?? null);
  }

  async create(user: User, input: ListingCreateInput): Promise<ListingDTO> {
    if (!user.profileCompleted) {
      throw new AppError(
        'ONBOARDING_REQUIRED',
        'Lengkapi profil (username, nama tampilan, area) sebelum membuat posting.',
        403,
        { required_step: 'profile' },
      );
    }

    const title = requireString(input.title, 'title', 5, 150);
    const description = requireString(input.description, 'description', 10, 5_000);
    const origin = await this.resolveOrigin(input, user, true);
    const areaLabel = this.resolveAreaLabel(input.areaLabel, user);

    await this.assertCategory(input.categoryId ?? null, input.postType);

    const isSell = input.postType === 'sell';
    const price = isSell ? this.validatePrice(input.price, true) : null;
    const priceType = isSell ? (input.priceType ?? null) : null;
    const condition = isSell ? (input.condition ?? null) : null;
    if (isSell) {
      if (!priceType) {
        throw new ValidationError('price_type wajib untuk posting jual.', details('price_type', 'wajib diisi'));
      }
      if (!condition) {
        throw new ValidationError('condition wajib untuk posting jual.', details('condition', 'wajib diisi'));
      }
    }

    const event = this.validateEventFields(
      input.postType,
      input.eventStart,
      input.eventEnd,
      input.eventLocation,
      input.eventIsFree,
      null,
      null,
    );
    const links = this.validateLinks(input.eventLink, input.informationLink);
    if (input.postType === 'event' && !event.location) {
      throw new ValidationError(
        'event_location wajib untuk posting event.',
        details('event_location', 'wajib diisi'),
      );
    }

    const status: 'draft' | 'active' = input.status ?? 'active';
    const now = new Date();
    const expiresAt =
      status === 'active' ? computeExpiry(input.postType, event.end, now) : null;

    const id = randomUUID();
    await this.repo.create({
      id,
      userId: user.id,
      postType: input.postType,
      categoryId: input.categoryId ?? null,
      title,
      slug: await this.uniqueSlug(title),
      description,
      price: price === null ? null : price.toFixed(2),
      priceType,
      condition,
      brand: optionalTrimmed(input.brand, 80, 'brand'),
      lat: origin.lat,
      lng: origin.lng,
      locationPublicLabel: areaLabel,
      eventStart: event.start,
      eventEnd: event.end,
      eventLocationPublic: event.location,
      eventIsFree: input.postType === 'event' ? (event.isFree ?? true) : null,
      eventLink: input.postType === 'event' ? links.eventLink : null,
      informationLink: input.postType === 'information' ? links.informationLink : null,
      status,
      publishedAt: status === 'active' ? now : null,
      expiresAt,
    });

    return this.get(id, user);
  }

  async update(user: User, id: string, input: ListingUpdateInput): Promise<ListingDTO> {
    const listing = await this.requireOwner(user, id);
    const updates: ListingUpdateRecord = {};

    if (input.title !== undefined) {
      updates.title = requireString(input.title, 'title', 5, 150);
    }
    if (input.description !== undefined) {
      updates.description = requireString(input.description, 'description', 10, 5_000);
    }
    if (input.categoryId !== undefined) {
      await this.assertCategory(input.categoryId, listing.postType);
      updates.categoryId = input.categoryId;
    }
    if (input.brand !== undefined) {
      updates.brand = optionalTrimmed(input.brand, 80, 'brand');
    }
    if (input.price !== undefined) {
      const price = this.validatePrice(input.price, false);
      updates.price = price === null ? null : price.toFixed(2);
    }
    if (input.priceType !== undefined) {
      updates.priceType = input.priceType;
    }
    if (input.condition !== undefined) {
      updates.condition = input.condition;
    }
    if (input.areaLabel !== undefined) {
      updates.locationPublicLabel = this.resolveAreaLabel(input.areaLabel, user);
    }

    if (input.lat !== undefined || input.lng !== undefined) {
      if (input.lat === undefined || input.lng === undefined) {
        throw new ValidationError('lat dan lng harus dikirim bersama.', details('lat', 'lng wajib'));
      }
      const origin = validateCoordinates(input.lat, input.lng);
      updates.lat = origin.lat;
      updates.lng = origin.lng;
    }

    const event = this.validateEventFields(
      listing.postType,
      input.eventStart,
      input.eventEnd,
      input.eventLocation,
      input.eventIsFree,
      listing.eventStart,
      listing.eventEnd,
    );
    if (input.eventStart !== undefined) {
      updates.eventStart = event.start;
    }
    if (input.eventEnd !== undefined) {
      updates.eventEnd = event.end;
    }
    if (input.eventLocation !== undefined) {
      updates.eventLocationPublic = event.location;
    }
    if (input.eventIsFree !== undefined) {
      updates.eventIsFree = event.isFree;
    }

    if (input.eventLink !== undefined || input.informationLink !== undefined) {
      const links = this.validateLinks(
        input.eventLink ?? listing.eventLink,
        input.informationLink ?? listing.informationLink,
      );
      if (input.eventLink !== undefined) {
        updates.eventLink = links.eventLink;
      }
      if (input.informationLink !== undefined) {
        updates.informationLink = links.informationLink;
      }
    }

    if (input.status !== undefined && input.status !== listing.status) {
      const allowed = STATUS_TRANSITIONS[listing.status as ListingStatus] ?? [];
      if (!allowed.includes(input.status)) {
        throw new BusinessRuleError(
          'INVALID_STATUS_TRANSITION',
          `Status ${listing.status} tidak dapat diubah menjadi ${input.status}.`,
          { from: listing.status, to: input.status },
        );
      }
      if (
        ['sold', 'completed'].includes(input.status) &&
        listing.postType !== 'sell'
      ) {
        throw new BusinessRuleError(
          'INVALID_STATUS',
          'Status terjual/selesai hanya berlaku untuk posting jual.',
        );
      }

      updates.status = input.status;
      if (input.status === 'active') {
        const now = new Date();
        updates.publishedAt = listing.publishedAt ?? now;
        updates.expiresAt = computeExpiry(
          listing.postType,
          listing.eventEnd ?? event.end,
          now,
        );
      }
    }

    await this.repo.update(id, updates);
    return this.get(id, user);
  }

  async remove(user: User, id: string): Promise<void> {
    await this.requireOwner(user, id);
    await this.repo.softDelete(id);
  }

  async renew(user: User, id: string): Promise<ListingDTO> {
    const listing = await this.requireOwner(user, id);
    if (!['active', 'expired'].includes(listing.status)) {
      throw new BusinessRuleError(
        'LISTING_NOT_RENEWABLE',
        'Hanya posting aktif atau kedaluwarsa yang dapat diperpanjang.',
      );
    }

    const now = new Date();
    await this.repo.update(id, {
      status: 'active',
      publishedAt: listing.publishedAt ?? now,
      expiresAt: computeExpiry(listing.postType, listing.eventEnd, now),
    });
    return this.get(id, user);
  }

  async addImage(
    user: User,
    id: string,
    buffer: Buffer,
  ): Promise<{ image: ListingImageDTO; images_count: number }> {
    await this.requireOwner(user, id);

    const count = await this.repo.countImages(id);
    if (count >= 8) {
      throw new BusinessRuleError(
        'LISTING_IMAGE_LIMIT',
        'Maksimal 8 gambar per posting.',
        { limit: 8 },
      );
    }

    const stored = await this.media.save(id, buffer);
    const imageId = randomUUID();
    try {
      await this.repo.addImage({
        id: imageId,
        listingId: id,
        imageUrl: stored.url,
        thumbnailUrl: stored.thumbnailUrl,
        width: stored.width,
        height: stored.height,
        sortOrder: count,
      });
    } catch (error) {
      await this.media.remove(stored.url, stored.thumbnailUrl);
      throw error;
    }

    return {
      image: toImageDto({
        id: imageId,
        listing_id: id,
        image_url: stored.url,
        thumbnail_url: stored.thumbnailUrl,
        width: stored.width,
        height: stored.height,
        sort_order: count,
      }),
      images_count: count + 1,
    };
  }

  async removeImage(user: User, id: string, imageId: string): Promise<void> {
    await this.requireOwner(user, id);
    const image = await this.repo.findImage(imageId, id);
    if (!image) {
      throw new NotFoundError('Gambar posting', 'LISTING_IMAGE_NOT_FOUND');
    }
    await this.repo.deleteImage(imageId, id);
    await this.media.remove(image.image_url, image.thumbnail_url);
  }

  async setFavorite(
    user: User,
    id: string,
    favorite: boolean,
  ): Promise<{ is_favorite: boolean; favorite_count: number }> {
    if (!(await this.repo.isVisible(id))) {
      throw new NotFoundError('Posting', 'LISTING_NOT_FOUND');
    }

    if (favorite) {
      await this.repo.setFavorite(user.id, id);
    } else {
      await this.repo.removeFavorite(user.id, id);
    }

    return {
      is_favorite: favorite,
      favorite_count: await this.repo.favoriteCount(id),
    };
  }

  async favorites(
    user: User,
    input: { postType?: PostType | undefined; page?: number | undefined; limit?: number | undefined },
  ): Promise<PageResult<ListingDTO>> {
    const page = input.page ?? 1;
    const limit = Math.min(input.limit ?? PAGINATION.defaultLimit, PAGINATION.maxLimit);
    const origin = await this.resolveOrigin({}, user, false);
    const result = await this.repo.favorites(
      user.id,
      input.postType,
      { page, limit },
      origin,
    );
    const images = await this.loadImages(result.rows);

    return {
      items: result.rows.map((row) => toListingDto(row, images.get(row.id) ?? [], user.id)),
      total: result.total,
      page,
      limit,
      has_more: page * limit < result.total,
    };
  }

  async mine(
    user: User,
    input: { status?: ListingStatus | undefined; page?: number | undefined; limit?: number | undefined },
  ): Promise<PageResult<ListingDTO>> {
    const page = input.page ?? 1;
    const limit = Math.min(input.limit ?? PAGINATION.defaultLimit, PAGINATION.maxLimit);
    const result = await this.repo.mine(user.id, input.status, { page, limit });
    const images = await this.loadImages(result.rows);

    return {
      items: result.rows.map((row) => toListingDto(row, images.get(row.id) ?? [], user.id)),
      total: result.total,
      page,
      limit,
      has_more: page * limit < result.total,
    };
  }

  async participate(
    user: User,
    id: string,
    status: 'interested' | 'going',
  ): Promise<{ participation_status: string; participant_count: number }> {
    const listing = await this.repo.findListingModel(id);
    if (!listing || listing.deletedAt) {
      throw new NotFoundError('Event', 'EVENT_NOT_FOUND');
    }
    if (listing.postType !== 'event') {
      throw new BusinessRuleError('NOT_AN_EVENT', 'Posting ini bukan event.');
    }
    if (listing.status !== 'active') {
      throw new BusinessRuleError('EVENT_NOT_ACTIVE', 'Event belum aktif atau sudah berakhir.');
    }
    if (listing.userId === user.id) {
      throw new BusinessRuleError(
        'EVENT_OWNER_CANNOT_PARTICIPATE',
        'Pembuat event tidak dapat mendaftar sebagai peserta.',
      );
    }

    await this.repo.setParticipation(id, user.id, status);
    return {
      participation_status: status,
      participant_count: await this.repo.participantCount(id),
    };
  }

  async cancelParticipation(
    user: User,
    id: string,
  ): Promise<{ participation_status: string; participant_count: number }> {
    const listing = await this.repo.findListingModel(id);
    if (!listing || listing.deletedAt) {
      throw new NotFoundError('Event', 'EVENT_NOT_FOUND');
    }
    if (listing.postType !== 'event') {
      throw new BusinessRuleError('NOT_AN_EVENT', 'Posting ini bukan event.');
    }

    await this.repo.setParticipation(id, user.id, 'cancelled');
    return {
      participation_status: 'cancelled',
      participant_count: await this.repo.participantCount(id),
    };
  }

  async expireDue(now: Date = new Date()): Promise<number> {
    return this.repo.expireDue(now);
  }

  private async loadImages(rows: readonly ListingRow[]): Promise<Map<string, ListingImageRow[]>> {
    const images = await this.repo.imagesFor(rows.map((row) => row.id));
    const map = new Map<string, ListingImageRow[]>();
    for (const image of images) {
      const bucket = map.get(image.listing_id) ?? [];
      bucket.push(image);
      map.set(image.listing_id, bucket);
    }
    return map;
  }

  private async requireOwner(user: User, id: string): Promise<Listing> {
    const listing = await this.repo.findListingModel(id);
    if (!listing || listing.deletedAt) {
      throw new NotFoundError('Posting', 'LISTING_NOT_FOUND');
    }
    if (listing.userId !== user.id) {
      throw new ForbiddenError('Anda bukan pemilik posting ini.');
    }
    return listing;
  }

  private async assertCategory(categoryId: string | null, postType: PostType): Promise<void> {
    if (!categoryId) {
      return;
    }
    const category = await this.repo.findCategory(categoryId);
    if (!category || !category.is_active) {
      throw new ValidationError('Kategori tidak ditemukan.', details('category_id', 'tidak ditemukan'));
    }
    if (category.post_type !== postType) {
      throw new ValidationError(
        'Kategori tidak sesuai dengan tipe posting.',
        details('category_id', `kategori untuk ${category.post_type}`),
      );
    }
  }

  private validatePrice(value: number | null | undefined, required: boolean): number | null {
    if (value === undefined || value === null) {
      if (required) {
        throw new ValidationError('price wajib untuk posting jual.', details('price', 'wajib diisi'));
      }
      return null;
    }
    if (!Number.isFinite(value) || value < 0) {
      throw new ValidationError('Harga tidak valid.', details('price', '>= 0'));
    }
    if (value > 9_999_999_999_999.99) {
      throw new ValidationError('Harga terlalu besar.', details('price', 'maksimal 9.999.999.999.999,99'));
    }
    return Math.round(value * 100) / 100;
  }

  private validateEventFields(
    postType: PostType,
    startInput: string | null | undefined,
    endInput: string | null | undefined,
    locationInput: string | null | undefined,
    isFreeInput: boolean | null | undefined,
    currentStart: Date | null,
    currentEnd: Date | null,
  ): { start: Date | null; end: Date | null; location: string | null; isFree: boolean | null } {
    if (postType !== 'event') {
      return { start: null, end: null, location: null, isFree: null };
    }

    const start =
      startInput !== undefined ? parseDate(startInput, 'event_start') : currentStart;
    const end = endInput !== undefined ? parseDate(endInput, 'event_end') : currentEnd;

    if (!start && startInput !== undefined) {
      throw new ValidationError('event_start wajib untuk event.', details('event_start', 'wajib diisi'));
    }
    if (start && end && end.getTime() < start.getTime()) {
      throw new ValidationError(
        'event_end harus setelah event_start.',
        details('event_end', 'sebelum event_start'),
      );
    }

    return {
      start,
      end,
      location:
        locationInput !== undefined
          ? optionalTrimmed(locationInput, 255, 'event_location')
          : null,
      isFree: isFreeInput ?? null,
    };
  }

  private validateLinks(
    eventLink: string | null | undefined,
    informationLink: string | null | undefined,
  ): { eventLink: string | null; informationLink: string | null } {
    return {
      eventLink: optionalUrl(eventLink, 'event_link'),
      informationLink: optionalUrl(informationLink, 'information_link'),
    };
  }

  private resolveAreaLabel(value: string | null | undefined, user: User): string {
    const label = optionalTrimmed(value, 150, 'area_label') ?? user.areaLabel;
    if (!label) {
      throw new BusinessRuleError(
        'AREA_LABEL_REQUIRED',
        'Label area publik wajib diisi agar lokasi tetap kasar.',
      );
    }
    return label;
  }

  private async resolveOrigin(
    input: OriginInput,
    user: User | null,
    required: true,
  ): Promise<DiscoveryOrigin>;
  private async resolveOrigin(
    input: OriginInput,
    user: User | null,
    required: false,
  ): Promise<DiscoveryOrigin | null>;
  private async resolveOrigin(
    input: OriginInput,
    user: User | null,
    required: boolean,
  ): Promise<DiscoveryOrigin | null> {
    if (input.lat !== undefined || input.lng !== undefined) {
      if (input.lat === undefined || input.lng === undefined) {
        throw new ValidationError('lat dan lng harus dikirim bersama.', details('lat', 'lng wajib'));
      }
      return validateCoordinates(input.lat, input.lng);
    }

    if (user) {
      const saved = await this.users.getLocation(user.id);
      if (saved) {
        return { lat: saved.lat, lng: saved.lng };
      }
    }

    if (required) {
      throw new AppError(
        'LOCATION_REQUIRED',
        'Lokasi diperlukan untuk penelusuran radius 4 km. Kirim lat/lng atau simpan lokasi profil.',
        400,
      );
    }
    return null;
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title) || 'posting';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const suffix = randomUUID().replace(/-/g, '').slice(0, 6);
      const candidate = `${base}-${suffix}`.slice(0, 190);
      if (!(await this.repo.slugExists(candidate))) {
        return candidate;
      }
    }
    return `${base}-${randomUUID()}`.slice(0, 190);
  }
}
