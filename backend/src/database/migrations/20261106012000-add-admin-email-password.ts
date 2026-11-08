import { QueryTypes, type QueryInterface } from 'sequelize';

import type { Migration, MigrationParams } from './types.js';

/**
 * Merekam alamat email + kata sandi (password_hash) bagi admin yang masuk
 * tanpa Firebase. Kolom `firebase_uid` tetap dipertahankan agar akun admin
 * yang sudah lanjut Google tidak terganggu.
 *
 * Idempoten: sebagian database sudah punya kolom `email` dari migrasi
 * pembuatan tabel, sehingga setiap langkah diperiksa dulu.
 */
async function hasColumn(
  context: QueryInterface,
  table: string,
  column: string,
): Promise<boolean> {
  const rows = (await context.sequelize.query(
    `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?`,
    { replacements: [table, column], type: QueryTypes.SELECT },
  )) as unknown[];
  return rows.length > 0;
}

async function hasIndex(
  context: QueryInterface,
  table: string,
  indexName: string,
): Promise<boolean> {
  const rows = (await context.sequelize.query(
    `SELECT INDEX_NAME
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?`,
    { replacements: [table, indexName], type: QueryTypes.SELECT },
  )) as unknown[];
  return rows.length > 0;
}

export const migration: Migration = {
  name: '20261106012000-add-admin-email-password.ts',

  async up({ context }: MigrationParams): Promise<void> {
    if (!(await hasColumn(context, 'admin_users', 'email'))) {
      await context.sequelize.query(
        'ALTER TABLE admin_users ADD COLUMN email VARCHAR(190) NULL AFTER firebase_uid',
      );
    }

    if (!(await hasColumn(context, 'admin_users', 'password_hash'))) {
      await context.sequelize.query(
        'ALTER TABLE admin_users ADD COLUMN password_hash VARCHAR(128) NULL AFTER email',
      );
    }

    if (!(await hasIndex(context, 'admin_users', 'uq_admin_users_email'))) {
      await context.sequelize.query(
        'ALTER TABLE admin_users ADD CONSTRAINT uq_admin_users_email UNIQUE (email)',
      );
    }
  },

  async down({ context }: MigrationParams): Promise<void> {
    if (await hasIndex(context, 'admin_users', 'uq_admin_users_email')) {
      await context.sequelize.query(
        'ALTER TABLE admin_users DROP INDEX uq_admin_users_email',
      );
    }
    if (await hasColumn(context, 'admin_users', 'password_hash')) {
      await context.sequelize.query(
        'ALTER TABLE admin_users DROP COLUMN password_hash',
      );
    }
    if (await hasColumn(context, 'admin_users', 'email')) {
      await context.sequelize.query('ALTER TABLE admin_users DROP COLUMN email');
    }
  },
};
