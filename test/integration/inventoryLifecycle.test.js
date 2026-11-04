process.env.NODE_ENV = 'test';
require('dotenv').config();

if (!process.env.TEST_DATABASE_URL || new URL(process.env.TEST_DATABASE_URL).pathname !== '/loulou_test') {
  throw new Error('Inventory integration tests require TEST_DATABASE_URL targeting loulou_test');
}

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const db = require('../../models');
const orderService = require('../../services/orderService');
const { inventoryService } = require('../../services/inventoryService');

test('Part 1: Inventory Lifecycle, Idempotency & Stock Invariants', { timeout: 300000 }, async (t) => {
  await db.initPromise;
  assert.equal(db.isConnected, true, 'Test database must be connected');
  assert.equal(db.sequelize.config.database, 'loulou_test', 'Must target loulou_test strictly');

  const prefix = crypto.randomUUID().slice(0, 8);
  let testProduct = null;
  let testCategory = null;
  let testDraft1 = null;

  try {
    testCategory = await db.category.create({
      name: `Cat_Life_${prefix}`,
      image: 'https://example.com/cat.jpg',
    });

    testProduct = await db.products.create({
      name: `Test Product Lifecycle ${prefix}`,
      description: 'Inventory Lifecycle Test Item',
      price: 200.00,
      stock: 0,
      physicalStock: 0,
      reservedStock: 0,
      unitCost: null,
      categoryId: testCategory.id,
      published: true,
      isArchived: false,
    });

    await t.test('1. Initial stock receipt sets physical stock, available stock, and initial unitCost', async () => {
      const res = await inventoryService.receiveStock({
        productId: testProduct.id,
        quantity: 10,
        unitCost: 100.00,
        notes: 'Initial test batch',
        idempotencyKey: `rcpt-init-${prefix}`,
      });

      assert.equal(Number(res.product.physicalStock), 10);
      assert.equal(Number(res.product.stock), 10);
      assert.equal(Number(res.product.reservedStock), 0);
      assert.equal(Number(res.product.unitCost), 100.00);

      const movement = await db.StockMovement.findOne({
        where: { productId: testProduct.id, movementType: 'receipt' },
      });
      assert.ok(movement);
      assert.equal(movement.quantity, 10);
      assert.equal(Number(movement.unitCost), 100.00);
      assert.equal(Number(movement.totalCost), 1000.00);
      assert.equal(movement.physicalBefore, 0);
      assert.equal(movement.physicalAfter, 10);
      assert.equal(movement.availableBefore, 0);
      assert.equal(movement.availableAfter, 10);
      assert.equal(movement.idempotencyKey, `rcpt-init-${prefix}`);
    });

    await t.test('2. Blocker 2: Receipt idempotency replays result and rejects conflicting payload', async () => {
      const replayed = await inventoryService.receiveStock({
        productId: testProduct.id,
        quantity: 10,
        unitCost: 100.00,
        notes: 'Initial test batch',
        idempotencyKey: `rcpt-init-${prefix}`,
      });

      assert.equal(replayed.replayed, true, 'Must indicate response was replayed');
      assert.equal(Number(replayed.product.physicalStock), 10, 'Must NOT double increment stock');

      const count = await db.StockMovement.count({
        where: { idempotencyKey: `rcpt-init-${prefix}` },
      });
      assert.equal(count, 1, 'Only 1 StockMovement record may exist for the idempotency key');

      await assert.rejects(
        () => inventoryService.receiveStock({
          productId: testProduct.id,
          quantity: 25,
          unitCost: 100.00,
          idempotencyKey: `rcpt-init-${prefix}`,
        }),
        (err) => err.statusCode === 409,
        'Conflicting payload with same idempotency key must reject with 409 Conflict'
      );
    });

    await t.test('3. Second stock receipt recalculates moving weighted-average cost (WAC) correctly', async () => {
      // 10 units @ 100 (total 1000) + 10 units @ 150 (total 1500) = 2500 / 20 units = 125.00
      const res = await inventoryService.receiveStock({
        productId: testProduct.id,
        quantity: 10,
        unitCost: 150.00,
        notes: 'Second test batch',
        idempotencyKey: `rcpt-sec-${prefix}`,
      });

      assert.equal(Number(res.product.physicalStock), 20);
      assert.equal(Number(res.product.stock), 20);
      assert.equal(Number(res.product.reservedStock), 0);
      assert.equal(Number(res.product.unitCost), 125.00);
    });

    await t.test('4. Order creation reserves stock: decreases availableStock, increases reservedStock, physicalStock untouched', async () => {
      testDraft1 = await orderService.createWhatsAppDraft({
        items: [{ productId: testProduct.id, quantity: 4 }],
        customerPhone: '970590000001',
        customerName: 'Integration Customer',
        location: 'Ramallah',
        idempotencyKey: `wa-test-${prefix}-1`,
      });

      assert.ok(testDraft1.id);
      const reloaded = await db.products.findByPk(testProduct.id);
      assert.equal(Number(reloaded.physicalStock), 20, 'Physical stock unchanged on order creation');
      assert.equal(Number(reloaded.reservedStock), 4, 'Reserved stock increased by 4');
      assert.equal(Number(reloaded.stock), 16, 'Available stock decreased by 4 (20 - 4)');

      const resMovement = await db.StockMovement.findOne({
        where: { orderId: testDraft1.id, movementType: 'reservation' },
      });
      assert.ok(resMovement);
      assert.equal(resMovement.quantity, -4);
      assert.equal(resMovement.physicalBefore, 20);
      assert.equal(resMovement.physicalAfter, 20);
      assert.equal(resMovement.availableBefore, 20);
      assert.equal(resMovement.availableAfter, 16);
    });

    await t.test('5. Blocker 7: Reject setting physical stock below active reservations', async () => {
      await assert.rejects(
        () => inventoryService.adjustStock({
          productId: testProduct.id,
          newPhysical: 3, // < 4 reserved
          reason: 'Invalid count lower than active reservation',
        }),
        (err) => err.statusCode === 400,
        'Cannot reduce physical stock below active reservations'
      );

      await assert.rejects(
        () => inventoryService.adjustStock({
          productId: testProduct.id,
          newPhysical: 22,
          expectedStock: 999, // wrong expectedStock
          reason: 'Stale expectation test',
        }),
        (err) => err.statusCode === 409,
        'Mismatched expectedStock must reject with 409 Conflict'
      );
    });

  } finally {
    if (testDraft1) {
      await db.StockMovement.destroy({ where: { orderId: testDraft1.id } }).catch(() => {});
      await db.order.destroy({ where: { id: testDraft1.id } }).catch(() => {});
    }
    if (testProduct) {
      await db.StockMovement.destroy({ where: { productId: testProduct.id } }).catch(() => {});
      await db.products.destroy({ where: { id: testProduct.id } }).catch(() => {});
    }
    if (testCategory) {
      await db.category.destroy({ where: { id: testCategory.id } }).catch(() => {});
    }
  }
});
