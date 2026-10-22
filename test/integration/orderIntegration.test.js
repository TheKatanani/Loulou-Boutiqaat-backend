const assert = require('assert');
require('dotenv').config();

// Ensure test environment uses the isolated loulou_test database (Fail-closed)
process.env.NODE_ENV = 'test';

if (!process.env.TEST_DATABASE_URL) {
  console.error('[CRITICAL SAFETY ABORT] TEST_DATABASE_URL is not set!');
  console.error('Please configure TEST_DATABASE_URL in your .env or CI environment pointing to `loulou_test`.');
  process.exit(1);
}

// Strictly verify the database name in TEST_DATABASE_URL is 'loulou_test' BEFORE requiring models
let targetDb = '';
try {
  const parsed = new URL(process.env.TEST_DATABASE_URL);
  targetDb = parsed.pathname.replace(/^\//, '').split('?')[0];
} catch (e) {
  const match = process.env.TEST_DATABASE_URL.match(/\/([^/?]+)(?:\?|$)/);
  if (match) targetDb = match[1];
}

if (targetDb !== 'loulou_test') {
  console.error(`[CRITICAL SAFETY ABORT] Refusing to run tests against database "${targetDb}"!`);
  console.error('Target database must be strictly "loulou_test". Execution terminated immediately before connection/sync.');
  process.exit(1);
}

// Safe to load models and controllers now
const db = require('../../models');
const orderService = require('../../services/orderService');
const productController = require('../../controllers/productCotroller');
const orderController = require('../../controllers/orderController');

console.log('====================================================');
console.log('    LOULOU BOUTIQAAT - REAL DB INTEGRATION SUITE    ');
console.log('      (Target: Isolated TiDB `loulou_test`)         ');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

const test = async (name, fn) => {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    -> ${err.message}`);
    process.exitCode = 1;
  }
};

(async () => {
  // Wait for database connection and schema sync
  await db.initPromise;

  // Strict verification that we are NOT running on production 'test' or any other DB!
  const currentDb = db.sequelize.config.database;
  console.log(`[Integration Test] Connected to isolated test DB: \`${currentDb}\``);
  assert.strictEqual(currentDb, 'loulou_test', 'CRITICAL SAFETY CHECK: Integration tests must target `loulou_test`!');

  // Cleanup isolated test database before starting
  await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
  await db.order.destroy({ where: {} });
  await db.products.destroy({ where: {} });
  await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');

  // Seed test user
  await db.users.findOrCreate({
    where: { id: 88 },
    defaults: { name: 'المشتري الثاني', password: 'hash' },
  });

  // Seed test category
  const [cat] = await db.category.findOrCreate({
    where: { id: 1 },
    defaults: { name: 'عطور شرقية', published: true }
  });

  // Seed test products
  await db.products.create({
    id: 101,
    name: 'عطر رويال عود (آخر قطعة)',
    price: 120,
    stock: 1,
    published: true,
    categoryId: cat.id,
  });

  await db.products.create({
    id: 102,
    name: 'مسك الختام الفاخر',
    price: 50,
    stock: 10,
    published: true,
    categoryId: cat.id,
  });

  await db.products.create({
    id: 103,
    name: 'منتج غير منشور',
    price: 90,
    stock: 5,
    published: false,
    categoryId: cat.id,
  });

  await db.products.create({
    id: 104,
    name: 'عود الخيال المتزامن',
    price: 80,
    stock: 5,
    published: true,
    categoryId: cat.id,
  });

  // --------------------------------------------------------------------------
  // TEST 1: Concurrent Race for the Last Available Item (Stock = 1)
  // --------------------------------------------------------------------------
  await test('Last piece concurrency: 2 simultaneous orders compete, exactly 1 wins, stock ends at 0', async () => {
    const orderA = orderService.createWhatsAppDraft({
      items: [{ productId: 101, quantity: 1 }],
      customerName: 'المشتري الأول (واتساب)',
      customerPhone: '0599111111',
      location: 'غزة - الرمال',
      idempotencyKey: `wa-race-${Date.now()}`,
    });

    const orderB = orderService.createWebOrder({
      userId: 88,
      items: [{ productId: 101, quantity: 1 }],
      customerName: 'المشتري الثاني (الموقع)',
      customerPhone: '0599222222',
      location: 'غزة - النصر',
      idempotencyKey: `web-race-${Date.now()}`,
    });

    const results = await Promise.allSettled([orderA, orderB]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactly one order must succeed for the last piece');
    assert.strictEqual(rejected.length, 1, 'The other concurrent order must be rejected');
    assert.ok(
      rejected[0].reason.name === 'InsufficientStockError' ||
      rejected[0].reason.message.includes('غير متوفرة') ||
      rejected[0].reason.message.includes('conflict') ||
      rejected[0].reason.message.includes('Deadlock') ||
      rejected[0].reason.name === 'SequelizeDatabaseError',
      `Rejection must be due to InsufficientStockError or TiDB write conflict (got: ${rejected[0].reason.message})`
    );

    // Verify product stock in DB is exactly 0 (never negative)
    const refreshed = await db.products.findByPk(101);
    assert.strictEqual(refreshed.stock, 0, 'Stock must be exactly 0 after last piece sold');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Idempotency Key Replay & Mismatch Rejection
  // --------------------------------------------------------------------------
  await test('Idempotency key reuse returns same order without double deduction; mismatched payload throws 409', async () => {
    const key = `idempotency-test-${Date.now()}`;
    const initialP2Stock = (await db.products.findByPk(102)).stock;

    // 1. Initial attempt: reserve 2 pieces
    const firstAttempt = await orderService.createWhatsAppDraft({
      items: [{ productId: 102, quantity: 2 }],
      customerName: 'عميل الإعادة',
      customerPhone: '0599333333',
      location: 'غزة - تل الهوا',
      idempotencyKey: key,
    });
    assert.ok(firstAttempt.orderCode);

    const stockAfterFirst = (await db.products.findByPk(102)).stock;
    assert.strictEqual(stockAfterFirst, initialP2Stock - 2, 'Stock must decrease by 2');

    // 2. Retry identical payload with same key (simulating network drop)
    const retryAttempt = await orderService.createWhatsAppDraft({
      items: [{ productId: 102, quantity: 2 }],
      customerName: 'عميل الإعادة',
      customerPhone: '0599333333',
      location: 'غزة - تل الهوا',
      idempotencyKey: key,
    });
    assert.strictEqual(retryAttempt.orderCode, firstAttempt.orderCode, 'Must return same order code');
    assert.strictEqual(retryAttempt.idempotent, true);

    const stockAfterRetry = (await db.products.findByPk(102)).stock;
    assert.strictEqual(stockAfterRetry, stockAfterFirst, 'Stock must NOT be deducted twice on idempotent replay');

    // 3. Replay with DIFFERENT quantity -> must reject with 409 Conflict
    let conflictThrown = false;
    try {
      await orderService.createWhatsAppDraft({
        items: [{ productId: 102, quantity: 5 }], // changed from 2 to 5!
        customerName: 'عميل الإعادة',
        customerPhone: '0599333333',
        location: 'غزة - تل الهوا',
        idempotencyKey: key,
      });
    } catch (e) {
      if (e.statusCode === 409 || e.message.includes('Idempotency Key')) {
        conflictThrown = true;
      }
    }
    assert.strictEqual(conflictThrown, true, 'Mismatched idempotency payload must be rejected with 409');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Late Draft Confirmation Transaction Rollback Fix
  // --------------------------------------------------------------------------
  await test('Late draft confirmation: commits expiration & restores stock in DB before returning 409', async () => {
    // Reserve 2 pieces
    const draft = await orderService.createWhatsAppDraft({
      items: [{ productId: 102, quantity: 2 }],
      customerName: 'عميل متأخر',
      customerPhone: '0599444444',
      location: 'غزة - الشجاعية',
    });

    const stockDuringDraft = (await db.products.findByPk(102)).stock;

    // Backdate expiresAt to 10 minutes ago in DB
    await db.order.update(
      { expiresAt: new Date(Date.now() - 10 * 60 * 1000) },
      { where: { id: draft.id } }
    );

    // Admin attempts to confirm expired draft
    let errorCaught = false;
    try {
      await orderService.updateOrderStatus(draft.id, 'confirmed');
    } catch (err) {
      if (err.statusCode === 409 || err.message.includes('انتهت صلاحية')) {
        errorCaught = true;
      }
    }
    assert.strictEqual(errorCaught, true, 'Must reject confirmation of expired reservation');

    // CRITICAL FIX CHECK: Did the transaction commit the 'expired' status and restore stock in DB?
    const dbOrder = await db.order.findByPk(draft.id);
    assert.strictEqual(dbOrder.orderStatus, 'expired', 'Order status must be permanently saved as `expired` in DB');
    assert.strictEqual(dbOrder.inventoryTracked, false, 'inventoryTracked must be false');

    const stockAfterExpired = (await db.products.findByPk(102)).stock;
    assert.strictEqual(
      stockAfterExpired,
      stockDuringDraft + 2,
      'Stock must be restored to product in DB (NOT rolled back!)'
    );
  });

  // --------------------------------------------------------------------------
  // TEST 4: General Product Update Does NOT Overwrite Stale Stock
  // --------------------------------------------------------------------------
  await test('General product update (price, description) never overwrites live stock', async () => {
    const currentStock = (await db.products.findByPk(102)).stock;

    // Simulate admin editing product general info, sending stale stock (e.g. 99) in req.body
    const req = {
      params: { id: 102 },
      body: {
        name: 'مسك الختام الفاخر - إصدار جديد',
        price: 65,
        stock: 99, // Stale stock from outdated form!
      },
    };

    let responseData = null;
    const res = {
      json: (data) => { responseData = data; },
      status: (code) => ({ json: (d) => { responseData = d; } }),
    };

    await productController.updateProduct(req, res);

    const refreshedProd = await db.products.findByPk(102);
    assert.strictEqual(refreshedProd.price, 65, 'Price should update');
    assert.strictEqual(refreshedProd.name, 'مسك الختام الفاخر - إصدار جديد', 'Name should update');
    assert.strictEqual(refreshedProd.stock, currentStock, 'Live stock must NOT be overwritten by stale form value!');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Stock Adjustment Atomicity, Concurrency & Interleaving Protection
  // --------------------------------------------------------------------------
  await test('Interleaving order purchase rejects stale absolute update with 409 without overwriting customer reservation', async () => {
    // 1. Initial product stock is recorded
    const initialStock = (await db.products.findByPk(102)).stock;
    const observedExpectedStock = initialStock;

    // 2. An order purchase arrives in the meantime, deducting 1 piece
    await orderService.createWhatsAppDraft({
      items: [{ productId: 102, quantity: 1 }],
      customerName: 'مشتري متزامن',
      customerPhone: '0599555555',
      location: 'غزة',
    });

    const stockAfterPurchase = (await db.products.findByPk(102)).stock;
    assert.strictEqual(stockAfterPurchase, initialStock - 1, 'Stock must decrease by 1 from customer reservation');

    // 3. Admin submits absolute update based on observedExpectedStock (now stale!)
    let statusCode = null;
    let responseBody = null;
    const req = {
      params: { id: 102 },
      body: { stock: initialStock + 5, expectedStock: observedExpectedStock },
    };
    const res = {
      status: (c) => {
        statusCode = c;
        return { json: (d) => { responseBody = d; } };
      },
      json: (d) => { responseBody = d; },
    };

    await productController.updateProductStock(req, res);

    assert.strictEqual(statusCode, 409, 'Must return 409 Conflict when expectedStock is stale');
    assert.strictEqual(responseBody.currentStock, stockAfterPurchase, 'Must report the fresh live stock in 409 payload');

    // 4. Verify live stock in DB remains intact (reservation NOT overwritten!)
    const stockAfterRejectedAdmin = (await db.products.findByPk(102)).stock;
    assert.strictEqual(stockAfterRejectedAdmin, stockAfterPurchase, 'Customer reservation must not be overwritten');
  });

  await test('Two concurrent delta=+1 stock adjustments increase quantity by exactly +2 (atomic locking)', async () => {
    const initialStock = (await db.products.findByPk(104)).stock; // Starts at 5

    const makeDeltaReq = () => {
      let code = 200;
      let body = null;
      const req = { params: { id: 104 }, body: { delta: 1 } };
      const res = {
        status: (c) => { code = c; return { json: (d) => { body = d; } }; },
        json: (d) => { body = d; },
      };
      return productController.updateProductStock(req, res).then(() => ({ code, body }));
    };

    const results = await Promise.all([makeDeltaReq(), makeDeltaReq()]);
    assert.strictEqual(results[0].code, 200);
    assert.strictEqual(results[1].code, 200);

    const refreshed = await db.products.findByPk(104);
    assert.strictEqual(refreshed.stock, initialStock + 2, 'Two simultaneous delta=+1 must result in exactly +2 stock');
  });

  await test('Delta rejecting negative stock and strict integer validation', async () => {
    // 1. Negative stock rejection
    let statusCode = null;
    const reqNegative = { params: { id: 104 }, body: { delta: -999 } };
    const resNegative = {
      status: (c) => { statusCode = c; return { json: () => {} }; },
      json: () => {},
    };
    await productController.updateProductStock(reqNegative, resNegative);
    assert.strictEqual(statusCode, 400, 'Must return 400 when delta would cause negative stock');

    // 2. Fractional/invalid integer rejection
    let floatStatusCode = null;
    const reqFloat = { params: { id: 104 }, body: { stock: 12.5, expectedStock: 7 } };
    const resFloat = {
      status: (c) => { floatStatusCode = c; return { json: () => {} }; },
      json: () => {},
    };
    await productController.updateProductStock(reqFloat, resFloat);
    assert.strictEqual(floatStatusCode, 400, 'Must return 400 for float stock');

    // 3. String with trailing characters rejection
    let strStatusCode = null;
    const reqStr = { params: { id: 104 }, body: { delta: "2abc" } };
    const resStr = {
      status: (c) => { strStatusCode = c; return { json: () => {} }; },
      json: () => {},
    };
    await productController.updateProductStock(reqStr, resStr);
    assert.strictEqual(strStatusCode, 400, 'Must return 400 for invalid non-integer string');
  });

  // --------------------------------------------------------------------------
  // TEST 6: HTTP Controller Passes 409 Conflict for Late Confirmation
  // --------------------------------------------------------------------------
  await test('HTTP order controller returns status 409 (not 400) on confirmation of expired draft', async () => {
    // 1. Create a draft order
    const draft = await orderService.createWhatsAppDraft({
      items: [{ productId: 104, quantity: 1 }],
      customerName: 'عميل متأخر HTTP',
      customerPhone: '0599666666',
      location: 'غزة',
    });

    // 2. Backdate expiresAt to 15 minutes ago
    await db.order.update(
      { expiresAt: new Date(Date.now() - 15 * 60 * 1000) },
      { where: { id: draft.id } }
    );

    // 3. Admin attempts to confirm via HTTP controller
    let httpStatusCode = null;
    let httpResponseBody = null;
    const req = {
      params: { id: draft.id },
      body: { orderStatus: 'confirmed' },
    };
    const res = {
      status: (code) => {
        httpStatusCode = code;
        return {
          json: (body) => { httpResponseBody = body; },
        };
      },
      json: (body) => { httpResponseBody = body; },
    };

    await orderController.adminUpdateStatusHandler(req, res);

    assert.strictEqual(httpStatusCode, 409, `HTTP controller must return 409 Conflict (got: ${httpStatusCode})`);
    assert.ok(httpResponseBody.message.includes('انتهت صلاحية'), 'Error message must explain expiration');
    assert.ok(httpResponseBody.order, 'Must return sanitized expired order');
    assert.strictEqual(httpResponseBody.order.orderStatus, 'expired');
  });

  // Teardown
  await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
  await db.order.destroy({ where: {} });
  await db.products.destroy({ where: {} });
  await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');

  console.log(`\n====================================================`);
  console.log(`   INTEGRATION TESTS: ${passedTests}/${totalTests} PASSED`);
  console.log(`====================================================\n`);

  process.exit(process.exitCode || 0);
})();
