import type { Migration, MigrationParams } from './types.js';

type ForeignKey = {
  readonly table: string;
  readonly name: string;
  readonly column: string;
  readonly referencedTable: string;
  readonly onDelete: 'CASCADE' | 'RESTRICT' | 'SET NULL';
};

const foreignKeys: readonly ForeignKey[] = [
  { table: 'user_locations', name: 'fk_user_locations_user_id', column: 'user_id', referencedTable: 'users', onDelete: 'CASCADE' },
  { table: 'user_verifications', name: 'fk_user_verifications_user_id', column: 'user_id', referencedTable: 'users', onDelete: 'CASCADE' },
  { table: 'user_blocks', name: 'fk_user_blocks_blocker_id', column: 'blocker_id', referencedTable: 'users', onDelete: 'CASCADE' },
  { table: 'user_blocks', name: 'fk_user_blocks_blocked_id', column: 'blocked_id', referencedTable: 'users', onDelete: 'CASCADE' },
  { table: 'device_tokens', name: 'fk_device_tokens_user_id', column: 'user_id', referencedTable: 'users', onDelete: 'CASCADE' },
  { table: 'notification_preferences', name: 'fk_notification_preferences_user_id', column: 'user_id', referencedTable: 'users', onDelete: 'CASCADE' },
  { table: 'listings', name: 'fk_listings_user_id', column: 'user_id', referencedTable: 'users', onDelete: 'RESTRICT' },
  { table: 'listings', name: 'fk_listings_category_id', column: 'category_id', referencedTable: 'categories', onDelete: 'SET NULL' },
  { table: 'listing_images', name: 'fk_listing_images_listing_id', column: 'listing_id', referencedTable: 'listings', onDelete: 'CASCADE' },
  { table: 'favorites', name: 'fk_favorites_user_id', column: 'user_id', referencedTable: 'users', onDelete: 'CASCADE' },
  { table: 'favorites', name: 'fk_favorites_listing_id', column: 'listing_id', referencedTable: 'listings', onDelete: 'CASCADE' },
  { table: 'conversations', name: 'fk_conversations_listing_id', column: 'listing_id', referencedTable: 'listings', onDelete: 'CASCADE' },
  { table: 'conversations', name: 'fk_conversations_buyer_id', column: 'buyer_id', referencedTable: 'users', onDelete: 'CASCADE' },
  { table: 'conversations', name: 'fk_conversations_seller_id', column: 'seller_id', referencedTable: 'users', onDelete: 'CASCADE' },
  { table: 'messages', name: 'fk_messages_conversation_id', column: 'conversation_id', referencedTable: 'conversations', onDelete: 'CASCADE' },
  { table: 'messages', name: 'fk_messages_sender_id', column: 'sender_id', referencedTable: 'users', onDelete: 'RESTRICT' },
  { table: 'price_offers', name: 'fk_price_offers_conversation_id', column: 'conversation_id', referencedTable: 'conversations', onDelete: 'CASCADE' },
  { table: 'price_offers', name: 'fk_price_offers_listing_id', column: 'listing_id', referencedTable: 'listings', onDelete: 'CASCADE' },
  { table: 'price_offers', name: 'fk_price_offers_sender_id', column: 'sender_id', referencedTable: 'users', onDelete: 'RESTRICT' },
  { table: 'price_offers', name: 'fk_price_offers_receiver_id', column: 'receiver_id', referencedTable: 'users', onDelete: 'RESTRICT' },
  { table: 'transaction_agreements', name: 'fk_agreements_listing_id', column: 'listing_id', referencedTable: 'listings', onDelete: 'RESTRICT' },
  { table: 'transaction_agreements', name: 'fk_agreements_conversation_id', column: 'conversation_id', referencedTable: 'conversations', onDelete: 'RESTRICT' },
  { table: 'transaction_agreements', name: 'fk_agreements_buyer_id', column: 'buyer_id', referencedTable: 'users', onDelete: 'RESTRICT' },
  { table: 'transaction_agreements', name: 'fk_agreements_seller_id', column: 'seller_id', referencedTable: 'users', onDelete: 'RESTRICT' },
  { table: 'event_participants', name: 'fk_event_participants_listing_id', column: 'event_listing_id', referencedTable: 'listings', onDelete: 'CASCADE' },
  { table: 'event_participants', name: 'fk_event_participants_user_id', column: 'user_id', referencedTable: 'users', onDelete: 'CASCADE' },
  { table: 'reviews', name: 'fk_reviews_listing_id', column: 'listing_id', referencedTable: 'listings', onDelete: 'CASCADE' },
  { table: 'reviews', name: 'fk_reviews_reviewer_id', column: 'reviewer_id', referencedTable: 'users', onDelete: 'RESTRICT' },
  { table: 'reviews', name: 'fk_reviews_reviewee_id', column: 'reviewee_id', referencedTable: 'users', onDelete: 'RESTRICT' },
  { table: 'reports', name: 'fk_reports_reporter_id', column: 'reporter_id', referencedTable: 'users', onDelete: 'CASCADE' },
  { table: 'reports', name: 'fk_reports_reported_user_id', column: 'reported_user_id', referencedTable: 'users', onDelete: 'SET NULL' },
  { table: 'reports', name: 'fk_reports_listing_id', column: 'listing_id', referencedTable: 'listings', onDelete: 'SET NULL' },
  { table: 'reports', name: 'fk_reports_handled_by_admin_id', column: 'handled_by_admin_id', referencedTable: 'admin_users', onDelete: 'SET NULL' },
  { table: 'notifications', name: 'fk_notifications_user_id', column: 'user_id', referencedTable: 'users', onDelete: 'CASCADE' },
  { table: 'admin_audit_logs', name: 'fk_admin_audit_logs_admin_id', column: 'admin_id', referencedTable: 'admin_users', onDelete: 'SET NULL' },
  { table: 'app_settings', name: 'fk_app_settings_updated_by_admin_id', column: 'updated_by_admin_id', referencedTable: 'admin_users', onDelete: 'SET NULL' },
];

export const migration: Migration = {
  name: '20261105011100-add-foreign-keys.ts',

  async up({ context }: MigrationParams): Promise<void> {
    for (const fk of foreignKeys) {
      await context.sequelize.query(`
        ALTER TABLE \`${fk.table}\`
          ADD CONSTRAINT \`${fk.name}\`
          FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.referencedTable}\` (\`id\`)
          ON DELETE ${fk.onDelete} ON UPDATE CASCADE
      `);
    }
  },

  async down({ context }: MigrationParams): Promise<void> {
    for (const fk of [...foreignKeys].reverse()) {
      await context.sequelize.query(
        `ALTER TABLE \`${fk.table}\` DROP FOREIGN KEY \`${fk.name}\``,
      );
    }
  },
};
