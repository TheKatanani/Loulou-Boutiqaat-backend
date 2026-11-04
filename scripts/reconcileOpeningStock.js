const { inventoryMigrationTarget } = require('./inventoryMigrationTarget');

const keyPrefix = 'inventory-opening-v2-';

function openingPlan(products, orders) {
  const reserved = new Map();
  const productIds = new Set(products.map(product => Number(product.id)));

  for (const order of orders) {
    const items = typeof order.orders === 'string' ? JSON.parse(order.orders) : order.orders;
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Invalid items on active order ' + order.id);
    }
    for (const item of items) {
      const id = Number(item.productId ?? item.id);
      const qty = Number(item.quantity ?? item.count);
      if (!productIds.has(id) || !Number.isSafeInteger(qty) || qty <= 0) {
        throw new Error('Invalid reservation on active order ' + order.id);
      }
      reserved.set(id, (reserved.get(id) ?? 0) + qty);
    }
  }

  return products.map(product => {
    const available = Number(product.stock);
    if (!Number.isInteger(available) || available < 0) {
      throw new Error('Invalid available stock on product ' + product.id);
    }
    const targetReserved = reserved.get(Number(product.id)) ?? 0;
    return {
      id: product.id,
      available,
      physicalBefore: Number(product.physicalStock ?? available),
      reservedBefore: Number(product.reservedStock ?? 0),
      physicalAfter: available + targetReserved,
      reservedAfter: targetReserved,
    };
  });
}

async function reconcileOpeningStock(sequelize, { execute = false } = {}) {
  const columns = await sequelize.getQueryInterface().describeTable('Products');
  const hasInventoryColumns = Boolean(columns.physicalStock && columns.reservedStock);
  if (execute && !hasInventoryColumns) throw new Error('Run the inventory schema migration first');

  const readPlan = async (transaction) => {
    const options = { transaction };
    const lock = execute ? ' FOR UPDATE' : '';
    const [orders] = await sequelize.query(
      "SELECT id, orders FROM Orders WHERE orderStatus IN ('pending_whatsapp', 'confirmed') AND inventoryTracked = 1 ORDER BY id" + lock,
      options
    );
    const balances = hasInventoryColumns ? ', physicalStock, reservedStock' : '';
    const [products] = await sequelize.query(
      'SELECT id, stock' + balances + ' FROM Products ORDER BY id' + lock,
      options
    );
    return openingPlan(products, orders);
  };

  if (!execute) return sequelize.transaction(readPlan);
  return sequelize.transaction(async transaction => {
    const plan = await readPlan(transaction);
    const [applied] = await sequelize.query(
      "SELECT id FROM StockMovements WHERE movementType = 'opening_balance' AND idempotencyKey LIKE :prefix LIMIT 1",
      { transaction, replacements: { prefix: keyPrefix + '%' } }
    );
    if (applied.length) throw new Error('Opening inventory has already been applied');

    for (const row of plan) {
      const options = {
        transaction,
        replacements: { ...row, key: keyPrefix + row.id },
      };
      await sequelize.query(
        'UPDATE Products SET physicalStock = :physicalAfter, reservedStock = :reservedAfter WHERE id = :id',
        options
      );
      // The opening movement also preserves the exact pre-cutover balance for rollback.
      await sequelize.query(
        "INSERT INTO StockMovements (productId, movementType, quantity, physicalBefore, physicalAfter, reservedBefore, reservedAfter, availableBefore, availableAfter, idempotencyKey, createdAt) VALUES (:id, 'opening_balance', :physicalAfter, :physicalBefore, :physicalAfter, :reservedBefore, :reservedAfter, :available, :available, :key, NOW())",
        options
      );
    }
    return plan;
  });
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const execute = args.includes('--execute');
    if (execute === args.includes('--preview')) {
      throw new Error('Choose exactly one mode: --preview or --execute');
    }
    const sequelize = inventoryMigrationTarget(args, ['--preview', '--execute']);
    try {
      console.log('Target database: ' + sequelize.config.database);
      const plan = await reconcileOpeningStock(sequelize, { execute });
      console.table(plan);
    } finally {
      await sequelize.close();
    }
  })().catch(err => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

module.exports = { reconcileOpeningStock, openingPlan, keyPrefix };
