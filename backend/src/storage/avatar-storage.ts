import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import sharp from 'sharp';

import { ValidationError } from '../common/errors.js';
import type { AppConfig } from '../config/env.js';

export const AVATAR_SIZE_PX = 512;
const MAX_SOURCE_DIMENSION = 8000;
const MIN_SOURCE_DIMENSION = 64;

export interface StoredAvatar {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly mime: string;
  readonly size: number;
}

/**
 * Normalises an uploaded avatar to a 512 px WebP on local disk. The S3 adapter
 * arrives with the media phase; the interface stays the same.
 */
export class AvatarStorage {
  readonly directory: string;

  constructor(private readonly config: AppConfig) {
    this.directory = resolve(config.storage.uploadDir, 'avatars');
  }

  async ensureDirectory(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
  }

  async save(userId: string, buffer: Buffer): Promise<StoredAvatar> {
    let width = 0;
    let height = 0;
    try {
      const metadata = await sharp(buffer, { failOn: 'error' }).metadata();
      width = metadata.width ?? 0;
      height = metadata.height ?? 0;
    } catch {
      throw new ValidationError('Berkas bukan gambar yang valid.', [
        { path: 'file', message: 'INVALID_IMAGE' },
      ]);
    }

    if (
      width < MIN_SOURCE_DIMENSION ||
      height < MIN_SOURCE_DIMENSION ||
      width > MAX_SOURCE_DIMENSION ||
      height > MAX_SOURCE_DIMENSION
    ) {
      throw new ValidationError('Dimensi gambar tidak didukung.', [
        { path: 'file', message: `antara ${MIN_SOURCE_DIMENSION} dan ${MAX_SOURCE_DIMENSION} px` },
      ]);
    }

    await this.ensureDirectory();
    const fileName = `${userId}.webp`;
    const outputPath = join(this.directory, fileName);

    const info = await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize(AVATAR_SIZE_PX, AVATAR_SIZE_PX, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toFile(outputPath);

    return {
      url: `${this.config.storage.publicBaseUrl}/uploads/avatars/${fileName}?v=${Date.now()}`,
      width: info.width,
      height: info.height,
      mime: 'image/webp',
      size: info.size,
    };
  }
}
