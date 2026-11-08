import { Op, QueryTypes, type Sequelize } from 'sequelize';

import { DISCOVERY_RADIUS_M } from '../config/constants.js';
import type { PostType } from '../database/models/category.model.js';
import type { DatabaseModels } from '../database/models/index.js';
import type { ListingStatus } from '../database/models/listing.model.js';

export interface ListingRow {
  readonly id: string;
  readonly post_type: PostType;
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly price: string | number | null;
  readonly price_type: 'fixed' | 'negotiable' | null;
  readonly condition: 'new' | 'used' | null;
  readonly brand: string | null;
  readonly location_public_label: string;
  readonly event_start: Date | string | null;
  readonly event_end: Date | string | null;
  readonly event_location_public: string | null;
  readonly event_is_free: number | boolean | null;
  readonly event_link: string | null;
  readonly information_link: string | null;
  readonly status: ListingStatus;
  readonly published_at: Date | string | null;
  readonly expires_at: Date | string | null;
  readonly view_count: number | string;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
  readonly category_id: string | null;
  readonly category_name: string | null;
  readonly category_slug: string | null;
  readonly seller_id: string;
  readonly seller_username: string;
  readonly seller_display_name: string | null;
  readonly seller_avatar_url: string | null;
  readonly seller_area_label: string | null;
  readonly seller_face_status: string;
  readonly seller_joined_at: Date | string;
  readonly seller_listing_count: number | string;
  readonly favorite_count: number | string;
  readonly participant_count: number | string;
  readonly image_count: number | string;
  readonly distance_m: number | string | null;
  readonly is_favorite: number | boolean;
  readonly participation_status: string | null;
  readonly favorited_at?: Date | string | null;
}

export interface ListingImageRow {
  readonly id: string;
  readonly listing_id: string;
  readonly image_url: string;
  readonly thumbnail_url: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly sort_order: number;
}

export interface DiscoveryOrigin {
  readonly lat: number;
  readonly lng: number;
}

export interface FeedFilters {
  readonly origin: DiscoveryOrigin;
  readonly postType?: PostType | undefined;
  readonly categoryId?: string | undefined;
  readonly sellerId?: string | undefined;
  readonly query?: string | undefined;
  readonly page: number;
  readonly limit: number;
  readonly viewerId: string | null;
}

export interface PageOptions {
  readonly page: number;
  readonly limit: number;
}

export interface CreateListingRecord {
  readonly id: string;
  readonly userId: string;
  readonly postType: PostType;
  readonly categoryId: string | null;
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly price: string | null;
  readonly priceType: 'fixed' | 'negotiable' | null;
  readonly condition: 'new' | 'used' | null;
  readonly brand: string | null;
  readonly lat: number;
  readonly lng: number;
  readonly locationPublicLabel: string;
  readonly eventStart: Date | null;
  readonly eventEnd: Date | null;
  readonly eventLocationPublic: string | null;
  readonly eventIsFree: boolean | null;
  readonly eventLink: string | null;
  readonly informationLink: string | null;
  readonly status: ListingStatus;
  readonly publishedAt: Date | null;
  readonly expiresAt: Date | null;
}

export interface ListingUpdateRecord {
  categoryId?: string | null | undefined;
  title?: string | undefined;
  description?: string | undefined;
  price?: string | null | undefined;
  priceType?: 'fixed' | 'negotiable' | null | undefined;
  condition?: 'new' | 'used' | null | undefined;
  brand?: string | null | undefined;
  lat?: number | undefined;
  lng?: number | undefined;
  locationPublicLabel?: string | undefined;
  eventStart?: Date | null | undefined;
  eventEnd?: Date | null | undefined;
  eventLocationPublic?: string | null | undefined;
  eventIsFree?: boolean | null | undefined;
  eventLink?: string | null | undefined;
  informationLink?: string | null | undefined;
  status?: ListingStatus | undefined;
  publishedAt?: Date | null | undefined;
  expiresAt?: Date | null | undefined;
}

const LISTING_COLUMNS = `
  l.id, l.post_type, l.title, l.slug, l.description, l.price, l.price_type,
  l.\`condition\`, l.brand, l.location_public_label, l.event_start, l.event_end,
  l.event_location_public, l.event_is_free, l.event_link, l.information_link,
  l.status, l.published_at, l.expires_at, l.view_count, l.created_at, l.updated_at,
  c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
  u.id AS seller_id, u.username AS seller_username, u.display_name AS seller_display_name,
  u.avatar_url AS seller_avatar_url, u.area_label AS seller_area_label,
  u.face_verification_status AS seller_face_status, u.created_at AS seller_joined_at,
  (SELECT COUNT(*) FROM listings sl
    WHERE sl.user_id = l.user_id AND sl.deleted_at IS NULL AND sl.status = 'active')
    AS seller_listing_count,
  (SELECT COUNT(*) FROM favorites f WHERE f.listing_id = l.id) AS favorite_count,
  (SELECT COUNT(*) FROM event_participants ep
    WHERE ep.event_listing_id = l.id AND ep.status <> 'cancelled') AS participant_count,
  (SELECT COUNT(*) FROM listing_images li WHERE li.listing_id = l.id) AS image_count
`;

const LISTING_FROM = `
  FROM listings l
  LEFT JOIN categories c ON c.id = l.category_id
  JOIN users u ON u.id = l.user_id
`;

const VISIBLE_WHERE = `
  l.deleted_at IS NULL
  AND l.status = 'active'
  AND l.published_at IS NOT NULL
  AND l.published_at <= NOW(3)
  AND (l.expires_at IS NULL OR l.expires_at > NOW(3))
`;

function distanceExpression(origin: DiscoveryOrigin | null): {
  select: string;
  having: string;
  params: number[];
} {
  if (!origin) {
    return { select: 'NULL AS distance_m', having: '', params: [] };
  }
  const expression =
    'ROUND(ST_Distance_Sphere(l.location_private, ST_SRID(POINT(?, ?), 4326)))';
  return {
    select: `${expression} AS distance_m`,
    having: `${expression} <= ?`,
    params: [origin.lng, origin.lat],
  };
}

function viewerExpressions(viewerId: string | null): {
  select: string;
  params: Array<string | null>;
} {
  return {
    select: `
      EXISTS(SELECT 1 FROM favorites fv
        WHERE fv.listing_id = l.id AND fv.user_id = ?) AS is_favorite,
      (SELECT ep.status FROM event_participants ep
        WHERE ep.event_listing_id = l.id AND ep.user_id = ? LIMIT 1) AS participation_status
    `,
    params: [viewerId, viewerId],
  };
}

function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export class ListingRepository {
  constructor(
    private readonly sequelize: Sequelize,
    private readonly models: DatabaseModels,
  ) {}

  async categories(postType?: PostType): Promise<
    Array<{
      id: string;
      name: string;
      slug: string;
      post_type: PostType;
      icon: string | null;
      image_url: string | null;
      sort_order: number;
    }>
  > {
    const where = postType ? 'AND post_type = ?' : '';
    return this.sequelize.query(
      `SELECT id, name, slug, post_type, icon, image_url, sort_order
         FROM categories WHERE is_active = 1 ${where}
        ORDER BY sort_order ASC, name ASC`,
      {
        type: QueryTypes.SELECT,
        replacements: postType ? [postType] : [],
      },
    );
  }

  async findCategory(id: string): Promise<{
    id: string;
    post_type: PostType;
    is_active: number | boolean;
  } | null> {
    const rows = await this.sequelize.query<{
      id: string;
      post_type: PostType;
      is_active: number | boolean;
    }>('SELECT id, post_type, is_active FROM categories WHERE id = ? LIMIT 1', {
      type: QueryTypes.SELECT,
      replacements: [id],
    });
    return rows[0] ?? null;
  }

  async slugExists(slug: string): Promise<boolean> {
    const rows = await this.sequelize.query<{ total: number }>(
      'SELECT COUNT(*) AS total FROM listings WHERE slug = ?',
      { type: QueryTypes.SELECT, replacements: [slug] },
    );
    return Number(rows[0]?.total ?? 0) > 0;
  }

  async create(record: CreateListingRecord): Promise<void> {
    await this.sequelize.query(
      `INSERT INTO listings
        (id, user_id, post_type, category_id, title, slug, description, price, price_type,
         \`condition\`, brand, location_private, location_public_label, event_start, event_end,
         event_location_public, event_is_free, event_link, information_link, status,
         published_at, expires_at, view_count, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               ST_SRID(POINT(?, ?), 4326), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL)`,
      {
        replacements: [
          record.id,
          record.userId,
          record.postType,
          record.categoryId,
          record.title,
          record.slug,
          record.description,
          record.price,
          record.priceType,
          record.condition,
          record.brand,
          record.lng,
          record.lat,
          record.locationPublicLabel,
          record.eventStart,
          record.eventEnd,
          record.eventLocationPublic,
          record.eventIsFree,
          record.eventLink,
          record.informationLink,
          record.status,
          record.publishedAt,
          record.expiresAt,
          new Date(),
          new Date(),
        ],
      },
    );
  }

  async update(id: string, record: ListingUpdateRecord): Promise<void> {
    const assignments: string[] = [];
    const params: unknown[] = [];

    const simple: ReadonlyArray<readonly [keyof ListingUpdateRecord, string]> = [
      ['categoryId', 'category_id'],
      ['title', 'title'],
      ['description', 'description'],
      ['price', 'price'],
      ['priceType', 'price_type'],
      ['condition', '`condition`'],
      ['brand', 'brand'],
      ['locationPublicLabel', 'location_public_label'],
      ['eventStart', 'event_start'],
      ['eventEnd', 'event_end'],
      ['eventLocationPublic', 'event_location_public'],
      ['eventIsFree', 'event_is_free'],
      ['eventLink', 'event_link'],
      ['informationLink', 'information_link'],
      ['status', 'status'],
      ['publishedAt', 'published_at'],
      ['expiresAt', 'expires_at'],
    ];

    for (const [key, column] of simple) {
      if (record[key] !== undefined) {
        assignments.push(`${column} = ?`);
        params.push(record[key]);
      }
    }

    if (record.lat !== undefined && record.lng !== undefined) {
      assignments.push('location_private = ST_SRID(POINT(?, ?), 4326)');
      params.push(record.lng, record.lat);
    }

    if (assignments.length === 0) {
      return;
    }

    assignments.push('updated_at = ?');
    params.push(new Date(), id);

    await this.sequelize.query(
      `UPDATE listings SET ${assignments.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      { replacements: params },
    );
  }

  async softDelete(id: string): Promise<void> {
    await this.sequelize.query(
      `UPDATE listings SET deleted_at = NOW(3), status = 'hidden', updated_at = NOW(3)
        WHERE id = ? AND deleted_at IS NULL`,
      { replacements: [id] },
    );
  }

  async findById(
    id: string,
    viewerId: string | null,
    origin: DiscoveryOrigin | null,
  ): Promise<ListingRow | null> {
    const distance = distanceExpression(origin);
    const viewer = viewerExpressions(viewerId);
    const rows = await this.sequelize.query<ListingRow>(
      `SELECT ${LISTING_COLUMNS}, ${distance.select}, ${viewer.select}
       ${LISTING_FROM}
       WHERE l.id = ? AND l.deleted_at IS NULL
       LIMIT 1`,
      {
        type: QueryTypes.SELECT,
        replacements: [...distance.params, ...viewer.params, id],
      },
    );
    return rows[0] ?? null;
  }

  async feed(filters: FeedFilters): Promise<{ rows: ListingRow[]; total: number }> {
    const distance = distanceExpression(filters.origin);
    const viewer = viewerExpressions(filters.viewerId);

    const conditions: string[] = [VISIBLE_WHERE];
    const filterParams: Array<string | number> = [];

    if (filters.postType) {
      conditions.push('l.post_type = ?');
      filterParams.push(filters.postType);
    }
    if (filters.categoryId) {
      conditions.push('l.category_id = ?');
      filterParams.push(filters.categoryId);
    }
    if (filters.sellerId) {
      conditions.push('l.user_id = ?');
      filterParams.push(filters.sellerId);
    }
    const term = filters.query?.trim();
    if (term) {
      conditions.push("(l.title LIKE ? ESCAPE '\\\\' OR l.description LIKE ? ESCAPE '\\\\')");
      const like = `%${escapeLike(term)}%`;
      filterParams.push(like, like);
    }

    const envelope = boundingBox(filters.origin);
    conditions.push(
      "ST_Within(l.location_private, ST_GeomFromText(?, 4326, 'axis-order=long-lat'))",
    );

    const commonParams: Array<string | number | null> = [
      ...distance.params,
      ...viewer.params,
      ...filterParams,
      envelope,
      ...distance.params,
      DISCOVERY_RADIUS_M,
    ];

    const rows = await this.sequelize.query<ListingRow>(
      `SELECT ${LISTING_COLUMNS}, ${distance.select}, ${viewer.select}
       ${LISTING_FROM}
       WHERE ${conditions.join(' AND ')}
         ${distance.having ? `AND ${distance.having}` : ''}
       ORDER BY distance_m ASC, l.published_at DESC, l.id DESC
       LIMIT ? OFFSET ?`,
      {
        type: QueryTypes.SELECT,
        replacements: [
          ...commonParams,
          filters.limit,
          (filters.page - 1) * filters.limit,
        ],
      },
    );

    const totalRows = await this.sequelize.query<{ total: number }>(
      `SELECT COUNT(*) AS total ${LISTING_FROM}
       WHERE ${conditions.join(' AND ')}
         AND ST_Distance_Sphere(l.location_private, ST_SRID(POINT(?, ?), 4326)) <= ?`,
      {
        type: QueryTypes.SELECT,
        replacements: [
          ...filterParams,
          envelope,
          filters.origin.lng,
          filters.origin.lat,
          DISCOVERY_RADIUS_M,
        ],
      },
    );

    return { rows, total: Number(totalRows[0]?.total ?? 0) };
  }

  async favorites(
    userId: string,
    postType: PostType | undefined,
    options: PageOptions,
    origin: DiscoveryOrigin | null,
  ): Promise<{ rows: ListingRow[]; total: number }> {
    const distance = distanceExpression(origin);
    const viewer = viewerExpressions(userId);
    const typeFilter = postType ? 'AND l.post_type = ?' : '';
    const typeParams = postType ? [postType] : [];

    const rows = await this.sequelize.query<ListingRow>(
      `SELECT ${LISTING_COLUMNS}, ${distance.select}, ${viewer.select}, fav.created_at AS favorited_at
       FROM favorites fav
       JOIN listings l ON l.id = fav.listing_id
       LEFT JOIN categories c ON c.id = l.category_id
       JOIN users u ON u.id = l.user_id
       WHERE fav.user_id = ? AND ${VISIBLE_WHERE} ${typeFilter}
       ORDER BY fav.created_at DESC, l.id DESC
       LIMIT ? OFFSET ?`,
      {
        type: QueryTypes.SELECT,
        replacements: [
          ...distance.params,
          ...viewer.params,
          userId,
          ...typeParams,
          options.limit,
          (options.page - 1) * options.limit,
        ],
      },
    );

    const totalRows = await this.sequelize.query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM favorites fav JOIN listings l ON l.id = fav.listing_id
       WHERE fav.user_id = ? AND ${VISIBLE_WHERE} ${typeFilter}`,
      {
        type: QueryTypes.SELECT,
        replacements: [userId, ...typeParams],
      },
    );

    return { rows, total: Number(totalRows[0]?.total ?? 0) };
  }

  async mine(
    userId: string,
    status: ListingStatus | undefined,
    options: PageOptions,
  ): Promise<{ rows: ListingRow[]; total: number }> {
    const viewer = viewerExpressions(userId);
    const statusFilter = status ? 'AND l.status = ?' : '';
    const statusParams = status ? [status] : [];

    const rows = await this.sequelize.query<ListingRow>(
      `SELECT ${LISTING_COLUMNS}, NULL AS distance_m, ${viewer.select}
       ${LISTING_FROM}
       WHERE l.user_id = ? AND l.deleted_at IS NULL ${statusFilter}
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT ? OFFSET ?`,
      {
        type: QueryTypes.SELECT,
        replacements: [
          ...viewer.params,
          userId,
          ...statusParams,
          options.limit,
          (options.page - 1) * options.limit,
        ],
      },
    );

    const totalRows = await this.sequelize.query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM listings l
       WHERE l.user_id = ? AND l.deleted_at IS NULL ${statusFilter}`,
      { type: QueryTypes.SELECT, replacements: [userId, ...statusParams] },
    );

    return { rows, total: Number(totalRows[0]?.total ?? 0) };
  }

  async imagesFor(listingIds: readonly string[]): Promise<ListingImageRow[]> {
    if (listingIds.length === 0) {
      return [];
    }
    const placeholders = listingIds.map(() => '?').join(', ');
    return this.sequelize.query<ListingImageRow>(
      `SELECT id, listing_id, image_url, thumbnail_url, width, height, sort_order
         FROM listing_images WHERE listing_id IN (${placeholders})
        ORDER BY sort_order ASC, created_at ASC`,
      { type: QueryTypes.SELECT, replacements: [...listingIds] },
    );
  }

  async countImages(listingId: string): Promise<number> {
    const rows = await this.sequelize.query<{ total: number }>(
      'SELECT COUNT(*) AS total FROM listing_images WHERE listing_id = ?',
      { type: QueryTypes.SELECT, replacements: [listingId] },
    );
    return Number(rows[0]?.total ?? 0);
  }

  async addImage(record: {
    id: string;
    listingId: string;
    imageUrl: string;
    thumbnailUrl: string;
    width: number;
    height: number;
    sortOrder: number;
  }): Promise<void> {
    await this.sequelize.query(
      `INSERT INTO listing_images
        (id, listing_id, image_url, thumbnail_url, width, height, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))`,
      {
        replacements: [
          record.id,
          record.listingId,
          record.imageUrl,
          record.thumbnailUrl,
          record.width,
          record.height,
          record.sortOrder,
        ],
      },
    );
  }

  async findImage(id: string, listingId: string): Promise<ListingImageRow | null> {
    const rows = await this.sequelize.query<ListingImageRow>(
      `SELECT id, listing_id, image_url, thumbnail_url, width, height, sort_order
         FROM listing_images WHERE id = ? AND listing_id = ? LIMIT 1`,
      { type: QueryTypes.SELECT, replacements: [id, listingId] },
    );
    return rows[0] ?? null;
  }

  async deleteImage(id: string, listingId: string): Promise<void> {
    await this.sequelize.query(
      'DELETE FROM listing_images WHERE id = ? AND listing_id = ?',
      { replacements: [id, listingId] },
    );
  }

  async isVisible(listingId: string): Promise<boolean> {
    const rows = await this.sequelize.query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM listings l WHERE l.id = ? AND ${VISIBLE_WHERE}`,
      { type: QueryTypes.SELECT, replacements: [listingId] },
    );
    return Number(rows[0]?.total ?? 0) > 0;
  }

  async favoriteCount(listingId: string): Promise<number> {
    const rows = await this.sequelize.query<{ total: number }>(
      'SELECT COUNT(*) AS total FROM favorites WHERE listing_id = ?',
      { type: QueryTypes.SELECT, replacements: [listingId] },
    );
    return Number(rows[0]?.total ?? 0);
  }

  async setFavorite(userId: string, listingId: string): Promise<void> {
    await this.sequelize.query(
      `INSERT INTO favorites (id, user_id, listing_id, created_at)
       VALUES (UUID(), ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE created_at = created_at`,
      { replacements: [userId, listingId] },
    );
  }

  async removeFavorite(userId: string, listingId: string): Promise<void> {
    await this.sequelize.query(
      'DELETE FROM favorites WHERE user_id = ? AND listing_id = ?',
      { replacements: [userId, listingId] },
    );
  }

  async participantCount(listingId: string): Promise<number> {
    const rows = await this.sequelize.query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM event_participants
        WHERE event_listing_id = ? AND status <> 'cancelled'`,
      { type: QueryTypes.SELECT, replacements: [listingId] },
    );
    return Number(rows[0]?.total ?? 0);
  }

  async setParticipation(
    listingId: string,
    userId: string,
    status: 'interested' | 'going' | 'cancelled',
  ): Promise<void> {
    await this.sequelize.query(
      `INSERT INTO event_participants
        (id, event_listing_id, user_id, status, created_at, updated_at)
       VALUES (UUID(), ?, ?, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = NOW(3)`,
      { replacements: [listingId, userId, status] },
    );
  }

  async incrementView(listingId: string): Promise<void> {
    await this.sequelize.query(
      'UPDATE listings SET view_count = view_count + 1 WHERE id = ?',
      { replacements: [listingId] },
    );
  }

  async findListingModel(id: string) {
    return this.models.Listing.findByPk(id);
  }

  async expireDue(now: Date): Promise<number> {
    const [affected] = await this.models.Listing.update(
      { status: 'expired' },
      {
        where: {
          status: 'active',
          deletedAt: null,
          expiresAt: { [Op.lt]: now },
        },
      },
    );
    return affected;
  }
}

/**
 * Bounding box around the fixed radius. Longitude padding widens with
 * latitude; the exact distance filter still enforces 4,000 m.
 */
export function boundingBox(origin: DiscoveryOrigin): string {
  const latDelta = 0.036;
  const cos = Math.max(Math.cos((origin.lat * Math.PI) / 180), 0.01);
  const lngDelta = Math.min(latDelta / cos, 1);
  const minLat = Math.max(origin.lat - latDelta, -90);
  const maxLat = Math.min(origin.lat + latDelta, 90);
  const minLng = Math.max(origin.lng - lngDelta, -180);
  const maxLng = Math.min(origin.lng + lngDelta, 180);

  return `POLYGON((${minLng} ${minLat},${maxLng} ${minLat},${maxLng} ${maxLat},${minLng} ${maxLat},${minLng} ${minLat}))`;
}
