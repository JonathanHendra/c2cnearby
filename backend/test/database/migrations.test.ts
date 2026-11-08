import {
  ForeignKeyConstraintError,
  QueryTypes,
  UniqueConstraintError,
  type Sequelize,
} from 'sequelize';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createMigrator, getMigrationStatus } from '../../src/database/migration-runner.js';
import { migrations } from '../../src/database/migrations/index.js';
import { count, createTestSequelize, dropAllTables } from '../helpers/database.js';

let sequelize: Sequelize;

beforeAll(async () => {
  sequelize = await createTestSequelize();
  await dropAllTables(sequelize);
});

afterAll(async () => {
  // Leave the scratch schema migrated for the other database suites.
  const status = await getMigrationStatus(sequelize);
  if (status.pending.length > 0) {
    await createMigrator(sequelize).up();
  }
  await sequelize.close();
});

describe('migrations', () => {
  it('creates all 21 tables from an empty schema', async () => {
    const applied = await createMigrator(sequelize).up();
    expect(applied).toHaveLength(migrations.length);

    const tables = await count(
      sequelize,
      `SELECT COUNT(*) AS total FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name <> 'SequelizeMeta'`,
    );
    expect(tables).toBe(21);
  });

  it('creates the documented constraints and indexes', async () => {
    const foreignKeys = await count(
      sequelize,
      `SELECT COUNT(*) AS total FROM information_schema.referential_constraints
       WHERE constraint_schema = DATABASE()`,
    );
    expect(foreignKeys).toBe(36);

    const checks = await count(
      sequelize,
      `SELECT COUNT(*) AS total FROM information_schema.table_constraints
       WHERE table_schema = DATABASE() AND constraint_type = 'CHECK'`,
    );
    expect(checks).toBe(5);

    const spatial = await count(
      sequelize,
      `SELECT COUNT(*) AS total FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND index_type = 'SPATIAL'`,
    );
    expect(spatial).toBe(2);

    const srid = await count(
      sequelize,
      `SELECT COUNT(*) AS total FROM information_schema.st_geometry_columns
       WHERE table_schema = DATABASE() AND table_name = 'listings'
         AND column_name = 'location_private' AND srs_id = 4326`,
    );
    expect(srid).toBe(1);

    const wrongCollation = await count(
      sequelize,
      `SELECT COUNT(*) AS total FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name <> 'SequelizeMeta'
         AND table_collation <> 'utf8mb4_0900_ai_ci'`,
    );
    expect(wrongCollation).toBe(0);
  });

  it('enforces foreign keys, unique favorites and check constraints', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const listingId = '22222222-2222-4222-8222-222222222222';

    try {
      await sequelize.query(
        `INSERT INTO users (id, firebase_uid, username, created_at, updated_at)
         VALUES (?, 'fb-phase2-test', 'phase2test', NOW(3), NOW(3))`,
        { replacements: [userId] },
      );
      await sequelize.query(
        `INSERT INTO listings
           (id, user_id, post_type, title, slug, description, location_private,
            location_public_label, created_at, updated_at)
         VALUES (?, ?, 'sell', 'Sepeda Lipat', 'sepeda-lipat-test', 'Mulus',
                 ST_SRID(POINT(106.8, -6.2), 4326), 'Kebayoran Baru', NOW(3), NOW(3))`,
        { replacements: [listingId, userId] },
      );

      const geometry = await sequelize.query<{
        latitude: number;
        longitude: number;
        srid: number;
      }>(
        `SELECT ST_Latitude(location_private) AS latitude,
                ST_Longitude(location_private) AS longitude,
                ST_SRID(location_private) AS srid
         FROM listings WHERE id = ?`,
        { replacements: [listingId], type: QueryTypes.SELECT },
      );
      expect(Number(geometry[0]?.latitude)).toBeCloseTo(-6.2, 5);
      expect(Number(geometry[0]?.longitude)).toBeCloseTo(106.8, 5);
      expect(Number(geometry[0]?.srid)).toBe(4326);

      await sequelize.query(
        `INSERT INTO favorites (id, user_id, listing_id, created_at)
         VALUES (UUID(), ?, ?, NOW(3))`,
        { replacements: [userId, listingId] },
      );

      await expect(
        sequelize.query(
          `INSERT INTO favorites (id, user_id, listing_id, created_at)
           VALUES (UUID(), ?, ?, NOW(3))`,
          { replacements: [userId, listingId] },
        ),
      ).rejects.toBeInstanceOf(UniqueConstraintError);

      await expect(
        sequelize.query(
          `INSERT INTO favorites (id, user_id, listing_id, created_at)
           VALUES (UUID(), '99999999-9999-4999-8999-999999999999', ?, NOW(3))`,
          { replacements: [listingId] },
        ),
      ).rejects.toBeInstanceOf(ForeignKeyConstraintError);

      await expect(
        sequelize.query(
          `INSERT INTO reviews (id, listing_id, reviewer_id, reviewee_id, rating, created_at, updated_at)
           VALUES (UUID(), ?, ?, '33333333-3333-4333-8333-333333333333', 9, NOW(3), NOW(3))`,
          { replacements: [listingId, userId] },
        ),
      ).rejects.toThrow(/chk_reviews_rating/i);
    } finally {
      await sequelize.query(`DELETE FROM listings WHERE id = ?`, { replacements: [listingId] });
      await sequelize.query(`DELETE FROM users WHERE id = ?`, { replacements: [userId] });
    }

    const favoritesLeft = await count(
      sequelize,
      `SELECT COUNT(*) AS total FROM favorites WHERE user_id = '${userId}'`,
    );
    expect(favoritesLeft).toBe(0);
  });

  it('rolls back every migration and leaves only SequelizeMeta', async () => {
    const reverted = await createMigrator(sequelize).down({ to: 0 });
    expect(reverted).toHaveLength(migrations.length);

    const tables = await count(
      sequelize,
      `SELECT COUNT(*) AS total FROM information_schema.tables
       WHERE table_schema = DATABASE()`,
    );
    expect(tables).toBe(1);

    const meta = await count(sequelize, `SELECT COUNT(*) AS total FROM SequelizeMeta`);
    expect(meta).toBe(0);
  });

  it('re-applies cleanly after a full rollback', async () => {
    const applied = await createMigrator(sequelize).up();
    expect(applied).toHaveLength(migrations.length);
    const status = await getMigrationStatus(sequelize);
    expect(status.pending).toEqual([]);
    expect(status.applied).toHaveLength(migrations.length);
  });
});
