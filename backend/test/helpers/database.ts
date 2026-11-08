import { QueryTypes, type Sequelize } from 'sequelize';

import { loadConfig } from '../../src/config/env.js';
import { createSequelize } from '../../src/database/connection.js';
import { createMigrator, getMigrationStatus } from '../../src/database/migration-runner.js';
import { resolveDatabaseTarget } from '../../src/database/resolve-target.js';

export async function createTestSequelize(): Promise<Sequelize> {
  const config = loadConfig();
  const target = await resolveDatabaseTarget(config);
  const sequelize = createSequelize(config, target.port);
  await sequelize.authenticate();
  return sequelize;
}

export async function dropAllTables(sequelize: Sequelize): Promise<void> {
  const tables = await sequelize.query<{ tableName: string }>(
    `SELECT TABLE_NAME AS tableName FROM information_schema.tables WHERE table_schema = DATABASE()`,
    { type: QueryTypes.SELECT },
  );

  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const table of tables) {
      await sequelize.query(`DROP TABLE IF EXISTS \`${table.tableName}\``);
    }
  } finally {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

export async function ensureSchema(sequelize: Sequelize): Promise<void> {
  const status = await getMigrationStatus(sequelize);
  if (status.pending.length > 0) {
    await createMigrator(sequelize).up();
  }
}

export async function count(sequelize: Sequelize, sql: string): Promise<number> {
  const rows = await sequelize.query<{ total: number | string }>(sql, {
    type: QueryTypes.SELECT,
  });
  return Number(rows[0]?.total ?? 0);
}
