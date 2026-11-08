import { randomUUID } from 'node:crypto';

import sharp from 'sharp';

import { UPLOAD_LIMITS } from '../config/constants.js';
import { ValidationError } from '../common/errors.js';
import type { StorageService } from '../storage/storage-service.js';

export const LISTING_IMAGE_MAX_PX = 1600;
export const LISTING_THUMBNAIL_MAX_PX = 400;
const MIN_SOURCE_DIMENSION = 64;
const MAX_SOURCE_DIMENSION = 8000;
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif', 'gif', 'tiff']);

export interface StoredListingImage {
  readonly url: string;
  readonly thumbnailUrl: string;
  readonly width: number;
  readonly height: number;
  readonly mime: 'image/webp';
  readonly size: number;
}

function invalid(message: string): never {
  throw new ValidationError(message, [{ path: 'file', message: 'INVALID_IMAGE' }]);
}

/**
 * Validates an uploaded image by decoding it with Sharp, strips metadata,
 * normalises orientation and writes a 1600 px WebP plus a 400 px thumbnail.
 */
export class ListingMediaService {
  constructor(private readonly storage: StorageService) {}

  async save(listingId: string, buffer: Buffer): Promise<StoredListingImage> {
    if (buffer.length === 0) {
      invalid('Berkas gambar kosong.');
    }
    if (buffer.length > UPLOAD_LIMITS.maxFileSizeBytes) {
      invalid('Ukuran gambar melebihi batas 10 MB.');
    }

    let width = 0;
    let height = 0;
    try {
      const metadata = await sharp(buffer, { failOn: 'error' }).metadata();
      width = metadata.width ?? 0;
      height = metadata.height ?? 0;
      if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
        invalid('Format gambar tidak didukung.');
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      invalid('Berkas bukan gambar yang valid.');
    }

    if (
      width < MIN_SOURCE_DIMENSION ||
      height < MIN_SOURCE_DIMENSION ||
      width > MAX_SOURCE_DIMENSION ||
      height > MAX_SOURCE_DIMENSION
    ) {
      invalid(
        `Dimensi gambar harus antara ${MIN_SOURCE_DIMENSION} dan ${MAX_SOURCE_DIMENSION} px.`,
      );
    }

    const imageId = randomUUID();
    const baseKey = `listings/${listingId}/${imageId}`;

    const main = await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize({
        width: LISTING_IMAGE_MAX_PX,
        height: LISTING_IMAGE_MAX_PX,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 78 })
      .toBuffer({ resolveWithObject: true });

    const thumb = await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize({
        width: LISTING_THUMBNAIL_MAX_PX,
        height: LISTING_THUMBNAIL_MAX_PX,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 70 })
      .toBuffer({ resolveWithObject: true });

    const url = await this.storage.put(`${baseKey}.webp`, main.data, 'image/webp');
    let thumbnailUrl: string;
    try {
      thumbnailUrl = await this.storage.put(
        `${baseKey}-thumb.webp`,
        thumb.data,
        'image/webp',
      );
    } catch (error) {
      await this.storage.deleteByUrl(url).catch(() => undefined);
      throw error;
    }

    return {
      url,
      thumbnailUrl,
      width: main.info.width,
      height: main.info.height,
      mime: 'image/webp',
      size: main.info.size,
    };
  }

  async remove(imageUrl: string, thumbnailUrl: string): Promise<void> {
    await Promise.all([
      this.storage.deleteByUrl(imageUrl).catch(() => undefined),
      this.storage.deleteByUrl(thumbnailUrl).catch(() => undefined),
    ]);
  }
}
