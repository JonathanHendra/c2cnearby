import { TABLE_OPTIONS, TIMESTAMPS, type Migration, type MigrationParams } from './types.js';

export const migration: Migration = {
  name: '20261105010300-create-listings.ts',

  async up({ context }: MigrationParams): Promise<void> {
    const query = (sql: string) => context.sequelize.query(sql);

    await query(`
      CREATE TABLE listings (
        id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        post_type ENUM('sell','event','information') NOT NULL,
        category_id CHAR(36) NULL,
        title VARCHAR(150) NOT NULL,
        slug VARCHAR(190) NOT NULL,
        description TEXT NOT NULL,
        price DECIMAL(15,2) NULL,
        price_type ENUM('fixed','negotiable') NULL,
        \`condition\` ENUM('new','used') NULL,
        brand VARCHAR(80) NULL,
        location_private POINT SRID 4326 NOT NULL,
        location_public_label VARCHAR(150) NOT NULL,
        event_start DATETIME(3) NULL,
        event_end DATETIME(3) NULL,
        event_location_public VARCHAR(255) NULL,
        event_is_free TINYINT(1) NULL,
        event_link VARCHAR(500) NULL,
        information_link VARCHAR(500) NULL,
        status ENUM('draft','active','hidden','sold','completed','rejected','expired') NOT NULL DEFAULT 'draft',
        published_at DATETIME(3) NULL,
        expires_at DATETIME(3) NULL,
        ${TIMESTAMPS},
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_listings_slug (slug),
        SPATIAL KEY idx_listings_point (location_private),
        KEY idx_listings_feed (status, post_type, published_at),
        KEY idx_listings_category (category_id, status, published_at),
        KEY idx_listings_user (user_id, status, created_at),
        KEY idx_listings_expiry (status, expires_at),
        KEY idx_listings_event (post_type, event_start),
        CONSTRAINT chk_listings_price_non_negative CHECK (price IS NULL OR price >= 0),
        CONSTRAINT chk_listings_event_dates CHECK (event_end IS NULL OR event_start IS NULL OR event_end >= event_start)
      ) ${TABLE_OPTIONS}
    `);

    await query(`
      CREATE TABLE listing_images (
        id CHAR(36) NOT NULL,
        listing_id CHAR(36) NOT NULL,
        image_url VARCHAR(500) NOT NULL,
        thumbnail_url VARCHAR(500) NOT NULL,
        width INT UNSIGNED NULL,
        height INT UNSIGNED NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME(3) NOT NULL,
        PRIMARY KEY (id),
        KEY idx_listing_images_listing (listing_id, sort_order)
      ) ${TABLE_OPTIONS}
    `);
  },

  async down({ context }: MigrationParams): Promise<void> {
    await context.dropTable('listing_images', {});
    await context.dropTable('listings', {});
  },
};
