import type {
  ListingImageRow,
  ListingRow,
} from '../repositories/listing-repository.js';

export interface ListingImageDTO {
  readonly id: string;
  readonly url: string;
  readonly thumbnail_url: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly sort_order: number;
}

export interface ListingSellerDTO {
  readonly id: string;
  readonly username: string;
  readonly display_name: string | null;
  readonly avatar_url: string | null;
  readonly area_label: string | null;
  readonly is_verified: boolean;
  readonly joined_at: string;
  readonly listing_count: number;
}

export interface ListingDTO {
  readonly id: string;
  readonly post_type: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly status: string;
  readonly category: { id: string; name: string; slug: string } | null;
  readonly price: number | null;
  readonly price_type: string | null;
  readonly condition: string | null;
  readonly brand: string | null;
  readonly area_label: string;
  readonly distance_m: number | null;
  readonly images: readonly ListingImageDTO[];
  readonly thumbnail_url: string | null;
  readonly seller: ListingSellerDTO;
  readonly event_start: string | null;
  readonly event_end: string | null;
  readonly event_location: string | null;
  readonly event_is_free: boolean | null;
  readonly event_link: string | null;
  readonly information_link: string | null;
  readonly favorite_count: number;
  readonly participant_count: number;
  readonly view_count: number;
  readonly is_favorite: boolean;
  readonly is_owner: boolean;
  readonly participation_status: string | null;
  readonly published_at: string | null;
  readonly expires_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

function iso(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isoRequired(value: Date | string): string {
  return iso(value) ?? new Date(0).toISOString();
}

function numberOrNull(value: string | number | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toImageDto(image: ListingImageRow): ListingImageDTO {
  return {
    id: image.id,
    url: image.image_url,
    thumbnail_url: image.thumbnail_url,
    width: image.width === null ? null : Number(image.width),
    height: image.height === null ? null : Number(image.height),
    sort_order: Number(image.sort_order),
  };
}

/**
 * Public projection of a listing. Exact coordinates, addresses and phone
 * numbers are intentionally absent; only a coarse area, rounded distance and
 * public seller fields leave the backend.
 */
export function toListingDto(
  row: ListingRow,
  images: readonly ListingImageRow[],
  viewerId: string | null,
): ListingDTO {
  return {
    id: row.id,
    post_type: row.post_type,
    title: row.title,
    slug: row.slug,
    description: row.description,
    status: row.status,
    category:
      row.category_id && row.category_name && row.category_slug
        ? { id: row.category_id, name: row.category_name, slug: row.category_slug }
        : null,
    price: numberOrNull(row.price),
    price_type: row.price_type,
    condition: row.condition,
    brand: row.brand,
    area_label: row.location_public_label,
    distance_m:
      row.distance_m === null ? null : Math.max(0, Math.round(Number(row.distance_m))),
    images: images.map(toImageDto),
    thumbnail_url: images[0]?.thumbnail_url ?? null,
    seller: {
      id: row.seller_id,
      username: row.seller_username,
      display_name: row.seller_display_name,
      avatar_url: row.seller_avatar_url,
      area_label: row.seller_area_label,
      is_verified: row.seller_face_status === 'verified',
      joined_at: isoRequired(row.seller_joined_at),
      listing_count: Number(row.seller_listing_count),
    },
    event_start: iso(row.event_start),
    event_end: iso(row.event_end),
    event_location: row.event_location_public,
    event_is_free:
      row.event_is_free === null ? null : Boolean(Number(row.event_is_free)),
    event_link: row.event_link,
    information_link: row.information_link,
    favorite_count: Number(row.favorite_count),
    participant_count: Number(row.participant_count),
    view_count: Number(row.view_count),
    is_favorite: Boolean(Number(row.is_favorite)),
    is_owner: viewerId !== null && viewerId === row.seller_id,
    participation_status: row.participation_status,
    published_at: iso(row.published_at),
    expires_at: iso(row.expires_at),
    created_at: isoRequired(row.created_at),
    updated_at: isoRequired(row.updated_at),
  };
}
