import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import type { AppConfig } from '../config/env.js';

/**
 * Binary media storage. MySQL stores only URLs, never image bytes. The local
 * adapter serves files from `/uploads`; the S3 adapter is selected with
 * `STORAGE_DRIVER=s3` and keeps the same public URL contract.
 */
export interface StorageService {
  readonly driver: 'local' | 's3';
  put(key: string, buffer: Buffer, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
  deleteByUrl(url: string): Promise<void>;
}

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, '');
}

function keyFromUrl(url: string): string | null {
  try {
    return new URL(url).pathname.replace(/^\/+/, '');
  } catch {
    return null;
  }
}

export class LocalDiskStorageService implements StorageService {
  readonly driver = 'local' as const;
  private readonly root: string;
  private readonly publicBaseUrl: string;

  constructor(config: AppConfig) {
    this.root = resolve(config.storage.uploadDir);
    this.publicBaseUrl = normalizeBase(config.storage.publicBaseUrl);
  }

  async ensureDirectory(): Promise<void> {
    await mkdir(this.root, { recursive: true });
  }

  async put(key: string, buffer: Buffer): Promise<string> {
    const target = join(this.root, key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, buffer);
    return `${this.publicBaseUrl}/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(join(this.root, key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async deleteByUrl(url: string): Promise<void> {
    const path = keyFromUrl(url);
    if (!path || !path.startsWith('uploads/')) {
      return;
    }
    await this.delete(path.slice('uploads/'.length));
  }
}

export class S3StorageService implements StorageService {
  readonly driver = 's3' as const;
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(config: AppConfig) {
    const s3 = config.storage.s3;
    this.bucket = s3.bucket;
    this.publicBaseUrl = normalizeBase(s3.publicBaseUrl);
    this.client = new S3Client({
      region: s3.region,
      ...(s3.endpoint
        ? { endpoint: s3.endpoint, forcePathStyle: true }
        : {}),
      credentials: {
        accessKeyId: s3.accessKeyId,
        secretAccessKey: s3.secretAccessKey,
      },
    });
  }

  async put(key: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return `${this.publicBaseUrl}/${key}`;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async deleteByUrl(url: string): Promise<void> {
    const path = keyFromUrl(url);
    if (!path) {
      return;
    }
    await this.delete(path);
  }
}

export function createStorageService(config: AppConfig): StorageService {
  return config.storage.driver === 's3'
    ? new S3StorageService(config)
    : new LocalDiskStorageService(config);
}
