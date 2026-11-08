import { TABLE_OPTIONS, type Migration, type MigrationParams } from './types.js';

export const migration: Migration = {
  name: '20261105010400-create-favorites.ts',

  async up({ context }: MigrationParams): Promise<void> {
    await context.sequelize.query(`
      CREATE TABLE favorites (
        id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        listing_id CHAR(36) NOT NULL,
        created_at DATETIME(3) NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_favorites_user_listing (user_id, listing_id),
        KEY idx_favorites_listing (listing_id)
      ) ${TABLE_OPTIONS}
    `);
  },

  async down({ context }: MigrationParams): Promise<void> {
    await context.dropTable('favorites', {});
  },
};
