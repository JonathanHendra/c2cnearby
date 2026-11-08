import { loadConfig } from './src/config/env.js';
import { connectDatabase } from './src/database/index.js';
import { ensureAdminSeed } from './src/database/seeders/admin.js';
import { initializeModels } from './src/database/models/index.js';
import { initializeAssociations } from './src/database/associations.js';

async function main() {
  const config = loadConfig();
  const database = await connectDatabase(config);
  const models = initializeModels(database.sequelize);
  initializeAssociations(models);

  try {
    await ensureAdminSeed(models);
    console.log('Seed success');
  } catch (err) {
    console.error('Seed failed:', err.message);
  } finally {
    await database.sequelize.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
