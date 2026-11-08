# Storage & Image Processing

## Abstraction

```ts
interface StorageService {
  putObject(input: {
    key: string;
    body: Buffer;
    contentType: string;
    cacheControl?: string;
    visibility: 'public' | 'private';
  }): Promise<void>;
  deleteObject(key: string, visibility: 'public' | 'private'): Promise<void>;
  getPublicUrl(key: string): string;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
}
```

Implementations:

- `S3StorageService` — any S3-compatible provider (AWS S3, Cloudflare R2, Backblaze B2, MinIO in
  local development). Configured entirely by env vars; no provider SDK leaks into services.
- `LocalStorageService` — development fallback writing to `backend/uploads/` and serving signed
  URLs through a Fastify route; disabled in production.

Business modules depend on the interface via a Fastify decorator (`app.storage`). Swapping the
provider requires only configuration and, if necessary, a new adapter.

## Buckets / prefixes

| Purpose | Visibility | Prefix | Retention |
| --- | --- | --- | --- |
| Avatars | public | `avatars/<userId>/` | replaced on update, old object deleted |
| Listing images | public | `listings/<listingId>/` | deleted with listing hard-delete |
| Event posters | public | `events/<listingId>/` | same |
| Chat media | public-unlisted | `chat-media/<conversationId>/` | deleted with conversation retention |
| Verification | **private** | `verification-private/<userId>/` | provider-only; 24 h TTL for any local temp |

## Processing pipeline

```
multipart → size/type/magic-byte validation → Sharp (rotate, strip metadata, resize, WebP)
        → thumbnail → upload → transaction row insert → response DTO
```

- `failOn: 'warning'`, `limitInputPixels` set (≤ 40 MP), no SVG.
- EXIF/GPS removed by re-encoding; orientation applied before resize.
- Object keys are server-generated UUIDs; user filenames are discarded (path traversal
  impossible).
- Uploads happen after ownership/auth validation; listing image rows are inserted only after a
  successful upload, and failed DB writes trigger object cleanup.

## Variant settings

| Purpose | Longest side | Quality | Thumbnail |
| --- | --- | --- | --- |
| Listing | 1600 | 78 | 400 px, q70 |
| Event poster | 1600 | 78 | 400 px, q70 |
| Avatar | 512 | 75 | — |
| Chat image | 1280 | 75 | 320 px, q65 |
| Verification | untouched by us (provider handles) | — | — |

## Delivery

- Public objects: long-lived cache (`Cache-Control: public, max-age=31536000, immutable`) with
  content-hashed keys.
- Private objects: signed GET, TTL ≤ 600 s, never a public URL.
- Mobile uses `cached_network_image`, requests thumbnails in lists and full images only on detail
  screens.

## Failure handling

- Upload failure → 502 `STORAGE_UNAVAILABLE`, client retries with backoff.
- Orphan sweep job (optional BullMQ/local cron) removes objects without DB rows older than 24 h.
- Deleting a listing removes image objects asynchronously; DB rows cascade.

## Configuration

```env
STORAGE_DRIVER=s3            # s3 | local (local forbidden in production)
STORAGE_ENDPOINT=
STORAGE_BUCKET=
STORAGE_REGION=auto
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
STORAGE_PUBLIC_BASE_URL=
STORAGE_FORCE_PATH_STYLE=false
```

Credentials live only in backend environment variables. Flutter and Angular never receive them.
