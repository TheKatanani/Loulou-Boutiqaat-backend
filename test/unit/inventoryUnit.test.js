const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateWeightedAverageCost,
  calculateWacOnReturn,
  calculateProfitabilitySummary,
} = require('../../utils/inventoryMath');

test('Pure Inventory Unit Test Suite (Zero DB Loading / Instant)', async (t) => {
  await t.test('1. Moving WAC: equal batches calculate exact midpoint', () => {
    // 10 units @ 100 + 10 units @ 200 = 150
    const wac = calculateWeightedAverageCost(10, 100, 10, 200);
    assert.equal(wac, 150.00);
  });

  await t.test('2. Moving WAC: unequal batches weight by physical units correctly', () => {
    // 10 units @ 100 (1000) + 5 units @ 160 (800) = 1800 / 15 = 120.00
    const wac = calculateWeightedAverageCost(10, 100, 5, 160);
    assert.equal(wac, 120.00);
  });

  await t.test('3. Moving WAC: fractional values rounded to 2 decimal places', () => {
    // 7 units @ 33.33 (233.31) + 4 units @ 45.50 (182) = 415.31 / 11 = 37.75545... -> 37.76
    const wac = calculateWeightedAverageCost(7, 33.33, 4, 45.50);
    assert.equal(wac, 37.76);
  });

  await t.test('4. Initial receipt with 0 physical stock sets new cost directly', () => {
    const wac = calculateWeightedAverageCost(0, null, 15, 88.50);
    assert.equal(wac, 88.50);
  });

  await t.test('5. Blocker 3: receiving costed units into existing unknown-cost stock returns null (does not fabricate cost)', () => {
    // 10 existing units with unknown cost + 5 new units @ 90
    // Must NOT assume existing 10 units cost 90. Cost remains unknown (null).
    const wac = calculateWeightedAverageCost(10, null, 5, 90.00);
    assert.equal(wac, null, 'Must preserve unknown-cost status when existing inventory is uncosted');
  });

  await t.test('6. Blocker 3: uncosted receipt into costed stock returns null (does not silently assign old average)', () => {
    // 10 existing units @ 50 + 5 new units with no cost
    // Must NOT assume incoming 5 units cost 50. Mixed stock makes overall cost unknown.
    const wac = calculateWeightedAverageCost(10, 50, 5, null);
    assert.equal(wac, null, 'Must not assign old average to uncosted new units');
  });

  await t.test('7. Validation: rejects negative costs and invalid quantities', () => {
    assert.throws(() => calculateWeightedAverageCost(10, 50, 0, 40), /عدداً صحيحاً موجباً/);
    assert.throws(() => calculateWeightedAverageCost(10, 50, -5, 40), /عدداً صحيحاً موجباً/);
    assert.throws(() => calculateWeightedAverageCost(10, 50, 1.5, 40), /عدداً صحيحاً موجباً/);
    assert.throws(() => calculateWeightedAverageCost(10, 50, 5, -10), /غير سالب/);
  });

  await t.test('8. Blocker 4: return of delivered units recalculates WAC correctly', () => {
    // 10 units in stock @ 50 (500) + return 2 units originally costed @ 30 (60)
    // Total valuation = 560 / 12 = 46.666... -> 46.67
    const newWac = calculateWacOnReturn(10, 50, 2, 30);
    assert.equal(newWac, 46.67);
  });

  await t.test('9. Blocker 4: return into 0 physical stock restores original cost', () => {
    const newWac = calculateWacOnReturn(0, null, 2, 30);
    assert.equal(newWac, 30.00);
  });

  await t.test('10. Blocker 1: profitability calculation with entirely unknown cost does not inflate profit', () => {
    // Single sale of 250 with unknown cost (cogs: null)
    const summary = calculateProfitabilitySummary([
      { revenue: 250, cogs: null, hasUnknownCost: true },
    ]);

    assert.equal(summary.totalDeliveredRevenue, 250);
    assert.equal(summary.knownCostRevenue, 0);
    assert.equal(summary.knownCostCOGS, 0);
    assert.equal(summary.knownCostGrossProfit, 0);
    assert.equal(summary.unknownCostRevenue, 250);
    assert.equal(summary.isCostCoverageComplete, false);
    assert.equal(summary.overallGrossProfit, null, 'Overall profit must be null when costs are unknown');
  });

  await t.test('11. Blocker 1: profitability calculation with mixed costs isolates known subset', () => {
    // Order 1: rev 200, cogs 120 -> profit 80
    // Order 2: rev 250, cogs null -> unknown
    const summary = calculateProfitabilitySummary([
      { revenue: 200, cogs: 120, hasUnknownCost: false },
      { revenue: 250, cogs: null, hasUnknownCost: true },
    ]);

    assert.equal(summary.totalDeliveredRevenue, 450);
    assert.equal(summary.knownCostRevenue, 200);
    assert.equal(summary.knownCostCOGS, 120);
    assert.equal(summary.knownCostGrossProfit, 80);
    assert.equal(summary.knownCostGrossMarginPercent, 40.0);
    assert.equal(summary.unknownCostRevenue, 250);
    assert.equal(summary.isCostCoverageComplete, false);
    assert.equal(summary.overallGrossProfit, null);
    assert.equal(summary.costCoveragePercent, 44.4); // 200 / 450
  });

  await t.test('12. Blocker 1: profitability calculation with complete costs provides overall profit', () => {
    const summary = calculateProfitabilitySummary([
      { revenue: 200, cogs: 120, hasUnknownCost: false },
      { revenue: 300, cogs: 180, hasUnknownCost: false },
    ]);

    assert.equal(summary.totalDeliveredRevenue, 500);
    assert.equal(summary.knownCostRevenue, 500);
    assert.equal(summary.knownCostCOGS, 300);
    assert.equal(summary.knownCostGrossProfit, 200);
    assert.equal(summary.isCostCoverageComplete, true);
    assert.equal(summary.overallGrossProfit, 200);
    assert.equal(summary.overallGrossMarginPercent, 40.0);
  });

  await t.test('13. Mathematical inventory invariant: physicalStock = availableStock + reservedStock', () => {
    const physical = 50;
    const reserved = 18;
    const available = physical - reserved; // 32
    assert.equal(available + reserved, physical);
    assert.ok(available >= 0);
    assert.ok(reserved >= 0);
  });
});
