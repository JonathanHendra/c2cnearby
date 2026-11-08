import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

const booleanFromString = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => value === true || value === 'true' || value === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(''),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  DB_SSL: booleanFromString.default(false),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:4200'),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
  RATE_LIMIT_WINDOW: z.string().min(1).default('1 minute'),
  AUTH_DRIVER: z.enum(['firebase', 'dev']).optional(),
  // Admin dashboard sessions (email + password). Separate from the user
  // identity provider: mandatory in production, dev falls back to a local key.
  ADMIN_SESSION_SECRET: z.string().default(''),
  ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  FIREBASE_CLIENT_EMAIL: z.string().min(1).optional(),
  FIREBASE_PRIVATE_KEY: z.string().min(1).optional(),
  FACE_DRIVER: z.enum(['mock']).default('mock'),
  FACE_CALLBACK_SECRET: z.string().default(''),
  UPLOAD_DIR: z.string().min(1).default('storage/uploads'),
  PUBLIC_BASE_URL: z.string().url().default('http://127.0.0.1:4000'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  S3_BUCKET: z.string().min(1).optional(),
  S3_REGION: z.string().min(1).default('ap-southeast-1'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_PUBLIC_BASE_URL: z.string().url().optional(),
});

export interface AppConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly isProduction: boolean;
  readonly host: string;
  readonly port: number;
  readonly logLevel: string;
  readonly corsOrigins: readonly string[];
  readonly rateLimit: { readonly max: number; readonly timeWindow: string };
  readonly db: {
    readonly host: string;
    readonly port: number;
    readonly name: string;
    readonly user: string;
    readonly password: string;
    readonly poolMax: number;
    readonly ssl: boolean;
  };
  readonly auth: {
    readonly driver: 'firebase' | 'dev';
    readonly firebase: {
      readonly projectId: string;
      readonly clientEmail: string;
      readonly privateKey: string;
    };
    readonly adminSession: {
      readonly secret: string;
      readonly ttlSeconds: number;
    };
  };
  readonly face: { readonly driver: 'mock'; readonly callbackSecret: string };
  readonly storage: {
    readonly driver: 'local' | 's3';
    readonly uploadDir: string;
    readonly publicBaseUrl: string;
    readonly s3: {
      readonly bucket: string;
      readonly region: string;
      readonly endpoint: string | null;
      readonly accessKeyId: string;
      readonly secretAccessKey: string;
      readonly publicBaseUrl: string;
    };
  };
}

export class ConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid environment configuration: ${issues.join('; ')}`);
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`),
    );
  }

  const env = parsed.data;

  // Firebase is the only identity provider in production; the dev driver exists
  // solely so local runs and tests work without service-account credentials.
  const authDriver = env.AUTH_DRIVER ?? (env.NODE_ENV === 'production' ? 'firebase' : 'dev');
  if (env.NODE_ENV === 'production' && authDriver === 'dev') {
    throw new ConfigError(['AUTH_DRIVER: driver "dev" tidak diizinkan pada NODE_ENV=production']);
  }

  const firebase = {
    projectId: env.FIREBASE_PROJECT_ID ?? '',
    clientEmail: env.FIREBASE_CLIENT_EMAIL ?? '',
    privateKey: (env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  };

  // Admin sessions only need a signing key; the dashboard never uses Firebase.
  const adminSessionSecret = env.ADMIN_SESSION_SECRET.trim();
  if (env.NODE_ENV === 'production' && adminSessionSecret.length < 32) {
    throw new ConfigError([
      'ADMIN_SESSION_SECRET: wajib diisi minimal 32 karakter pada NODE_ENV=production',
    ]);
  }

  if (authDriver === 'firebase') {
    const required: ReadonlyArray<readonly [string, string]> = [
      ['FIREBASE_PROJECT_ID', firebase.projectId],
      ['FIREBASE_CLIENT_EMAIL', firebase.clientEmail],
      ['FIREBASE_PRIVATE_KEY', firebase.privateKey],
    ];
    const missing = required
      .filter(([, value]) => value.length === 0)
      .map(([name]) => `AUTH_DRIVER=firebase membutuhkan ${name}`);
    if (missing.length > 0) {
      throw new ConfigError(missing);
    }
  }

  const storage = {
    driver: env.STORAGE_DRIVER,
    uploadDir: env.UPLOAD_DIR,
    publicBaseUrl: env.PUBLIC_BASE_URL,
    s3: {
      bucket: env.S3_BUCKET ?? '',
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT ?? null,
      accessKeyId: env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? '',
      publicBaseUrl: env.S3_PUBLIC_BASE_URL ?? '',
    },
  };

  if (storage.driver === 's3') {
    const required: ReadonlyArray<readonly [string, string]> = [
      ['S3_BUCKET', storage.s3.bucket],
      ['S3_ACCESS_KEY_ID', storage.s3.accessKeyId],
      ['S3_SECRET_ACCESS_KEY', storage.s3.secretAccessKey],
      ['S3_PUBLIC_BASE_URL', storage.s3.publicBaseUrl],
    ];
    const missing = required
      .filter(([, value]) => value.length === 0)
      .map(([name]) => `STORAGE_DRIVER=s3 membutuhkan ${name}`);
    if (missing.length > 0) {
      throw new ConfigError(missing);
    }
  }

  return {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    host: env.HOST,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    rateLimit: { max: env.RATE_LIMIT_MAX, timeWindow: env.RATE_LIMIT_WINDOW },
    db: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      name: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      poolMax: env.DB_POOL_MAX,
      ssl: env.DB_SSL,
    },
    auth: {
      driver: authDriver,
      firebase,
      adminSession: {
        secret:
          adminSessionSecret.length > 0
            ? adminSessionSecret
            : 'c2c-nearby-admin-session-secret-development-only',
        ttlSeconds: env.ADMIN_SESSION_TTL_HOURS * 3600,
      },
    },
    face: { driver: env.FACE_DRIVER, callbackSecret: env.FACE_CALLBACK_SECRET },
    storage,
  };
}
