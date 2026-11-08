import { TABLE_OPTIONS, TIMESTAMPS, type Migration, type MigrationParams } from './types.js';

export const migration: Migration = {
  name: '20261105010800-create-reports.ts',

  async up({ context }: MigrationParams): Promise<void> {
    await context.sequelize.query(`
      CREATE TABLE reports (
        id CHAR(36) NOT NULL,
        reporter_id CHAR(36) NOT NULL,
        reported_user_id CHAR(36) NULL,
        listing_id CHAR(36) NULL,
        reason ENUM('spam','fraud','prohibited','harassment','other') NOT NULL,
        description TEXT NULL,
        status ENUM('open','reviewing','resolved','dismissed') NOT NULL DEFAULT 'open',
        resolution_note VARCHAR(500) NULL,
        handled_by_admin_id CHAR(36) NULL,
        handled_at DATETIME(3) NULL,
        ${TIMESTAMPS},
        PRIMARY KEY (id),
        KEY idx_reports_status (status, created_at),
        KEY idx_reports_user (reported_user_id),
        KEY idx_reports_listing (listing_id)
      ) ${TABLE_OPTIONS}
    `);
  },

  async down({ context }: MigrationParams): Promise<void> {
    await context.dropTable('reports', {});
  },
};
