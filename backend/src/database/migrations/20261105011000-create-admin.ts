import { TABLE_OPTIONS, TIMESTAMPS, type Migration, type MigrationParams } from './types.js';

export const migration: Migration = {
  name: '20261105011000-create-admin.ts',

  async up({ context }: MigrationParams): Promise<void> {
    const query = (sql: string) => context.sequelize.query(sql);

    await query(`
      CREATE TABLE admin_users (
        id CHAR(36) NOT NULL,
        firebase_uid VARCHAR(128) NOT NULL,
        email VARCHAR(190) NULL,
        role ENUM('super_admin','admin','moderator','verification_manager','support') NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        last_login_at DATETIME(3) NULL,
        ${TIMESTAMPS},
        PRIMARY KEY (id),
        UNIQUE KEY uq_admin_users_firebase_uid (firebase_uid),
        KEY idx_admin_users_role (role, is_active)
      ) ${TABLE_OPTIONS}
    `);

    await query(`
      CREATE TABLE admin_audit_logs (
        id CHAR(36) NOT NULL,
        admin_id CHAR(36) NULL,
        action VARCHAR(100) NOT NULL,
        target_type VARCHAR(50) NOT NULL,
        target_id CHAR(36) NULL,
        metadata JSON NULL,
        ip_address VARCHAR(45) NULL,
        created_at DATETIME(3) NOT NULL,
        PRIMARY KEY (id),
        KEY idx_audit_admin (admin_id, created_at),
        KEY idx_audit_target (target_type, target_id),
        KEY idx_audit_action (action, created_at)
      ) ${TABLE_OPTIONS}
    `);

    await query(`
      CREATE TABLE app_settings (
        id CHAR(36) NOT NULL,
        setting_key VARCHAR(100) NOT NULL,
        value JSON NOT NULL,
        updated_by_admin_id CHAR(36) NULL,
        ${TIMESTAMPS},
        PRIMARY KEY (id),
        UNIQUE KEY uq_app_settings_key (setting_key)
      ) ${TABLE_OPTIONS}
    `);
  },

  async down({ context }: MigrationParams): Promise<void> {
    await context.dropTable('app_settings', {});
    await context.dropTable('admin_audit_logs', {});
    await context.dropTable('admin_users', {});
  },
};
