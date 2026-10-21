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
 * Normalizes input cart items into a clean array: [{ productId, quantity }]
 */
const normalizeItems = (items) => {
  if (!items) return [];
  const list = Array.isArray(items) ? items : [items];
  return list.map((item) => {
    const productId = Number(item.productId || item.id);
    const quantity = Math.max(1, Number(item.quantity) || 1);
    return { productId, quantity };
  }).filter((item) => !isNaN(item.productId) && item.productId > 0);
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

      const availableStock = typeof prod.stock === 'number' ? prod.stock : 25;
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

    // Deduct stock for each product
    for (const item of sortedItems) {
      const prod = productMap.get(item.productId);
      const newStock = Math.max(0, (prod.stock || 25) - item.quantity);
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
    // Mock Mode Fallback (In-memory simulation)
    const mockProducts = db.mockData.mockProducts;
    const outOfStockErrors = [];

    for (const item of sortedItems) {
      const prod = mockProducts.find((p) => p.id === item.productId);
      if (!prod) {
        throw new Error(`المنتج رقم #${item.productId} غير موجود`);
      }
      const availableStock = typeof prod.stock === 'number' ? prod.stock : 25;
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
      prod.stock = Math.max(0, (prod.stock || 25) - item.quantity);

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
 */
const restoreStock = async (items, { t = null } = {}) => {
  if (!items || !Array.isArray(items)) return;

  if (db.isConnected) {
    const Product = db.products;
    for (const item of items) {
      const qty = Number(item.quantity) || 1;
      await Product.increment('stock', {
        by: qty,
        where: { id: item.productId },
        transaction: t,
      }).catch((e) => console.warn(`Stock restoration notice for prod #${item.productId}:`, e.message));
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
 * Builds the WhatsApp click-to-chat URL with full invoice formatting
 */
const generateWhatsAppLink = ({ orderCode, customerName, customerPhone, location, snapshot, totalCost, expiresAt }) => {
  const storePhone = '972597229340';
  let message = `🌸 *طلب جديد من متجر لولو بوتيكات* 🌸\n\n`;
  message += `📦 *رقم الطلب:* ${orderCode}\n`;

  if (customerName) message += `👤 *اسم العميل:* ${customerName.trim()}\n`;
  if (customerPhone) message += `📞 *رقم الهاتف:* ${customerPhone.trim()}\n`;
  if (location) message += `📍 *عنوان التوصيل:* ${location.trim()}\n`;

  message += `⏳ *حالة الحجز:* تم حجز الكمية لمدة 60 دقيقة\n`;
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
 */
const createWhatsAppDraft = async ({ items, customerName = '', customerPhone = '', location = '', userId = null }) => {
  const normalized = normalizeItems(items);
  const secretToken = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes reservation

  if (db.isConnected) {
    const t = await db.sequelize.transaction();
    try {
      const { snapshot, totalCost } = await lockAndDeductStock(normalized, { t });

      const order = await db.order.create({
        userId: userId || null,
        orders: snapshot,
        totalCost,
        paid: 0,
        location: location || '',
        customerName: customerName || '',
        customerPhone: customerPhone || '',
        orderSource: 'whatsapp_draft',
        orderStatus: 'pending_whatsapp',
        expiresAt,
        secretToken,
        status: false,
      }, { transaction: t });

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
        expiresAt,
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
    // Mock Fallback
    const { snapshot, totalCost } = await lockAndDeductStock(normalized);
    const mockOrders = db.mockData.mockOrders;
    const maxId = mockOrders.reduce((m, o) => Math.max(m, o.id || 0), 100);
    const newId = maxId + 1;
    const orderCode = `#LB-${newId}`;

    const newOrder = {
      id: newId,
      orderCode,
      userId: userId || null,
      orders: snapshot,
      totalCost,
      paid: 0,
      location: location || '',
      customerName: customerName || '',
      customerPhone: customerPhone || '',
      orderSource: 'whatsapp_draft',
      orderStatus: 'pending_whatsapp',
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
      expiresAt,
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
const createWebOrder = async ({ userId, items, location, customerName = '', customerPhone = '' }) => {
  const normalized = normalizeItems(items);

  if (db.isConnected) {
    const t = await db.sequelize.transaction();
    try {
      const { snapshot, totalCost } = await lockAndDeductStock(normalized, { t });

      const order = await db.order.create({
        userId,
        orders: snapshot,
        totalCost,
        paid: 0,
        location: location || '',
        customerName: customerName || '',
        customerPhone: customerPhone || '',
        orderSource: 'web_auth',
        orderStatus: 'confirmed',
        status: false,
      }, { transaction: t });

      const orderCode = `#LB-${order.id}`;
      await order.update({ orderCode }, { transaction: t });

      await t.commit();
      return {
        ...order.dataValues,
        orderCode,
        orders: snapshot,
      };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } else {
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
      status: false,
      createdAt: new Date().toISOString(),
    };

    mockOrders.unshift(newOrder);
    return newOrder;
  }
};

/**
 * 3. Retrieve WhatsApp Draft by ID and Secret Token
 */
const getWhatsAppDraft = async (id, token) => {
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

  if (order.secretToken && order.secretToken !== token) {
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

  return order;
};

/**
 * 4. Cancel WhatsApp Draft & Release Reservation
 */
const cancelOrExpireOrder = async (orderId, targetStatus = 'cancelled') => {
  if (db.isConnected) {
    const t = await db.sequelize.transaction();
    try {
      const order = await db.order.findByPk(orderId, { transaction: t });
      if (!order) throw new Error('الطلب غير موجود');

      if (order.orderStatus === 'delivered') {
        throw new Error('لا يمكن إلغاء طلب تم تسليمه للعميل بالفعل');
      }

      if (order.orderStatus === 'pending_whatsapp' || order.orderStatus === 'confirmed') {
        const items = typeof order.orders === 'string' ? JSON.parse(order.orders) : order.orders;
        await restoreStock(items, { t });
      }

      await order.update({
        orderStatus: targetStatus,
        status: false,
      }, { transaction: t });

      await t.commit();
      return order.dataValues;
    } catch (e) {
      await t.rollback();
      throw e;
    }
  } else {
    const order = db.mockData.mockOrders.find((o) => Number(o.id) === Number(orderId));
    if (!order) throw new Error('الطلب غير موجود');

    if (order.orderStatus === 'delivered') {
      throw new Error('لا يمكن إلغاء طلب تم تسليمه');
    }

    if (order.orderStatus === 'pending_whatsapp' || order.orderStatus === 'confirmed') {
      const items = Array.isArray(order.orders) ? order.orders : [];
      await restoreStock(items);
    }

    order.orderStatus = targetStatus;
    order.status = false;
    return order;
  }
};

/**
 * 5. Update Order Status (Admin Flow)
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
    const order = await db.order.findByPk(orderId);
    if (!order) throw new Error('الطلب غير موجود');

    const isDelivered = newStatus === 'delivered';
    await order.update({
      orderStatus: newStatus,
      status: isDelivered,
    });
    return order.dataValues;
  } else {
    const order = db.mockData.mockOrders.find((o) => Number(o.id) === Number(orderId));
    if (!order) throw new Error('الطلب غير موجود');

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
};
