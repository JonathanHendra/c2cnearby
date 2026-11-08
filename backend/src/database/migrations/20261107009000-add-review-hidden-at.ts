import { QueryTypes, type QueryInterface } from 'sequelize';

import type { Migration, MigrationParams } from './types.js';

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

/** Admin moderation can hide a review without deleting it. */
export const migration: Migration = {
  name: '20261107009000-add-review-hidden-at.ts',

  async up({ context }: MigrationParams): Promise<void> {
    if (await hasColumn(context, 'reviews', 'hidden_at')) {
      return;
    }
    await context.sequelize.query(
      'ALTER TABLE reviews ADD COLUMN hidden_at DATETIME(3) NULL AFTER review',
    );
  },

  async down({ context }: MigrationParams): Promise<void> {
    if (!(await hasColumn(context, 'reviews', 'hidden_at'))) {
      return;
    }
    await context.sequelize.query('ALTER TABLE reviews DROP COLUMN hidden_at');
  },
};
