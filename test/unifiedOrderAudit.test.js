const assert = require('assert');
const ROLES_LIST = require('../config/roles_list');
const orderService = require('../services/orderService');
const verifyRoles = require('../middleware/verifyRoles');

console.log('====================================================');
console.log('   LOULOU BOUTIQAAT UNIFIED AUDIT TEST SUITE   ');
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
  // ---------------------------------------------------------------
  // 1. Role Normalization (Issue 1)
  // ---------------------------------------------------------------
  await test('Admin numeric role (5150) grants access in verifyRoles', async () => {
    let nextCalled = false;
    const req = { roles: 5150 };
    const res = { sendStatus: (code) => assert.fail(`Sent status ${code}`) };
    const next = () => { nextCalled = true; };
    const middleware = verifyRoles(ROLES_LIST.ADMIN, ROLES_LIST.EDITOR);
    middleware(req, res, next);
    assert.strictEqual(nextCalled, true);
  });

  await test('Editor numeric role (1984) grants access in verifyRoles', async () => {
    let nextCalled = false;
    const req = { roles: 1984 };
    const res = { sendStatus: (code) => assert.fail(`Sent status ${code}`) };
    const next = () => { nextCalled = true; };
    const middleware = verifyRoles(ROLES_LIST.ADMIN, ROLES_LIST.EDITOR);
    middleware(req, res, next);
    assert.strictEqual(nextCalled, true);
  });

  await test('User numeric role (2001) is strictly denied admin/editor access', async () => {
    let statusCode = null;
    let nextCalled = false;
    const req = { roles: 2001 };
    const res = { sendStatus: (code) => { statusCode = code; } };
    const next = () => { nextCalled = true; };
    const middleware = verifyRoles(ROLES_LIST.ADMIN, ROLES_LIST.EDITOR);
    middleware(req, res, next);
    assert.strictEqual(statusCode, 401);
    assert.strictEqual(nextCalled, false);
  });

  // ---------------------------------------------------------------
  // 2. Normalization & Aggregation (Issue 2 & Reviewer Audit)
  // ---------------------------------------------------------------
  await test('Aggregates duplicate product IDs in cart and rejects float/negative', async () => {
    const rawItems = [
      { productId: 1, quantity: 2 },
      { productId: 1, quantity: 3 },
      { productId: 2, quantity: 1 },
    ];
    const normalized = orderService.normalizeItems(rawItems);
    assert.strictEqual(normalized.length, 2);
    assert.strictEqual(normalized.find(i => i.productId === 1).quantity, 5);
    assert.strictEqual(normalized.find(i => i.productId === 2).quantity, 1);

    // Rejects floats
    assert.throws(() => {
      orderService.normalizeItems([{ productId: 1, quantity: 1.5 }]);
    }, /رقماً صحيحاً/);

    // Rejects negative
    assert.throws(() => {
      orderService.normalizeItems([{ productId: 1, quantity: -2 }]);
    }, /رقماً صحيحاً/);

    // Rejects zero
    assert.throws(() => {
      orderService.normalizeItems([{ productId: 1, quantity: 0 }]);
    }, /رقماً صحيحاً/);
  });

  // ---------------------------------------------------------------
  // 3. Idempotency Key Mismatch Detection (Issue 2)
  // ---------------------------------------------------------------
  await test('Reusing idempotency key with different items or quantities throws 409 conflict', async () => {
    const key = `test-idempotency-${Date.now()}`;
    const draft1 = await orderService.createWhatsAppDraft({
      items: [{ productId: 1, quantity: 1 }],
      customerName: 'فاحص تجريبي',
      customerPhone: '0599123456',
      location: 'غزة - شارع عمر المختار',
      idempotencyKey: key,
    });

    assert.ok(draft1.orderCode);

    // Try same key with matching items -> succeeds and returns existing order
    const draftReplay = await orderService.createWhatsAppDraft({
      items: [{ productId: 1, quantity: 1 }],
      customerName: 'فاحص تجريبي',
      customerPhone: '0599123456',
      location: 'غزة - شارع عمر المختار',
      idempotencyKey: key,
    });
    assert.strictEqual(draftReplay.orderCode, draft1.orderCode);

    // Try same key with DIFFERENT items/quantity -> MUST THROW 409 Conflict
    let conflictCaught = false;
    try {
      await orderService.createWhatsAppDraft({
        items: [{ productId: 1, quantity: 4 }], // changed quantity!
        customerName: 'فاحص تجريبي',
        customerPhone: '0599123456',
        location: 'غزة - شارع عمر المختار',
        idempotencyKey: key,
      });
    } catch (err) {
      if (err.statusCode === 409 || err.message.includes('Idempotency Key')) {
        conflictCaught = true;
      }
    }
    assert.strictEqual(conflictCaught, true, 'Should reject mismatched payload for same idempotency key');
  });

  // ---------------------------------------------------------------
  // 4. Timeout Validation Under Lock (Issue 3)
  // ---------------------------------------------------------------
  await test('Cannot confirm a WhatsApp draft whose expiresAt has passed', async () => {
    const draft = await orderService.createWhatsAppDraft({
      items: [{ productId: 1, quantity: 1 }],
      customerName: 'فاحص المهلة',
      customerPhone: '0599123456',
      location: 'غزة - الرمال',
    });

    // Manually backdate expiresAt to past
    const db = require('../models');
    if (db.isConnected) {
      await db.order.update(
        { expiresAt: new Date(Date.now() - 60000) },
        { where: { id: draft.id } }
      );
    } else {
      const mock = db.mockData.mockOrders.find(o => o.id === draft.id);
      if (mock) mock.expiresAt = new Date(Date.now() - 60000).toISOString();
    }

    // Attempting to confirm must fail!
    let rejected = false;
    try {
      await orderService.updateOrderStatus(draft.id, 'confirmed');
    } catch (err) {
      if (err.message.includes('انتهت صلاحية') || err.message.includes('60 دقيقة')) {
        rejected = true;
      }
    }
    assert.strictEqual(rejected, true, 'Expired draft must not be confirmed');

    // And target status 'expired' on a confirmed order must be strictly rejected
    const validDraft = await orderService.createWhatsAppDraft({
      items: [{ productId: 1, quantity: 1 }],
      customerName: 'فاحص التأكيد',
      customerPhone: '0599123456',
      location: 'غزة - النصر',
    });
    const confirmed = await orderService.updateOrderStatus(validDraft.id, 'confirmed');
    assert.strictEqual(confirmed.orderStatus, 'confirmed');

    // Trying to expire the confirmed order must be rejected
    const attemptExpire = await orderService.cancelOrExpireOrder(confirmed.id, 'expired');
    assert.strictEqual(attemptExpire.orderStatus, 'confirmed', 'Confirmed order cannot be expired');
  });

  // ---------------------------------------------------------------
  // 5. State Machine Terminal States (Issue 3)
  // ---------------------------------------------------------------
  await test('Delivered or cancelled orders cannot be re-confirmed', async () => {
    const draft = await orderService.createWhatsAppDraft({
      items: [{ productId: 1, quantity: 1 }],
      customerName: 'فاحص الحالات',
      customerPhone: '0599123456',
      location: 'غزة - تل الهوا',
    });
    await orderService.cancelOrExpireOrder(draft.id, 'cancelled');

    let errorCaught = false;
    try {
      await orderService.updateOrderStatus(draft.id, 'confirmed');
    } catch (e) {
      errorCaught = true;
    }
    assert.strictEqual(errorCaught, true);
  });

  console.log(`\n====================================================`);
  console.log(`   TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log(`====================================================\n`);

  process.exit(process.exitCode || 0);
})();
