const fs = require('node:fs/promises');
const path = require('node:path');
const { inventoryMigrationTarget } = require('./inventoryMigrationTarget');

async function migrateInventory(sequelize) {
  const file = path.join(__dirname, 'migrations', '20261103_add_inventory_columns.sql');
  const sql = (await fs.readFile(file, 'utf8')).replace(/^\s*--.*$/gm, '');
  for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean)) {
    await sequelize.query(statement);
  }

  const queryInterface = sequelize.getQueryInterface();
  const indexes = await queryInterface.showIndex('StockMovements');
  const hasUniqueKey = indexes.some(index =>
    index.unique && index.fields.length === 1 &&
    index.fields[0].attribute === 'idempotencyKey' && index.fields[0].length == null
  );
  if (!hasUniqueKey) {
    await queryInterface.addIndex('StockMovements', ['idempotencyKey'], {
      name: 'uniq_sm_idempotencyKey',
      unique: true,
    });
  }
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const sequelize = inventoryMigrationTarget(args, ['--execute']);
    try {
      if (!args.includes('--execute')) throw new Error('Migration requires --execute');
      await migrateInventory(sequelize);
      console.log(`Inventory schema verified on ${sequelize.config.database}`);
    } finally {
      await sequelize.close();
    }
  })().catch(err => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

module.exports = { migrateInventory };
