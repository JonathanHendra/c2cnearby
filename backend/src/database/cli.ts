import { loadConfig } from '../config/env.js';
import { createSequelize } from './connection.js';
import { createMigrator, getMigrationStatus } from './migration-runner.js';
import { initializeModels } from './models/index.js';
import { runSeeders, undoSeeders } from './seeders/index.js';

const COMMANDS = ['migrate', 'status', 'undo', 'undo:all', 'seed', 'seed:undo'] as const;
type Command = (typeof COMMANDS)[number];

function isCommand(value: string | undefined): value is Command {
  return value !== undefined && (COMMANDS as readonly string[]).includes(value);
}

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!isCommand(command)) {
    fail(`Perintah tidak dikenal. Gunakan salah satu: ${COMMANDS.join(', ')}`);
  }

  const config = loadConfig();
  const sequelize = createSequelize(config);

  try {
    await sequelize.authenticate();

    if (command === 'migrate' || command === 'undo' || command === 'undo:all') {
      const migrator = createMigrator(sequelize);
      if (command === 'migrate') {
        const applied = await migrator.up();
        console.log(
          applied.length === 0
            ? '✔ Tidak ada migrasi baru.'
            : `✔ ${applied.length} migrasi diterapkan: ${applied.map((m) => m.name).join(', ')}`,
        );
      } else if (command === 'undo') {
        const reverted = await migrator.down();
        console.log(
          reverted.length === 0
            ? '✔ Tidak ada migrasi untuk dibatalkan.'
            : `✔ Dibatalkan: ${reverted.map((m) => m.name).join(', ')}`,
        );
      } else {
        if (config.isProduction) {
          fail('undo:all tidak diizinkan saat NODE_ENV=production.');
        }
        const reverted = await migrator.down({ to: 0 });
        console.log(`✔ Seluruh migrasi dibatalkan (${reverted.length} file).`);
      }
    }

    if (command === 'status') {
      const status = await getMigrationStatus(sequelize);
      console.log(`Database : ${config.db.name}@${config.db.host}:${config.db.port}`);
      console.log(`Total    : ${status.total} migrasi`);
      console.log(`Terpasang: ${status.applied.length}`);
      console.log(`Pending  : ${status.pending.length}`);
      console.log(`Terakhir : ${status.latest ?? '-'}`);
      for (const name of status.pending) {
        console.log(`  - pending: ${name}`);
      }
      if (status.pending.length > 0) {
        process.exitCode = 1;
      }
    }

    if (command === 'seed' || command === 'seed:undo') {
      const models = initializeModels(sequelize);
      if (command === 'seed') {
        await runSeeders(models);
        console.log('✔ Seeder selesai (idempotent).');
      } else {
        await undoSeeders(models);
        console.log('✔ Data seeder dihapus.');
      }
    }
  } finally {
    await sequelize.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
