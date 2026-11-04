/**
 * Pure Inventory Math & Calculation Helpers
 * Zero external or database dependencies. Safe to run in pure unit tests.
 */

/**
 * Calculates moving weighted-average cost (WAC) on physical inventory.
 *
 * Rules:
 * 1. Missing / unknown costs are never silently inferred.
 * 2. Uncosted incoming stock mixed into costed stock makes the resulting cost unknown (null).
 * 3. Costed incoming stock mixed into uncosted stock makes the resulting cost unknown (null).
 * 4. Only when physical stock is 0 (or negative) does incoming cost establish the new unit cost directly.
 * 5. When both existing and incoming costs are known, standard WAC applies:
 *    (curPhys * curCost + inQty * inCost) / (curPhys + inQty)
 */
const calculateWeightedAverageCost = (currentPhysical, currentUnitCost, incomingQty, incomingUnitCost) => {
  const incomingQtyNum = Number(incomingQty);
  if (!Number.isInteger(incomingQtyNum) || incomingQtyNum <= 0) {
    throw new Error('الكمية المستلمة يجب أن تكون عدداً صحيحاً موجباً');
  }

  const curPhysNum = Math.max(0, Number(currentPhysical) || 0);

  // Parse incoming cost
  let inCostNum = null;
  if (incomingUnitCost !== null && incomingUnitCost !== undefined && incomingUnitCost !== '') {
    inCostNum = Number(incomingUnitCost);
    if (isNaN(inCostNum) || inCostNum < 0) {
      throw new Error('سعر الشراء للوحدة يجب أن يكون رقماً غير سالب');
    }
    inCostNum = Number(inCostNum.toFixed(2));
  }

  // Parse existing cost
  let curCostNum = null;
  if (currentUnitCost !== null && currentUnitCost !== undefined && currentUnitCost !== '') {
    curCostNum = Number(currentUnitCost);
    if (isNaN(curCostNum) || curCostNum < 0) {
      throw new Error('التكلفة الحالية للوحدة غير صالحة');
    }
  }

  // Case 1: Incoming cost is unknown
  if (inCostNum === null) {
    // If incoming units have no known purchase cost, we cannot invent one.
    // Resulting inventory cost is unknown (null).
    return null;
  }

  // Case 2: No existing physical stock
  if (curPhysNum <= 0) {
    return inCostNum;
  }

  // Case 3: Existing physical stock has unknown cost, and incoming has cost
  // Cannot infer what the existing units cost. Resulting cost remains unknown (null).
  if (curCostNum === null) {
    return null;
  }

  // Case 4: Both existing and incoming costs are known
  const totalValuation = (curPhysNum * curCostNum) + (incomingQtyNum * inCostNum);
  const totalUnits = curPhysNum + incomingQtyNum;

  if (totalUnits <= 0) {
    return inCostNum;
  }

  return Number((totalValuation / totalUnits).toFixed(2));
};

/**
 * Calculates weighted-average cost when returning previously delivered items back to stock.
 */
const calculateWacOnReturn = (currentPhysical, currentUnitCost, returnQty, returnUnitCost) => {
  const returnQtyNum = Number(returnQty);
  if (!Number.isInteger(returnQtyNum) || returnQtyNum <= 0) {
    throw new Error('الكمية المرتجعة يجب أن تكون عدداً صحيحاً موجباً');
  }

  const curPhysNum = Math.max(0, Number(currentPhysical) || 0);

  let retCostNum = null;
  if (returnUnitCost !== null && returnUnitCost !== undefined && returnUnitCost !== '') {
    retCostNum = Number(returnUnitCost);
    if (isNaN(retCostNum) || retCostNum < 0) {
      retCostNum = null;
    } else {
      retCostNum = Number(retCostNum.toFixed(2));
    }
  }

  let curCostNum = null;
  if (currentUnitCost !== null && currentUnitCost !== undefined && currentUnitCost !== '') {
    curCostNum = Number(currentUnitCost);
    if (isNaN(curCostNum) || curCostNum < 0) curCostNum = null;
  }

  // If no physical stock currently on hand, the returned item's original cost sets the cost
  if (curPhysNum <= 0) {
    return retCostNum;
  }

  // If either current stock or returned stock has unknown cost, the resulting cost is unknown
  if (curCostNum === null || retCostNum === null) {
    return null;
  }

  // Both costs known: weighted average
  const totalValuation = (curPhysNum * curCostNum) + (returnQtyNum * retCostNum);
  const totalUnits = curPhysNum + returnQtyNum;

  return Number((totalValuation / totalUnits).toFixed(2));
};

/**
 * Computes profitability metrics without inflating profit from unknown costs.
 *
 * Orders list should contain: { revenue, cogs, hasUnknownCost }
 */
const calculateProfitabilitySummary = (orders = []) => {
  let totalRevenue = 0;
  let knownRevenue = 0;
  let knownCOGS = 0;
  let unknownRevenue = 0;
  let knownOrdersCount = 0;
  let unknownOrdersCount = 0;

  for (const o of orders) {
    const rev = Number(o.revenue || o.totalCost) || 0;
    totalRevenue += rev;

    const isUnknown = Boolean(o.hasUnknownCost || o.cogs === null || o.cogs === undefined);

    if (isUnknown) {
      unknownRevenue += rev;
      unknownOrdersCount++;
    } else {
      const cogs = Number(o.cogs || o.totalPurchaseCost) || 0;
      knownRevenue += rev;
      knownCOGS += cogs;
      knownOrdersCount++;
    }
  }

  totalRevenue = Number(totalRevenue.toFixed(2));
  knownRevenue = Number(knownRevenue.toFixed(2));
  knownCOGS = Number(knownCOGS.toFixed(2));
  unknownRevenue = Number(unknownRevenue.toFixed(2));

  const knownGrossProfit = Number((knownRevenue - knownCOGS).toFixed(2));
  const knownGrossMarginPercent = knownRevenue > 0
    ? Number(((knownGrossProfit / knownRevenue) * 100).toFixed(1))
    : 0;

  const isCostCoverageComplete = unknownOrdersCount === 0;
  const overallGrossProfit = isCostCoverageComplete ? knownGrossProfit : null;
  const overallGrossMarginPercent = isCostCoverageComplete ? knownGrossMarginPercent : null;

  const costCoveragePercent = totalRevenue > 0
    ? Number(((knownRevenue / totalRevenue) * 100).toFixed(1))
    : 100;

  return {
    totalDeliveredRevenue: totalRevenue,
    deliveredOrdersCount: orders.length,
    knownCostOrdersCount: knownOrdersCount,
    unknownCostOrdersCount: unknownOrdersCount,
    isCostCoverageComplete,
    costCoveragePercent,

    // Subset with complete cost data
    knownCostRevenue: knownRevenue,
    knownCostCOGS: knownCOGS,
    knownCostGrossProfit: knownGrossProfit,
    knownCostGrossMarginPercent: knownGrossMarginPercent,

    // Unknown subset
    unknownCostRevenue: unknownRevenue,

    // Overall metrics (explicitly null if incomplete, preventing inflated profits)
    overallGrossProfit,
    overallGrossMarginPercent,
  };
};

module.exports = {
  calculateWeightedAverageCost,
  calculateWacOnReturn,
  calculateProfitabilitySummary,
};
