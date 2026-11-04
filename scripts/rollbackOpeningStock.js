const { inventoryMigrationTarget } = require('./inventoryMigrationTarget');
const { keyPrefix } = require('./reconcileOpeningStock');

async function rollbackOpeningStock(sequelize) {
  return sequelize.transaction(async transaction => {
    const [products] = await sequelize.query(
      'SELECT id, stock, physicalStock, reservedStock FROM Products ORDER BY id FOR UPDATE',
      { transaction }
    );
    const [rows] = await sequelize.query(
      "SELECT * FROM StockMovements WHERE movementType = 'opening_balance' AND idempotencyKey LIKE :prefix FOR UPDATE",
      { transaction, replacements: { prefix: keyPrefix + '%' } }
    );
    if (!rows.length) throw new Error('No saved opening balance to restore');

    const productsById = new Map(products.map(product => [product.id, product]));
    for (const row of rows) {
      const product = productsById.get(row.productId);
      const options = {
        transaction,
        replacements: {
          productId: row.productId,
          movementId: row.id,
          physical: row.physicalBefore,
          reserved: row.reservedBefore,
        },
      };
      const [newer] = await sequelize.query(
        'SELECT id FROM StockMovements WHERE productId = :productId AND id > :movementId LIMIT 1 FOR UPDATE',
        options
      );
      if (!product || newer.length || Number(product.stock) !== Number(row.availableAfter) ||
          Number(product.physicalStock) !== Number(row.physicalAfter) ||
          Number(product.reservedStock) !== Number(row.reservedAfter)) {
        throw new Error('Stock changed since cutover for product ' + row.productId + '. Restore from a reviewed backup.');
      }
      await sequelize.query(
        'UPDATE Products SET physicalStock = :physical, reservedStock = :reserved WHERE id = :productId',
        options
      );
      await sequelize.query('DELETE FROM StockMovements WHERE id = :movementId', options);
    }
    return rows.length;
  });
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    if (!args.includes('--execute')) throw new Error('Rollback requires --execute');
    const sequelize = inventoryMigrationTarget(args, ['--execute']);
    try {
      const count = await rollbackOpeningStock(sequelize);
      console.log('Restored ' + count + ' opening balances on ' + sequelize.config.database);
    } finally {
      await sequelize.close();
    }
  })().catch(err => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

module.exports = { rollbackOpeningStock };
