import type { Migration, MigrationParams } from './types.js';

export const migration: Migration = {
  name: '20261106010100-add-listing-view-count.ts',

  async up({ context }: MigrationParams): Promise<void> {
    await context.sequelize.query(`
      ALTER TABLE listings
        ADD COLUMN view_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER expires_at
    `);
  },

  async down({ context }: MigrationParams): Promise<void> {
    await context.sequelize.query(`
      ALTER TABLE listings
        DROP COLUMN view_count
    `);
  },
};
