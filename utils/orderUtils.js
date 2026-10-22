const crypto = require('crypto');

class InsufficientStockError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'InsufficientStockError';
    this.statusCode = 409;
    this.details = details;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks on secret tokens
 */
const safeCompareTokens = (tokenA, tokenB) => {
  if (!tokenA || !tokenB || typeof tokenA !== 'string' || typeof tokenB !== 'string') {
    return false;
  }
  const bufA = Buffer.from(tokenA);
  const bufB = Buffer.from(tokenB);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Normalizes input cart items into an aggregated array: [{ productId, quantity }]
 * - Rejects non-integers, negative quantities, and zero.
 * - Groups duplicate product lines by summing their quantities.
 */
const normalizeItems = (items) => {
  if (!items) throw new Error('سلة الطلبات فارغة!');
  const list = Array.isArray(items) ? items : [items];
  if (list.length === 0) throw new Error('سلة الطلبات فارغة!');

  const itemMap = new Map();

  for (const item of list) {
    if (!item) continue;
    const productId = Number(item.productId || item.id);
    const rawQty = item.quantity !== undefined ? item.quantity : 1;
    const qty = Number(rawQty);

    if (!Number.isInteger(productId) || productId <= 0) {
      throw new Error(`معرّف منتج غير صالح: ${item.productId}`);
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error(`الكمية يجب أن تكون رقماً صحيحاً أكبر من صفر`);
    }

    const currentQty = itemMap.get(productId) || 0;
    itemMap.set(productId, currentQty + qty);
  }

  if (itemMap.size === 0) {
    throw new Error('سلة الطلبات فارغة!');
  }

  return Array.from(itemMap.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
};

/**
 * Compares an existing order's stored items with an incoming payload
 * Returns true only if items, quantities, and customer details match exactly.
 */
const isPayloadMatching = (existingOrder, normalizedItems, customerPhone, location) => {
  if (!existingOrder) return false;
  let existingItems = [];
  try {
    existingItems = typeof existingOrder.orders === 'string'
      ? JSON.parse(existingOrder.orders)
      : (Array.isArray(existingOrder.orders) ? existingOrder.orders : []);
  } catch (e) {
    return false;
  }

  if (existingItems.length !== normalizedItems.length) return false;

  const sortedA = [...normalizedItems].sort((a, b) => a.productId - b.productId);
  const sortedB = [...existingItems].sort((a, b) => Number(a.productId || a.id) - Number(b.productId || b.id));

  for (let i = 0; i < sortedA.length; i++) {
    const a = sortedA[i];
    const b = sortedB[i];
    const bId = Number(b.productId || b.id);
    const bQty = Number(b.quantity || b.count || 1);
    if (a.productId !== bId || a.quantity !== bQty) {
      return false;
    }
  }

  if (customerPhone && existingOrder.customerPhone) {
    const p1 = String(customerPhone).replace(/\D/g, '');
    const p2 = String(existingOrder.customerPhone).replace(/\D/g, '');
    const sig1 = p1.length >= 9 ? p1.slice(-9) : p1;
    const sig2 = p2.length >= 9 ? p2.slice(-9) : p2;
    if (sig1 && sig2 && sig1 !== sig2) return false;
  }

  return true;
};

module.exports = {
  InsufficientStockError,
  safeCompareTokens,
  normalizeItems,
  isPayloadMatching,
};
