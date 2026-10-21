const crypto = require('crypto');
const db = require('../models');

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
 * Shared logic to validate availability and reserve/deduct stock.
 * Uses SELECT FOR UPDATE with ordered IDs to prevent deadlocks and overselling.
 */
const lockAndDeductStock = async (normalizedItems, { t = null } = {}) => {
  if (normalizedItems.length === 0) {
    throw new Error('سلة الطلبات فارغة!');
  }

  // Sort by product ID in ascending order to prevent deadlocks across concurrent requests
  const sortedItems = [...normalizedItems].sort((a, b) => a.productId - b.productId);
  const productIds = sortedItems.map((i) => i.productId);

  const snapshot = [];
  let totalCost = 0;

  if (db.isConnected) {
    const Product = db.products;
    const dbProducts = await Product.findAll({
      where: { id: productIds },
      lock: t ? t.LOCK.UPDATE : false,
      transaction: t,
      order: [['id', 'ASC']],
    });

    const productMap = new Map();
    dbProducts.forEach((p) => productMap.set(p.id, p));

    const outOfStockErrors = [];

    for (const item of sortedItems) {
      const prod = productMap.get(item.productId);
      if (!prod) {
        throw new Error(`المنتج رقم #${item.productId} غير موجود بالمتجر`);
      }

      if (prod.published === false) {
        throw new Error(`المنتج "${prod.name}" غير متاح للشراء حالياً`);
      }

      const availableStock = typeof prod.stock === 'number' ? prod.stock : 0;
      if (availableStock < item.quantity) {
        outOfStockErrors.push({
          productId: prod.id,
          name: prod.name,
          requested: item.quantity,
          available: availableStock,
        });
      }
    }

    if (outOfStockErrors.length > 0) {
      const names = outOfStockErrors.map((e) => `"${e.name}" (المتاح: ${e.available})`).join('، ');
      throw new InsufficientStockError(`عذراً، الكمية المطلوبة غير متوفرة حالياً للمنتجات: ${names}`, outOfStockErrors);
    }

    // Deduct stock for each product (never fallback to 25 if stock is 0)
    for (const item of sortedItems) {
      const prod = productMap.get(item.productId);
      const currentStock = typeof prod.stock === 'number' ? prod.stock : 0;
      const newStock = Math.max(0, currentStock - item.quantity);
      await prod.update({ stock: newStock }, { transaction: t });

      const price = Number(prod.price) || 0;
      const subtotal = price * item.quantity;
      totalCost += subtotal;

      snapshot.push({
        productId: prod.id,
        name: prod.name,
        price,
        quantity: item.quantity,
        subtotal,
      });
    }
  } else {
    // In production, reject if DB is disconnected
    if (process.env.NODE_ENV === 'production') {
      throw new Error('خدمة الطلبات غير متاحة مؤقتاً لصيانة قاعدة البيانات، يرجى المحاولة بعد قليل.');
    }

    // Mock Mode Fallback (In-memory simulation for local dev)
    const mockProducts = db.mockData.mockProducts;
    const outOfStockErrors = [];

    for (const item of sortedItems) {
      const prod = mockProducts.find((p) => p.id === item.productId);
      if (!prod) {
        throw new Error(`المنتج رقم #${item.productId} غير موجود`);
      }
      if (prod.published === false) {
        throw new Error(`المنتج "${prod.name}" غير متاح للشراء حالياً`);
      }
      const availableStock = typeof prod.stock === 'number' ? prod.stock : 0;
      if (availableStock < item.quantity) {
        outOfStockErrors.push({
          productId: prod.id,
          name: prod.name,
          requested: item.quantity,
          available: availableStock,
        });
      }
    }

    if (outOfStockErrors.length > 0) {
      const names = outOfStockErrors.map((e) => `"${e.name}" (المتاح: ${e.available})`).join('، ');
      throw new InsufficientStockError(`عذراً، الكمية غير متوفرة: ${names}`, outOfStockErrors);
    }

    for (const item of sortedItems) {
      const prod = mockProducts.find((p) => p.id === item.productId);
      const currentStock = typeof prod.stock === 'number' ? prod.stock : 0;
      prod.stock = Math.max(0, currentStock - item.quantity);

      const price = Number(prod.price) || 0;
      const subtotal = price * item.quantity;
      totalCost += subtotal;

      snapshot.push({
        productId: prod.id,
        name: prod.name,
        price,
        quantity: item.quantity,
        subtotal,
      });
    }
  }

  return { snapshot, totalCost };
};

/**
 * Restores reserved stock back to products table
 * MUST throw if update fails so outer transaction rolls back.
 */
const restoreStock = async (items, { t = null } = {}) => {
  if (!items || !Array.isArray(items) || items.length === 0) return;

  if (db.isConnected) {
    const Product = db.products;
    for (const item of items) {
      const qty = Number(item.quantity) || 1;
      await Product.increment('stock', {
        by: qty,
        where: { id: item.productId },
        transaction: t,
      });
    }
  } else {
    const mockProducts = db.mockData.mockProducts;
    for (const item of items) {
      const prod = mockProducts.find((p) => p.id === Number(item.productId));
      if (prod) {
        prod.stock = (prod.stock || 0) + (Number(item.quantity) || 1);
      }
    }
  }
};

/**
 * Strips secret tokens and sensitive data from order representation before sending to client
 */
const sanitizeOrder = (order) => {
  if (!order) return order;
  const o = order.dataValues ? { ...order.dataValues } : { ...order };
  delete o.secretToken;
  if (typeof o.orders === 'string') {
    try {
      o.orders = JSON.parse(o.orders);
    } catch (e) {
      // keep as is
    }
  }
  return o;
};

/**
 * Builds the WhatsApp click-to-chat URL with full invoice formatting
 */
const generateWhatsAppLink = ({ orderCode, customerName, customerPhone, location, snapshot, totalCost }) => {
  const storePhone = '972597229340';
  let message = `🌸 *طلب جديد من متجر لولو بوتيكات* 🌸\n\n`;
  message += `📦 *رقم الطلب:* ${orderCode}\n`;

  if (customerName) message += `👤 *اسم العميل:* ${customerName.trim()}\n`;
  if (customerPhone) message += `📞 *رقم الهاتف:* ${customerPhone.trim()}\n`;
  if (location) message += `📍 *عنوان التوصيل:* ${location.trim()}\n`;

  message += `⏳ *حالة الحجز:* تم حجز الكمية لمدة 60 دقيقة في المخزون\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🛍️ *تفاصيل الفاتورة:* \n`;

  snapshot.forEach((item, idx) => {
    message += `\n${idx + 1}) *${item.name}*\n`;
    message += `   ▫️ الكمية: ${item.quantity}\n`;
    message += `   ▫️ السعر: ${item.subtotal} ₪\n`;
    message += `   🔗 https://loulou-boutiqaat.vercel.app/home/products/${item.productId}\n`;
  });

  message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💰 *المجموع النهائي:* ${totalCost} ₪\n`;
  message += `🚚 *طريقة الدفع:* الدفع عند الاستلام\n\n`;
  message += `يرجى تأكيد استلام الطلب وتحديد موعد التوصيل، شكراً لكم! ✨`;

  return `https://wa.me/${storePhone}?text=${encodeURIComponent(message)}`;
};

/**
 * 1. Create WhatsApp Draft with 60-Minute Stock Reservation
 * Supports idempotencyKey to prevent duplicate reservations
 */
const createWhatsAppDraft = async ({
  items,
  customerName = '',
  customerPhone = '',
  location = '',
  userId = null,
  idempotencyKey = null,
}) => {
  const normalized = normalizeItems(items);

  // Check Idempotency Key first
  if (idempotencyKey) {
    if (db.isConnected) {
      const existing = await db.order.findOne({
        where: { idempotencyKey },
      });
      if (existing) {
        const now = new Date();
        // If still active, return existing draft
        if (existing.orderStatus === 'pending_whatsapp' && (!existing.expiresAt || new Date(existing.expiresAt) > now)) {
          const orderSnapshot = typeof existing.orders === 'string' ? JSON.parse(existing.orders) : existing.orders;
          const waUrl = generateWhatsAppLink({
            orderCode: existing.orderCode,
            customerName: existing.customerName,
            customerPhone: existing.customerPhone,
            location: existing.location,
            snapshot: orderSnapshot,
            totalCost: existing.totalCost,
          });
          return {
            id: existing.id,
            orderCode: existing.orderCode,
            totalCost: existing.totalCost,
            expiresAt: existing.expiresAt,
            secretToken: existing.secretToken,
            orderStatus: existing.orderStatus,
            waUrl,
            items: orderSnapshot,
            idempotent: true,
          };
        }
      }
    } else {
      const existing = (db.mockData.mockOrders || []).find((o) => o.idempotencyKey === idempotencyKey);
      if (existing) {
        const now = new Date();
        if (existing.orderStatus === 'pending_whatsapp' && (!existing.expiresAt || new Date(existing.expiresAt) > now)) {
          const orderSnapshot = Array.isArray(existing.orders) ? existing.orders : [];
          const waUrl = generateWhatsAppLink({
            orderCode: existing.orderCode,
            customerName: existing.customerName,
            customerPhone: existing.customerPhone,
            location: existing.location,
            snapshot: orderSnapshot,
            totalCost: existing.totalCost,
          });
          return {
            id: existing.id,
            orderCode: existing.orderCode,
            totalCost: existing.totalCost,
            expiresAt: existing.expiresAt,
            secretToken: existing.secretToken,
            orderStatus: existing.orderStatus,
            waUrl,
            items: orderSnapshot,
            idempotent: true,
          };
        }
      }
    }
  }

  const secretToken = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes reservation

  if (db.isConnected) {
    const t = await db.sequelize.transaction();
    try {
      const { snapshot, totalCost } = await lockAndDeductStock(normalized, { t });

      const order = await db.order.create(
        {
          userId: userId || null,
          orders: snapshot,
          totalCost,
          paid: 0,
          location: location || '',
          customerName: customerName || '',
          customerPhone: customerPhone || '',
          orderSource: 'whatsapp_draft',
          orderStatus: 'pending_whatsapp',
          inventoryTracked: true,
          idempotencyKey: idempotencyKey || null,
          expiresAt,
          secretToken,
          status: false,
        },
        { transaction: t }
      );

      const orderCode = `#LB-${order.id}`;
      await order.update({ orderCode }, { transaction: t });

      await t.commit();

      const waUrl = generateWhatsAppLink({
        orderCode,
        customerName,
        customerPhone,
        location,
        snapshot,
        totalCost,
      });

      return {
        id: order.id,
        orderCode,
        totalCost,
        expiresAt,
        secretToken,
        orderStatus: 'pending_whatsapp',
        waUrl,
        items: snapshot,
      };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('خدمة الطلبات غير متاحة مؤقتاً لصيانة قاعدة البيانات، يرجى المحاولة بعد قليل.');
    }

    // Mock Fallback
    const { snapshot, totalCost } = await lockAndDeductStock(normalized);
    const mockOrders = db.mockData.mockOrders;
    const maxId = mockOrders.reduce((m, o) => Math.max(m, o.id || 0), 100);
    const newId = maxId + 1;
    const orderCode = `#LB-${newId}`;

    const newOrder = {
      id: newId,
      orderCode,
      idempotencyKey: idempotencyKey || null,
      userId: userId || null,
      orders: snapshot,
      totalCost,
      paid: 0,
      location: location || '',
      customerName: customerName || '',
      customerPhone: customerPhone || '',
      orderSource: 'whatsapp_draft',
      orderStatus: 'pending_whatsapp',
      inventoryTracked: true,
      expiresAt: expiresAt.toISOString(),
      secretToken,
      status: false,
      createdAt: new Date().toISOString(),
    };

    mockOrders.unshift(newOrder);

    const waUrl = generateWhatsAppLink({
      orderCode,
      customerName,
      customerPhone,
      location,
      snapshot,
      totalCost,
    });

    return {
      id: newId,
      orderCode,
      totalCost,
      expiresAt,
      secretToken,
      orderStatus: 'pending_whatsapp',
      waUrl,
      items: snapshot,
    };
  }
};

/**
 * 2. Create In-App Authenticated Web Order
 */
const createWebOrder = async ({
  userId,
  items,
  location,
  customerName = '',
  customerPhone = '',
  idempotencyKey = null,
}) => {
  const normalized = normalizeItems(items);

  if (idempotencyKey && db.isConnected) {
    const existing = await db.order.findOne({ where: { idempotencyKey } });
    if (existing) {
      return sanitizeOrder(existing);
    }
  }

  if (db.isConnected) {
    const t = await db.sequelize.transaction();
    try {
      const { snapshot, totalCost } = await lockAndDeductStock(normalized, { t });

      const order = await db.order.create(
        {
          userId,
          orders: snapshot,
          totalCost,
          paid: 0,
          location: location || '',
          customerName: customerName || '',
          customerPhone: customerPhone || '',
          orderSource: 'web_auth',
          orderStatus: 'confirmed',
          inventoryTracked: true,
          idempotencyKey: idempotencyKey || null,
          status: false,
        },
        { transaction: t }
      );

      const orderCode = `#LB-${order.id}`;
      await order.update({ orderCode }, { transaction: t });

      await t.commit();
      return sanitizeOrder(order);
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('خدمة الطلبات غير متاحة مؤقتاً لصيانة قاعدة البيانات، يرجى المحاولة بعد قليل.');
    }

    const { snapshot, totalCost } = await lockAndDeductStock(normalized);
    const mockOrders = db.mockData.mockOrders;
    const maxId = mockOrders.reduce((m, o) => Math.max(m, o.id || 0), 100);
    const newId = maxId + 1;
    const orderCode = `#LB-${newId}`;

    const newOrder = {
      id: newId,
      orderCode,
      userId,
      orders: snapshot,
      totalCost,
      paid: 0,
      location: location || '',
      customerName,
      customerPhone,
      orderSource: 'web_auth',
      orderStatus: 'confirmed',
      inventoryTracked: true,
      status: false,
      createdAt: new Date().toISOString(),
    };

    mockOrders.unshift(newOrder);
    return newOrder;
  }
};

/**
 * 3. Retrieve WhatsApp Draft by ID and Secret Token
 * Requires valid token and matches orderSource strictly to prevent leaking web orders
 */
const getWhatsAppDraft = async (id, token) => {
  if (!token || typeof token !== 'string' || token.trim().length < 8) {
    throw new Error('رمز الدخول السري (secretToken) مطلوب وغير صالح');
  }

  let order = null;
  if (db.isConnected) {
    order = await db.order.findByPk(id);
    if (order) order = order.dataValues;
  } else {
    order = db.mockData.mockOrders.find((o) => Number(o.id) === Number(id));
  }

  if (!order) {
    throw new Error('لم يتم العثور على مسودة الطلب');
  }

  // Must strictly be a whatsapp_draft
  if (order.orderSource !== 'whatsapp_draft') {
    throw new Error('هذا الطلب ليس مسودة واتساب');
  }

  // Constant-time comparison
  if (!safeCompareTokens(order.secretToken, token.trim())) {
    throw new Error('رمز الدخول غير صالح');
  }

  // Check if expired
  if (order.orderStatus === 'pending_whatsapp' && order.expiresAt) {
    const now = new Date();
    if (now > new Date(order.expiresAt)) {
      await cancelOrExpireOrder(order.id, 'expired');
      order.orderStatus = 'expired';
    }
  }

  return sanitizeOrder(order);
};

/**
 * 4. Cancel WhatsApp Draft & Release Reservation
 * Row-locked, idempotent, and only restores stock once
 */
const cancelOrExpireOrder = async (orderId, targetStatus = 'cancelled') => {
  if (targetStatus !== 'cancelled' && targetStatus !== 'expired') {
    throw new Error(`حالة إلغاء غير صالحة: ${targetStatus}`);
  }

  if (db.isConnected) {
    const t = await db.sequelize.transaction();
    try {
      // Row-level lock to prevent concurrent double release
      const order = await db.order.findByPk(orderId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!order) throw new Error('الطلب غير موجود');

      // Idempotency: if already cancelled or expired, do not restore again
      if (order.orderStatus === 'cancelled' || order.orderStatus === 'expired') {
        await t.commit();
        return sanitizeOrder(order);
      }

      if (order.orderStatus === 'delivered') {
        throw new Error('لا يمكن إلغاء طلب تم تسليمه للعميل بالفعل');
      }

      // Only restore stock if currently active and tracked
      if (
        (order.orderStatus === 'pending_whatsapp' || order.orderStatus === 'confirmed') &&
        order.inventoryTracked === true
      ) {
        const items = typeof order.orders === 'string' ? JSON.parse(order.orders) : order.orders;
        await restoreStock(items, { t });
      }

      await order.update(
        {
          orderStatus: targetStatus,
          inventoryTracked: false,
          status: false,
        },
        { transaction: t }
      );

      await t.commit();
      return sanitizeOrder(order);
    } catch (e) {
      await t.rollback();
      throw e;
    }
  } else {
    const order = db.mockData.mockOrders.find((o) => Number(o.id) === Number(orderId));
    if (!order) throw new Error('الطلب غير موجود');

    if (order.orderStatus === 'cancelled' || order.orderStatus === 'expired') {
      return order;
    }

    if (order.orderStatus === 'delivered') {
      throw new Error('لا يمكن إلغاء طلب تم تسليمه');
    }

    if (
      (order.orderStatus === 'pending_whatsapp' || order.orderStatus === 'confirmed') &&
      order.inventoryTracked === true
    ) {
      const items = Array.isArray(order.orders) ? order.orders : [];
      await restoreStock(items);
    }

    order.orderStatus = targetStatus;
    order.inventoryTracked = false;
    order.status = false;
    return order;
  }
};

/**
 * 5. Update Order Status (Admin Flow)
 * Enforces valid state machine transitions:
 * pending_whatsapp -> confirmed | cancelled | expired
 * confirmed -> delivered | cancelled
 */
const updateOrderStatus = async (orderId, newStatus) => {
  const allowed = ['pending_whatsapp', 'confirmed', 'delivered', 'cancelled', 'expired'];
  if (!allowed.includes(newStatus)) {
    throw new Error(`حالة غير مقبولة: ${newStatus}`);
  }

  if (newStatus === 'cancelled' || newStatus === 'expired') {
    return cancelOrExpireOrder(orderId, newStatus);
  }

  if (db.isConnected) {
    const t = await db.sequelize.transaction();
    try {
      const order = await db.order.findByPk(orderId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!order) throw new Error('الطلب غير موجود');

      // State machine rules:
      if (order.orderStatus === 'cancelled' || order.orderStatus === 'expired') {
        throw new Error('لا يمكن إعادة تأكيد أو تسليم طلب ملغي أو منتهي الصلاحية');
      }

      if (order.orderStatus === 'delivered' && newStatus !== 'delivered') {
        throw new Error('لا يمكن تعديل حالة طلب تم تسليمه');
      }

      const isDelivered = newStatus === 'delivered';
      await order.update(
        {
          orderStatus: newStatus,
          status: isDelivered,
        },
        { transaction: t }
      );

      await t.commit();
      return sanitizeOrder(order);
    } catch (e) {
      await t.rollback();
      throw e;
    }
  } else {
    const order = db.mockData.mockOrders.find((o) => Number(o.id) === Number(orderId));
    if (!order) throw new Error('الطلب غير موجود');

    if (order.orderStatus === 'cancelled' || order.orderStatus === 'expired') {
      throw new Error('لا يمكن إعادة تأكيد أو تسليم طلب ملغي أو منتهي الصلاحية');
    }

    if (order.orderStatus === 'delivered' && newStatus !== 'delivered') {
      throw new Error('لا يمكن تعديل حالة طلب تم تسليمه');
    }

    order.orderStatus = newStatus;
    order.status = newStatus === 'delivered';
    return order;
  }
};

/**
 * 6. Background Job: Cleanup Expired WhatsApp Drafts (Every 60s)
 */
const cleanupExpiredDrafts = async () => {
  try {
    const now = new Date();

    if (db.isConnected) {
      const { Op } = db.Sequelize;
      const expiredOrders = await db.order.findAll({
        where: {
          orderStatus: 'pending_whatsapp',
          expiresAt: { [Op.lt]: now },
        },
      });

      if (expiredOrders.length > 0) {
        console.log(`[OrderService] Found ${expiredOrders.length} expired WhatsApp draft(s). Releasing reservations...`);
        for (const order of expiredOrders) {
          await cancelOrExpireOrder(order.id, 'expired').catch((err) =>
            console.error(`Error expiring order #${order.id}:`, err.message)
          );
        }
      }
    } else {
      const mockOrders = db.mockData.mockOrders || [];
      const expired = mockOrders.filter(
        (o) => o.orderStatus === 'pending_whatsapp' && o.expiresAt && new Date(o.expiresAt) < now
      );

      if (expired.length > 0) {
        console.log(`[OrderService (Mock)] Releasing ${expired.length} expired reservation(s)...`);
        for (const o of expired) {
          await cancelOrExpireOrder(o.id, 'expired').catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('[OrderService] Error during cleanup of expired drafts:', err.message);
  }
};

module.exports = {
  InsufficientStockError,
  normalizeItems,
  createWhatsAppDraft,
  createWebOrder,
  getWhatsAppDraft,
  cancelOrExpireOrder,
  updateOrderStatus,
  cleanupExpiredDrafts,
  sanitizeOrder,
};
