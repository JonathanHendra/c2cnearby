import { TABLE_OPTIONS, TIMESTAMPS, type Migration, type MigrationParams } from './types.js';

export const migration: Migration = {
  name: '20261105010600-create-event-participants.ts',

  async up({ context }: MigrationParams): Promise<void> {
    await context.sequelize.query(`
      CREATE TABLE event_participants (
        id CHAR(36) NOT NULL,
        event_listing_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        status ENUM('interested','going','cancelled') NOT NULL DEFAULT 'interested',
        ${TIMESTAMPS},
        PRIMARY KEY (id),
        UNIQUE KEY uq_event_participants (event_listing_id, user_id),
        KEY idx_event_participants_user (user_id)
      ) ${TABLE_OPTIONS}
    `);
  },

  async down({ context }: MigrationParams): Promise<void> {
    await context.dropTable('event_participants', {});
  },
};
