import { TABLE_OPTIONS, type Migration, type MigrationParams } from './types.js';

export const migration: Migration = {
  name: '20261105010900-create-notifications.ts',

  async up({ context }: MigrationParams): Promise<void> {
    await context.sequelize.query(`
      CREATE TABLE notifications (
        id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        title VARCHAR(150) NOT NULL,
        body VARCHAR(500) NOT NULL,
        type VARCHAR(50) NOT NULL,
        reference_id CHAR(36) NULL,
        read_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL,
        PRIMARY KEY (id),
        KEY idx_notifications_user (user_id, read_at, created_at),
        KEY idx_notifications_reference (type, reference_id)
      ) ${TABLE_OPTIONS}
    `);
  },

  async down({ context }: MigrationParams): Promise<void> {
    await context.dropTable('notifications', {});
  },
};
