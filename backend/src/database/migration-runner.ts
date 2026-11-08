import type { QueryInterface, Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';

import { ServiceUnavailableError } from '../common/errors.js';
import { migrations } from './migrations/index.js';

export interface MigrationStatus {
  readonly applied: readonly string[];
  readonly pending: readonly string[];
  readonly latest: string | null;
  readonly total: number;
}

export function createMigrator(sequelize: Sequelize): Umzug<QueryInterface> {
  const queryInterface = sequelize.getQueryInterface();

  return new Umzug<QueryInterface>({
    migrations: migrations.map((migration) => ({
      name: migration.name,
      up: ({ context }) => migration.up({ context: context as QueryInterface, sequelize }),
      down: ({ context }) => migration.down({ context: context as QueryInterface, sequelize }),
    })),
    context: queryInterface,
    storage: new SequelizeStorage({ sequelize, tableName: 'SequelizeMeta' }),
    logger: undefined,
  });
}

export async function getMigrationStatus(sequelize: Sequelize): Promise<MigrationStatus> {
  const migrator = createMigrator(sequelize);
  const [executed, pending] = await Promise.all([migrator.executed(), migrator.pending()]);
  const applied = executed.map((entry) => entry.name);

  return {
    applied,
    pending: pending.map((entry) => entry.name),
    latest: applied.at(-1) ?? null,
    total: migrations.length,
  };
}

/**
 * Readiness gate: the process serves /healthz but must not report ready while
 * any migration in the repository has not been applied.
 */
export async function checkMigrationStatus(sequelize: Sequelize): Promise<MigrationStatus> {
  const status = await getMigrationStatus(sequelize);

  if (status.pending.length > 0) {
    throw new ServiceUnavailableError(
      'DB_MIGRATIONS_PENDING',
      'Database belum berada pada versi migrasi terbaru.',
      { pending: status.pending },
    );
  }

  return status;
}
