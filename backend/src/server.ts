import { loadConfig } from './config/env.js';
import { connectDatabase } from './database/index.js';
import { initializeModels } from './database/models/index.js';
import { initializeAssociations } from './database/associations.js';
import { ensureAdminSeed } from './database/seeders/admin.js';
import { ensureCategorySeed } from './database/seeders/categories.js';
import { buildApp } from './app.js';

async function main() {
  const config = loadConfig();
  const database = await connectDatabase(config);
  const models = initializeModels(database.sequelize);
  initializeAssociations(models);

  // Seed the default admin on startup
  try {
    await ensureAdminSeed(models);
    console.log('Default admin seeded');
  } catch (err) {
    console.error('Seed skipped:', err);
  }

  try {
    const created = await ensureCategorySeed(models);
    if (created > 0) {
      console.log(`${created} kategori awal ditambahkan`);
    }
  } catch (err) {
    console.error('Seed kategori dilewati:', err);
  }

  const app = await buildApp({ config, database });
  await app.listen({ port: config.port, host: config.host });
  console.log(`Server listening on http://${config.host}:${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
