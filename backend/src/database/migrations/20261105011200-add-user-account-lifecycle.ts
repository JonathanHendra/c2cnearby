import type { Migration, MigrationParams } from './types.js';

/**
 * Onboarding needs to distinguish a generated placeholder handle from one the
 * user deliberately claimed, and account deletion needs its grace-period start.
 */
export const migration: Migration = {
  name: '20261105011200-add-user-account-lifecycle.ts',

  async up({ context }: MigrationParams): Promise<void> {
    await context.sequelize.query(`
      ALTER TABLE users
        ADD COLUMN username_chosen_at DATETIME(3) NULL AFTER username,
        ADD COLUMN deletion_requested_at DATETIME(3) NULL AFTER account_status
    `);
  },

  async down({ context }: MigrationParams): Promise<void> {
    await context.sequelize.query(`
      ALTER TABLE users
        DROP COLUMN deletion_requested_at,
        DROP COLUMN username_chosen_at
    `);
  },
};
