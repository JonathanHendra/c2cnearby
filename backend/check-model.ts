import { loadConfig } from './src/config/env.js';
import { connectDatabase } from './src/database/index.js';

async function main() {
  const config = loadConfig();
  const database = await connectDatabase(config);
  const adminModel = database.sequelize.models.AdminUser;
  console.log('attributes:', Object.keys(adminModel?.getAttributes?.() ?? {}));
  await database.sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
