import { TABLE_OPTIONS, TIMESTAMPS, type Migration, type MigrationParams } from './types.js';

export const migration: Migration = {
  name: '20261105010700-create-reviews.ts',

  async up({ context }: MigrationParams): Promise<void> {
    await context.sequelize.query(`
      CREATE TABLE reviews (
        id CHAR(36) NOT NULL,
        listing_id CHAR(36) NOT NULL,
        reviewer_id CHAR(36) NOT NULL,
        reviewee_id CHAR(36) NOT NULL,
        rating TINYINT UNSIGNED NOT NULL,
        review VARCHAR(1000) NULL,
        ${TIMESTAMPS},
        PRIMARY KEY (id),
        UNIQUE KEY uq_reviews_listing_reviewer (listing_id, reviewer_id),
        KEY idx_reviews_reviewee (reviewee_id, created_at),
        CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5)
      ) ${TABLE_OPTIONS}
    `);
  },

  async down({ context }: MigrationParams): Promise<void> {
    await context.dropTable('reviews', {});
  },
};
