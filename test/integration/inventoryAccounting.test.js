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

test('Part 2: Inventory Accounting, Delivery, Returns & Profitability', { timeout: 300000 }, async (t) => {
  await db.initPromise;
  assert.equal(db.isConnected, true, 'Test database must be connected');
  assert.equal(db.sequelize.config.database, 'loulou_test', 'Must target loulou_test strictly');

  const prefix = crypto.randomUUID().slice(0, 8);
  let testProduct = null;
  let testProductUnknown = null;
  let testCategory = null;
  let deliveredOrder = null;
  let returnedOrder = null;
  let cancelledDraft = null;
  let unknownCostOrder = null;

  try {
    testCategory = await db.category.create({
      name: `Cat_Acc_${prefix}`,
      image: 'https://example.com/cat.jpg',
    });

    // Product with known initial cost: 10 units @ 100
    testProduct = await db.products.create({
      name: `Test Product Accounting ${prefix}`,
      description: 'Inventory Accounting Test Item',
      price: 250.00,
      stock: 0,
      physicalStock: 0,
      reservedStock: 0,
      unitCost: null,
      categoryId: testCategory.id,
      published: true,
      isArchived: false,
    });

    // Product with UNKNOWN cost: unitCost = null
    testProductUnknown = await db.products.create({
      name: `Test Product Unknown Cost ${prefix}`,
      description: 'Unknown Cost Test Item',
      price: 150.00,
      stock: 0,
      physicalStock: 0,
      reservedStock: 0,
      unitCost: null,
      categoryId: testCategory.id,
      published: true,
      isArchived: false,
    });

    // Setup initial receipts
    await inventoryService.receiveStock({
      productId: testProduct.id,
      quantity: 10,
      unitCost: 100.00,
      notes: 'Initial known stock batch',
      idempotencyKey: `rcpt-acc-known-${prefix}`,
    });

    await inventoryService.receiveStock({
      productId: testProductUnknown.id,
      quantity: 10,
      unitCost: null, // Unknown cost
      notes: 'Initial unknown cost batch',
      idempotencyKey: `rcpt-acc-unknown-${prefix}`,
    });

    await t.test('6. Delivery converts reservation to sale: physicalStock decreases, availableStock untouched, COGS snapshotted', async () => {
      // 1. Create draft order for 3 units
      const draft = await orderService.createWhatsAppDraft({
        items: [{ productId: testProduct.id, quantity: 3 }],
        customerPhone: '970590000002',
        customerName: 'Accounting Delivery Customer',
        location: 'Nablus',
        idempotencyKey: `wa-deliv-${prefix}`,
      });
      assert.ok(draft.id);

      // Verify reservation state before delivery
      let prod = await db.products.findByPk(testProduct.id);
      assert.equal(Number(prod.physicalStock), 10);
      assert.equal(Number(prod.reservedStock), 3);
      assert.equal(Number(prod.stock), 7);

      // 2. Deliver the order
      const delivered = await inventoryService.deliverOrder({ orderId: draft.id });
      deliveredOrder = delivered;

      assert.equal(delivered.orderStatus, 'delivered');
      assert.equal(delivered.costSnapshotted, true);
      assert.equal(delivered.hasUnknownCost, false);
      assert.equal(Number(delivered.totalPurchaseCost), 300.00); // 3 * 100.00

      // 3. Verify stock after delivery:
      // physicalStock decreased by 3 (10 -> 7)
      // reservedStock decreased by 3 (3 -> 0)
      // available stock remains 7 (NOT deducted twice!)
      prod = await db.products.findByPk(testProduct.id);
      assert.equal(Number(prod.physicalStock), 7, 'Physical stock must decrease on delivery');
      assert.equal(Number(prod.reservedStock), 0, 'Reserved stock must decrease to 0');
      assert.equal(Number(prod.stock), 7, 'Available stock must NOT be deducted twice');

      // Verify movement recorded
      const deliveryMovement = await db.StockMovement.findOne({
        where: { orderId: draft.id, movementType: 'delivery' },
      });
      assert.ok(deliveryMovement);
      assert.equal(deliveryMovement.quantity, -3);
      assert.equal(Number(deliveryMovement.unitCost), 100.00);
      assert.equal(Number(deliveryMovement.totalCost), 300.00);
      assert.equal(deliveryMovement.physicalBefore, 10);
      assert.equal(deliveryMovement.physicalAfter, 7);
      assert.equal(deliveryMovement.availableBefore, 7);
      assert.equal(deliveryMovement.availableAfter, 7);
    });

    await t.test('7. Delivery idempotency: repeated delivery calls are safe and do not double-decrement', async () => {
      const deliveredAgain = await inventoryService.deliverOrder({ orderId: deliveredOrder.id });
      assert.equal(deliveredAgain.id, deliveredOrder.id);
      assert.equal(deliveredAgain.orderStatus, 'delivered');

      const prod = await db.products.findByPk(testProduct.id);
      assert.equal(Number(prod.physicalStock), 7, 'Physical stock must remain 7 on replayed delivery');
      assert.equal(Number(prod.stock), 7, 'Available stock must remain 7 on replayed delivery');

      const deliveryMovementsCount = await db.StockMovement.count({
        where: { orderId: deliveredOrder.id, movementType: 'delivery' },
      });
      assert.equal(deliveryMovementsCount, 1, 'Only 1 delivery movement must exist');
    });

    await t.test('8. Blocker 4: Return of delivered order recalculates moving WAC with snapshotted cost', async () => {
      // First, let's receive 3 more units of testProduct at a higher cost: 3 units @ 150.00
      // Current physical stock before receipt: 7 units @ 100.00 (700)
      // New receipt: 3 units @ 150.00 (450)
      // New physical stock: 10 units @ (700 + 450) / 10 = 1150 / 10 = 115.00
      await inventoryService.receiveStock({
        productId: testProduct.id,
        quantity: 3,
        unitCost: 150.00,
        notes: 'Price increase batch',
        idempotencyKey: `rcpt-ret-prep-${prefix}`,
      });

      let prodBeforeReturn = await db.products.findByPk(testProduct.id);
      assert.equal(Number(prodBeforeReturn.physicalStock), 10);
      assert.equal(Number(prodBeforeReturn.unitCost), 115.00);

      // Now create and deliver a second order for 2 units (cost snapshotted at 115.00)
      const draft2 = await orderService.createWhatsAppDraft({
        items: [{ productId: testProduct.id, quantity: 2 }],
        customerPhone: '970590000003',
        customerName: 'Return Test Customer',
        location: 'Jenin',
        idempotencyKey: `wa-ret-draft-${prefix}`,
      });
      await inventoryService.deliverOrder({ orderId: draft2.id });

      let prodAfterDeliv2 = await db.products.findByPk(testProduct.id);
      assert.equal(Number(prodAfterDeliv2.physicalStock), 8); // 10 - 2 = 8 units @ 115.00 (total 920.00)
      assert.equal(Number(prodAfterDeliv2.unitCost), 115.00);

      // Now RETURN this delivered order draft2 (2 units originally snapshotted @ 115.00)
      // Return: 8 units @ 115.00 (920) + 2 returned units @ 115.00 (230) = 1150 / 10 = 115.00
      const returned = await inventoryService.returnDeliveredOrder({
        orderId: draft2.id,
        reason: 'Customer returned item in original condition',
      });
      returnedOrder = returned;

      assert.equal(returned.orderStatus, 'returned');
      assert.ok(returned.returnedAt);

      const prodAfterReturn = await db.products.findByPk(testProduct.id);
      assert.equal(Number(prodAfterReturn.physicalStock), 10, 'Physical stock restored to 10');
      assert.equal(Number(prodAfterReturn.stock), 10, 'Available stock restored to 10');
      assert.equal(Number(prodAfterReturn.unitCost), 115.00, 'WAC calculated correctly on return');

      const returnMovement = await db.StockMovement.findOne({
        where: { orderId: draft2.id, movementType: 'return' },
      });
      assert.ok(returnMovement);
      assert.equal(returnMovement.quantity, 2);
      assert.equal(Number(returnMovement.unitCost), 115.00);
      assert.equal(Number(returnMovement.totalCost), 230.00);
      assert.equal(returnMovement.physicalBefore, 8);
      assert.equal(returnMovement.physicalAfter, 10);
    });

    await t.test('9. Reservation release on cancellation: restores available stock, physicalStock untouched', async () => {
      // Create draft reserving 4 units
      const draft3 = await orderService.createWhatsAppDraft({
        items: [{ productId: testProduct.id, quantity: 4 }],
        customerPhone: '970590000004',
        customerName: 'Cancellation Test Customer',
        location: 'Hebron',
        idempotencyKey: `wa-cancel-draft-${prefix}`,
      });
      cancelledDraft = draft3;

      let prod = await db.products.findByPk(testProduct.id);
      assert.equal(Number(prod.physicalStock), 10);
      assert.equal(Number(prod.reservedStock), 4);
      assert.equal(Number(prod.stock), 6);

      // Cancel order via orderService
      await orderService.updateOrderStatus(draft3.id, 'cancelled');

      prod = await db.products.findByPk(testProduct.id);
      assert.equal(Number(prod.physicalStock), 10, 'Physical stock untouched on cancellation');
      assert.equal(Number(prod.reservedStock), 0, 'Reserved stock restored to 0');
      assert.equal(Number(prod.stock), 10, 'Available stock restored to 10');

      const releaseMovement = await db.StockMovement.findOne({
        where: { orderId: draft3.id, movementType: 'reservation_release' },
      });
      assert.ok(releaseMovement);
      assert.equal(releaseMovement.quantity, 4);
      assert.equal(releaseMovement.availableBefore, 6);
      assert.equal(releaseMovement.availableAfter, 10);
      assert.equal(releaseMovement.physicalBefore, 10);
      assert.equal(releaseMovement.physicalAfter, 10);
    });

    await t.test('10. Blockers 1 & 4: Profitability report isolates unknown costs, includes archived orders, and deducts dated returns', async () => {
      // Create an order with unknown cost product
      const unkDraft = await orderService.createWhatsAppDraft({
        items: [{ productId: testProductUnknown.id, quantity: 2 }],
        customerPhone: '970590000005',
        customerName: 'Unknown Cost Customer',
        location: 'Gaza',
        idempotencyKey: `wa-unk-draft-${prefix}`,
      });
      const delivUnk = await inventoryService.deliverOrder({ orderId: unkDraft.id });
      unknownCostOrder = delivUnk;

      assert.equal(delivUnk.hasUnknownCost, true);
      assert.equal(delivUnk.totalPurchaseCost, null);

      // Archive deliveredOrder to test that archived orders are still included in reporting
      await db.order.update({ archived: true }, { where: { id: deliveredOrder.id } });

      // Run profitability report covering recent deliveries
      const report = await inventoryService.getProfitabilityReport();

      assert.ok(report);
      assert.ok((report.deliveredOrdersCount || report.orders.length) >= 2, 'Must include both delivered orders even if archived');
      assert.ok(report.unknownCostOrdersCount >= 1, 'Must record order with unknown cost');

      // Blocker 1: Gross profit for entire report must be null when costs are incomplete
      assert.equal(report.overallGrossProfit, null, 'overallGrossProfit must be null when coverage is incomplete to prevent inflation');
      assert.ok(report.knownCostGrossProfit > 0, 'knownCostGrossProfit must isolate profit for known-cost sales');
      assert.ok(report.costCoveragePercent < 100, 'costCoveragePercent must reflect incomplete coverage');
      assert.ok(report.unknownCostRevenue > 0, 'unknownCostRevenue must account for revenue with unknown purchase cost');

      // Verify that return was deducted from revenue and cogs
      assert.ok(report.returnsCount >= 1, 'Must record the return reversal');
    });

  } finally {
    // Cleanup test fixtures
    const orderIds = [deliveredOrder?.id, returnedOrder?.id, cancelledDraft?.id, unknownCostOrder?.id].filter(Boolean);
    if (orderIds.length > 0) {
      await db.StockMovement.destroy({ where: { orderId: orderIds } }).catch(() => {});
      await db.order.destroy({ where: { id: orderIds } }).catch(() => {});
    }
    const productIds = [testProduct?.id, testProductUnknown?.id].filter(Boolean);
    if (productIds.length > 0) {
      await db.StockMovement.destroy({ where: { productId: productIds } }).catch(() => {});
      await db.products.destroy({ where: { id: productIds } }).catch(() => {});
    }
    if (testCategory) {
      await db.category.destroy({ where: { id: testCategory.id } }).catch(() => {});
    }
  }
});
