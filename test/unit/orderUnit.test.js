const assert = require('assert');
const ROLES_LIST = require('../../config/roles_list');
const verifyRoles = require('../../middleware/verifyRoles');
const { normalizeItems, safeCompareTokens, isPayloadMatching } = require('../../services/orderService');

console.log('====================================================');
console.log('      LOULOU BOUTIQAAT - PURE UNIT TEST SUITE       ');
console.log('         (Zero DB Dependencies / Instant)           ');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

const test = (name, fn) => {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    -> ${err.message}`);
    process.exitCode = 1;
  }
};

// 1. Role Normalization (Issue 1)
test('Admin numeric role (5150) grants access in verifyRoles', () => {
  let nextCalled = false;
  const req = { roles: 5150 };
  const res = { sendStatus: (c) => assert.fail(`Sent status ${c}`) };
  const next = () => { nextCalled = true; };
  verifyRoles(ROLES_LIST.ADMIN, ROLES_LIST.EDITOR)(req, res, next);
  assert.strictEqual(nextCalled, true);
});

test('Editor numeric role (1984) grants access in verifyRoles', () => {
  let nextCalled = false;
  const req = { roles: 1984 };
  const res = { sendStatus: (c) => assert.fail(`Sent status ${c}`) };
  const next = () => { nextCalled = true; };
  verifyRoles(ROLES_LIST.ADMIN, ROLES_LIST.EDITOR)(req, res, next);
  assert.strictEqual(nextCalled, true);
});

test('User numeric role (2001) is denied access', () => {
  let statusCode = null;
  let nextCalled = false;
  const req = { roles: 2001 };
  const res = { sendStatus: (c) => { statusCode = c; } };
  const next = () => { nextCalled = true; };
  verifyRoles(ROLES_LIST.ADMIN, ROLES_LIST.EDITOR)(req, res, next);
  assert.strictEqual(statusCode, 401);
  assert.strictEqual(nextCalled, false);
});

test('Array, string, and object roles are properly normalized', () => {
  let nextCalled = 0;
  const res = { sendStatus: (c) => assert.fail(`Sent status ${c}`) };
  const next = () => { nextCalled++; };

  verifyRoles(ROLES_LIST.ADMIN)({ roles: [5150] }, res, next);
  verifyRoles(ROLES_LIST.ADMIN)({ roles: '5150' }, res, next);
  verifyRoles(ROLES_LIST.ADMIN)({ roles: { Admin: 5150 } }, res, next);

  assert.strictEqual(nextCalled, 3);
});

// 2. Normalization & Aggregation of Cart Items
test('normalizeItems sums duplicate products and validates positive integers', () => {
  const rawItems = [
    { productId: 10, quantity: 2 },
    { productId: 10, quantity: 3 },
    { productId: 20, quantity: 1 },
  ];
  const normalized = normalizeItems(rawItems);
  assert.strictEqual(normalized.length, 2);
  assert.strictEqual(normalized.find(i => i.productId === 10).quantity, 5);
  assert.strictEqual(normalized.find(i => i.productId === 20).quantity, 1);

  assert.throws(() => normalizeItems([{ productId: 1, quantity: 1.5 }]), /رقماً صحيحاً/);
  assert.throws(() => normalizeItems([{ productId: 1, quantity: -2 }]), /رقماً صحيحاً/);
  assert.throws(() => normalizeItems([{ productId: 1, quantity: 0 }]), /رقماً صحيحاً/);
  assert.throws(() => normalizeItems([]), /فارغة/);
});

// 3. Constant-Time Token Comparison
test('safeCompareTokens handles valid, invalid, and null tokens securely', () => {
  assert.strictEqual(safeCompareTokens('secret1234567890', 'secret1234567890'), true);
  assert.strictEqual(safeCompareTokens('secret1234567890', 'secret1234567899'), false);
  assert.strictEqual(safeCompareTokens('secret1234567890', 'short'), false);
  assert.strictEqual(safeCompareTokens(null, 'secret1234567890'), false);
  assert.strictEqual(safeCompareTokens('secret1234567890', undefined), false);
});

// 4. Payload Matching for Idempotency
test('isPayloadMatching compares order items, quantities, and customer phone', () => {
  const existingOrder = {
    orders: JSON.stringify([{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }]),
    customerPhone: '0599123456',
  };

  const matchingItems = [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }];
  const differentQty = [{ productId: 1, quantity: 4 }, { productId: 2, quantity: 1 }];
  const differentItem = [{ productId: 3, quantity: 2 }, { productId: 2, quantity: 1 }];

  assert.strictEqual(isPayloadMatching(existingOrder, matchingItems, '0599123456'), true);
  assert.strictEqual(isPayloadMatching(existingOrder, matchingItems, '+970599123456'), true); // phone normalized
  assert.strictEqual(isPayloadMatching(existingOrder, differentQty, '0599123456'), false);
  assert.strictEqual(isPayloadMatching(existingOrder, differentItem, '0599123456'), false);
  assert.strictEqual(isPayloadMatching(existingOrder, matchingItems, '0569999999'), false); // different phone
});

console.log(`\n====================================================`);
console.log(`   UNIT TESTS SUMMARY: ${passedTests}/${totalTests} PASSED`);
console.log(`====================================================\n`);

process.exit(process.exitCode || 0);
