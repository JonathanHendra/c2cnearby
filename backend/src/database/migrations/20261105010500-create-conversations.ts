import { TABLE_OPTIONS, TIMESTAMPS, type Migration, type MigrationParams } from './types.js';

export const migration: Migration = {
  name: '20261105010500-create-conversations.ts',

  async up({ context }: MigrationParams): Promise<void> {
    const query = (sql: string) => context.sequelize.query(sql);

    await query(`
      CREATE TABLE conversations (
        id CHAR(36) NOT NULL,
        listing_id CHAR(36) NOT NULL,
        buyer_id CHAR(36) NOT NULL,
        seller_id CHAR(36) NOT NULL,
        last_message_at DATETIME(3) NULL,
        last_message_preview VARCHAR(200) NULL,
        ${TIMESTAMPS},
        PRIMARY KEY (id),
        UNIQUE KEY uq_conversations_thread (listing_id, buyer_id, seller_id),
        KEY idx_conversations_buyer (buyer_id, last_message_at),
        KEY idx_conversations_seller (seller_id, last_message_at)
      ) ${TABLE_OPTIONS}
    `);

    await query(`
      CREATE TABLE messages (
        id CHAR(36) NOT NULL,
        conversation_id CHAR(36) NOT NULL,
        sender_id CHAR(36) NOT NULL,
        message_type ENUM('text','image','offer','meetup','system') NOT NULL,
        content TEXT NULL,
        media_url VARCHAR(500) NULL,
        read_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL,
        PRIMARY KEY (id),
        KEY idx_messages_thread (conversation_id, created_at),
        KEY idx_messages_sender (sender_id),
        KEY idx_messages_unread (conversation_id, read_at)
      ) ${TABLE_OPTIONS}
    `);

    await query(`
      CREATE TABLE price_offers (
        id CHAR(36) NOT NULL,
        conversation_id CHAR(36) NOT NULL,
        listing_id CHAR(36) NOT NULL,
        sender_id CHAR(36) NOT NULL,
        receiver_id CHAR(36) NOT NULL,
        offered_price DECIMAL(15,2) NOT NULL,
        status ENUM('pending','accepted','rejected','withdrawn','expired') NOT NULL DEFAULT 'pending',
        expires_at DATETIME(3) NULL,
        ${TIMESTAMPS},
        PRIMARY KEY (id),
        KEY idx_offers_thread (conversation_id, created_at),
        KEY idx_offers_listing_status (listing_id, status),
        KEY idx_offers_expiry (status, expires_at),
        CONSTRAINT chk_price_offers_positive CHECK (offered_price > 0)
      ) ${TABLE_OPTIONS}
    `);

    await query(`
      CREATE TABLE transaction_agreements (
        id CHAR(36) NOT NULL,
        listing_id CHAR(36) NOT NULL,
        conversation_id CHAR(36) NOT NULL,
        buyer_id CHAR(36) NOT NULL,
        seller_id CHAR(36) NOT NULL,
        agreed_price DECIMAL(15,2) NOT NULL,
        meetup_location_public VARCHAR(255) NULL,
        meetup_at DATETIME(3) NULL,
        buyer_confirmation TINYINT(1) NOT NULL DEFAULT 0,
        seller_confirmation TINYINT(1) NOT NULL DEFAULT 0,
        status ENUM('negotiating','agreed','meetup_scheduled','completed','cancelled','disputed') NOT NULL DEFAULT 'negotiating',
        completed_at DATETIME(3) NULL,
        ${TIMESTAMPS},
        PRIMARY KEY (id),
        UNIQUE KEY uq_agreements_conversation (conversation_id),
        KEY idx_agreements_listing (listing_id, status),
        KEY idx_agreements_buyer (buyer_id, status),
        KEY idx_agreements_seller (seller_id, status),
        CONSTRAINT chk_agreements_price_non_negative CHECK (agreed_price >= 0)
      ) ${TABLE_OPTIONS}
    `);
  },

  async down({ context }: MigrationParams): Promise<void> {
    await context.dropTable('transaction_agreements', {});
    await context.dropTable('price_offers', {});
    await context.dropTable('messages', {});
    await context.dropTable('conversations', {});
  },
};
