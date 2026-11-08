import { TABLE_OPTIONS, TIMESTAMPS, type Migration, type MigrationParams } from './types.js';

const tables = [
  'notification_preferences',
  'device_tokens',
  'user_blocks',
  'user_verifications',
  'user_locations',
  'users',
];

async function up({ context }: MigrationParams): Promise<void> {
  const query = (sql: string) => context.sequelize.query(sql);

  await query(`
    CREATE TABLE users (
      id CHAR(36) NOT NULL,
      firebase_uid VARCHAR(128) NOT NULL,
      username VARCHAR(30) NOT NULL,
      display_name VARCHAR(100) NULL,
      full_name VARCHAR(120) NULL,
      avatar_url VARCHAR(500) NULL,
      bio VARCHAR(280) NULL,
      area_label VARCHAR(120) NULL,
      phone_private VARCHAR(20) NULL,
      phone_verified TINYINT(1) NOT NULL DEFAULT 0,
      face_verification_status ENUM('unverified','pending','verified','rejected') NOT NULL DEFAULT 'unverified',
      profile_completed TINYINT(1) NOT NULL DEFAULT 0,
      account_status ENUM('active','suspended','deactivated') NOT NULL DEFAULT 'active',
      last_active_at DATETIME(3) NULL,
      ${TIMESTAMPS},
      deleted_at DATETIME(3) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_users_firebase_uid (firebase_uid),
      UNIQUE KEY uq_users_username (username),
      KEY idx_users_status (account_status, deleted_at),
      KEY idx_users_last_active (last_active_at)
    ) ${TABLE_OPTIONS}
  `);

  await query(`
    CREATE TABLE user_locations (
      id CHAR(36) NOT NULL,
      user_id CHAR(36) NOT NULL,
      location_private POINT SRID 4326 NOT NULL,
      area_label VARCHAR(120) NULL,
      location_updated_at DATETIME(3) NOT NULL,
      ${TIMESTAMPS},
      PRIMARY KEY (id),
      UNIQUE KEY uq_user_locations_user (user_id),
      SPATIAL KEY idx_user_locations_point (location_private)
    ) ${TABLE_OPTIONS}
  `);

  await query(`
    CREATE TABLE user_verifications (
      id CHAR(36) NOT NULL,
      user_id CHAR(36) NOT NULL,
      verification_type ENUM('phone','face','email') NOT NULL,
      provider VARCHAR(50) NOT NULL,
      provider_reference VARCHAR(190) NULL,
      status ENUM('pending','verified','rejected','expired') NOT NULL DEFAULT 'pending',
      verified_at DATETIME(3) NULL,
      expires_at DATETIME(3) NULL,
      ${TIMESTAMPS},
      PRIMARY KEY (id),
      KEY idx_user_verifications_user (user_id, verification_type, status),
      KEY idx_user_verifications_ref (provider, provider_reference)
    ) ${TABLE_OPTIONS}
  `);

  await query(`
    CREATE TABLE user_blocks (
      id CHAR(36) NOT NULL,
      blocker_id CHAR(36) NOT NULL,
      blocked_id CHAR(36) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_user_blocks (blocker_id, blocked_id),
      KEY idx_user_blocks_blocked (blocked_id)
    ) ${TABLE_OPTIONS}
  `);

  await query(`
    CREATE TABLE device_tokens (
      id CHAR(36) NOT NULL,
      user_id CHAR(36) NOT NULL,
      token VARCHAR(255) NOT NULL,
      platform ENUM('android','ios','web') NOT NULL,
      last_used_at DATETIME(3) NULL,
      ${TIMESTAMPS},
      PRIMARY KEY (id),
      UNIQUE KEY uq_device_tokens_token (token),
      KEY idx_device_tokens_user (user_id)
    ) ${TABLE_OPTIONS}
  `);

  await query(`
    CREATE TABLE notification_preferences (
      id CHAR(36) NOT NULL,
      user_id CHAR(36) NOT NULL,
      type VARCHAR(50) NOT NULL,
      push_enabled TINYINT(1) NOT NULL DEFAULT 1,
      in_app_enabled TINYINT(1) NOT NULL DEFAULT 1,
      ${TIMESTAMPS},
      PRIMARY KEY (id),
      UNIQUE KEY uq_notification_pref (user_id, type)
    ) ${TABLE_OPTIONS}
  `);
}

async function down({ context }: MigrationParams): Promise<void> {
  for (const table of tables) {
    await context.dropTable(table, {});
  }
}

export const migration: Migration = {
  name: '20261105010100-create-users.ts',
  up,
  down,
};
