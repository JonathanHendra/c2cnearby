import type { RowDataPacket } from 'mysql2';
import { createConnection } from 'mysql2/promise';

import type { AppConfig } from '../config/env.js';

/**
 * Local MySQL installations do not agree on a port: Homebrew and most Linux
 * packages use 3306, MAMP defaults to 8889, and other local stacks use 3307.
 * In development we therefore connect to DB_PORT first and, only when that is
 * unreachable, fall back to the other common local ports. Production keeps
 * using exactly the configured port.
 */
const LOCAL_FALLBACK_PORTS = [3306, 8889, 3307, 3308, 3310];
const CONNECT_TIMEOUT_MS = 4_000;

export interface DatabaseTarget {
  readonly port: number;
  readonly discovered: boolean;
  readonly createdDatabase: boolean;
}

function assertSafeDatabaseName(name: string): string {
  if (!/^[A-Za-z0-9_$]{1,64}$/.test(name)) {
    throw new Error(
      `Nama database "${name}" tidak valid. Gunakan huruf, angka, garis bawah, atau tanda dolar.`,
    );
  }
  return name;
}

function connectionOptions(config: AppConfig, port: number) {
  return {
    host: config.db.host,
    port,
    user: config.db.user,
    password: config.db.password,
    connectTimeout: CONNECT_TIMEOUT_MS,
    ...(config.db.ssl ? { ssl: { rejectUnauthorized: true } } : {}),
  };
}

async function isReachable(config: AppConfig, port: number): Promise<boolean> {
  try {
    const connection = await createConnection(connectionOptions(config, port));
    await connection.end();
    return true;
  } catch {
    return false;
  }
}

/** Creates the schema when it does not exist yet; returns true when created. */
async function ensureDatabaseExists(config: AppConfig, port: number): Promise<boolean> {
  const name = assertSafeDatabaseName(config.db.name);
  const connection = await createConnection(connectionOptions(config, port));

  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
      [name],
    );
    if (rows.length > 0) {
      return false;
    }

    try {
      await connection.query(
        `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
      );
    } catch {
      // Older MySQL/MariaDB servers do not know utf8mb4_0900_ai_ci.
      await connection.query(
        `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
    }
    return true;
  } finally {
    await connection.end();
  }
}

export async function resolveDatabaseTarget(config: AppConfig): Promise<DatabaseTarget> {
  const configuredPort = config.db.port;

  if (await isReachable(config, configuredPort)) {
    const createdDatabase = await ensureDatabaseExists(config, configuredPort);
    return { port: configuredPort, discovered: false, createdDatabase };
  }

  const candidates = config.isProduction
    ? []
    : LOCAL_FALLBACK_PORTS.filter((port) => port !== configuredPort);

  for (const port of candidates) {
    if (!(await isReachable(config, port))) {
      continue;
    }
    const createdDatabase = await ensureDatabaseExists(config, port);
    console.log(
      `ℹ️  MySQL tidak merespons di port ${configuredPort}; memakai MySQL lokal di port ${port}.`,
    );
    return { port, discovered: true, createdDatabase };
  }

  const tried = [configuredPort, ...candidates].join(', ');
  throw new Error(
    `Tidak dapat terhubung ke MySQL di ${config.db.host} (port: ${tried}). ` +
      'Pastikan server MySQL/MAMP sudah berjalan, lalu jalankan ulang backend.',
  );
}
