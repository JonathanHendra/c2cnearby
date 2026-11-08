import { TABLE_OPTIONS, TIMESTAMPS, type Migration, type MigrationParams } from './types.js';

export const migration: Migration = {
  name: '20261105010200-create-categories.ts',

  async up({ context }: MigrationParams): Promise<void> {
    await context.sequelize.query(`
      CREATE TABLE categories (
        id CHAR(36) NOT NULL,
        name VARCHAR(80) NOT NULL,
        slug VARCHAR(80) NOT NULL,
        post_type ENUM('sell','event','information') NOT NULL,
        icon VARCHAR(80) NULL,
        image_url VARCHAR(500) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0,
        ${TIMESTAMPS},
        PRIMARY KEY (id),
        UNIQUE KEY uq_categories_slug (slug),
        KEY idx_categories_listing (post_type, is_active, sort_order)
      ) ${TABLE_OPTIONS}
    `);
  },

  async down({ context }: MigrationParams): Promise<void> {
    await context.dropTable('categories', {});
  },
};
