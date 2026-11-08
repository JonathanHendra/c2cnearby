import type { Sequelize } from 'sequelize';

import type { AppConfig } from '../config/env.js';
import { initializeAssociations } from './associations.js';
import { createSequelize } from './connection.js';
import { initializeModels, type DatabaseModels } from './models/index.js';
import { resolveDatabaseTarget } from './resolve-target.js';

export interface Database {
  readonly sequelize: Sequelize;
  readonly models: DatabaseModels;
}

/**
 * Composition root for persistence: one Sequelize instance, one model
 * registry, one association pass, then a connectivity check.
 *
 * The schema is provisioned automatically in development: a missing database
 * is created, and `sync()` creates only the tables that do not exist yet. It
 * never drops or truncates data. Migrations remain the path for production.
 */
export async function connectDatabase(config: AppConfig): Promise<Database> {
  const target = await resolveDatabaseTarget(config);
  const sequelize = createSequelize(config, target.port);
  const models = initializeModels(sequelize);
  initializeAssociations(models);
  await sequelize.authenticate();

  if (target.createdDatabase) {
    console.log(`✅ Database "${config.db.name}" dibuat otomatis.`);
  }

  if (config.nodeEnv === 'development') {
    await sequelize.sync();
    await ensureAdditiveColumns(sequelize);
    console.log(
      `✅ Skema "${config.db.name}" siap di ${config.db.host}:${target.port} (tabel dibuat bila belum ada).`,
    );
  }

  return { sequelize, models };
}

/**
 * `sync()` only creates missing tables, so columns added by later migrations
 * are applied here for development databases that were provisioned by sync.
 * Additive only: no column is ever dropped or rewritten.
 */
async function ensureAdditiveColumns(sequelize: Sequelize): Promise<void> {
  const [rows] = (await sequelize.query(
    `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'reviews'
        AND COLUMN_NAME = 'hidden_at'`,
  )) as [unknown[], unknown];

  if (rows.length === 0) {
    await sequelize.query(
      'ALTER TABLE reviews ADD COLUMN hidden_at DATETIME(3) NULL AFTER review',
    );
    console.log('✅ Kolom reviews.hidden_at ditambahkan.');
  }
}

export async function disconnectDatabase(database: Database): Promise<void> {
  await database.sequelize.close();
}

export type { DatabaseModels };
