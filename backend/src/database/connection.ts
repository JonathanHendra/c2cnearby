import { Sequelize } from 'sequelize';

import type { AppConfig } from '../config/env.js';

export const MODEL_OPTIONS = {
  underscored: true,
  freezeTableName: true,
  charset: 'utf8mb4',
  collate: 'utf8mb4_0900_ai_ci',
  timestamps: true,
} as const;

/**
 * MySQL menyimpan DATETIME sebagai jam dinding tanpa zona waktu, sedangkan
 * `NOW()` mengikuti zona waktu sesi. Sesi harus memakai offset lokal server
 * agar perbandingan seperti `published_at <= NOW(3)` konsisten dengan nilai
 * yang ditulis aplikasi.
 */
function localUtcOffset(): string {
  const minutes = -new Date().getTimezoneOffset();
  const sign = minutes >= 0 ? '+' : '-';
  const absolute = Math.abs(minutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0');
  const rest = String(absolute % 60).padStart(2, '0');
  return `${sign}${hours}:${rest}`;
}

export function createSequelize(
  config: AppConfig,
  port: number = config.db.port,
): Sequelize {
  return new Sequelize(config.db.name, config.db.user, config.db.password, {
    host: config.db.host,
    port,
    dialect: 'mysql',
    logging: false,
    timezone: localUtcOffset(),
    define: {
      ...MODEL_OPTIONS,
      charset: 'utf8mb4',
      collate: 'utf8mb4_0900_ai_ci',
    },
    pool: {
      min: 0,
      max: config.db.poolMax,
      acquire: 30_000,
      idle: 10_000,
    },
    dialectOptions: {
      charset: 'utf8mb4',
      supportBigNumbers: true,
      dateStrings: false,
      ...(config.db.ssl ? { ssl: { rejectUnauthorized: true } } : {}),
    },
  });
}

export async function closeSequelize(sequelize: Sequelize): Promise<void> {
  await sequelize.close();
}
