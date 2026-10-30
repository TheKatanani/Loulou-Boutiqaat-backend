const crypto = require('crypto');
const db = require('../models');
const {
  InsufficientStockError,
  safeCompareTokens,
  normalizeItems,
  isPayloadMatching,
} = require('../utils/orderUtils');

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
    const expandedIds = [
      ...new Set([
        ...productIds,
        ...productIds.filter((id) => id >= 112 && id <= 118).map((id) => id - 111),
      ]),
    ];
    const dbProducts = await Product.findAll({
      where: { id: expandedIds },
      lock: t ? t.LOCK.UPDATE : false,
      transaction: t,
      order: [['id', 'ASC']],
    });

    const productMap = new Map();
    dbProducts.forEach((p) => {
      productMap.set(p.id, p);
      if (p.id >= 1 && p.id <= 7) {
        productMap.set(p.id + 111, p); // Support Meta Catalog Content ID aliases (112..118)
      }
    });

    const outOfStockErrors = [];

    for (const item of sortedItems) {
      const prod = productMap.get(item.productId);
      if (!prod) {
        throw new Error(`المنتج رقم #${item.productId} غير موجود بالمتجر`);
      }

      if (prod.published === false || prod.published === 0) {
        throw new Error(`المنتج "${prod.name}" غير متاح للشراء حالياً`);
      }

      const availableStock = prod.stock !== undefined && prod.stock !== null ? prod.stock : 0;
      if (availableStock < item.quantity) {
        outOfStockErrors.push({
          productId: prod.id,
          productName: prod.name,
          requested: item.quantity,
          available: availableStock,
        });
      }
    }

    if (outOfStockErrors.length > 0) {
      const detailsMsg = outOfStockErrors
        .map((e) => `المنتج "${e.productName}": المطلوب ${e.requested} والمتاح بالمخزون ${e.available}`)
        .join('، ');
      throw new InsufficientStockError(
        `عذراً، بعض المنتجات المطلوبة غير متوفرة بالكمية الكافية: ${detailsMsg}`,
        outOfStockErrors
      );
    }

    // Deduct stock and build invoice snapshot
    for (const item of sortedItems) {
      const prod = productMap.get(item.productId);
      await Product.decrement('stock', {
        by: item.quantity,
        where: { id: prod.id },
        transaction: t,
      });

      const lineTotal = Number(prod.price) * item.quantity;
      totalCost += lineTotal;

      let imageUrl = null;
      if (prod.images) {
        try {
          const imgs = typeof prod.images === 'string' ? JSON.parse(prod.images) : prod.images;
          imageUrl = Array.isArray(imgs) ? imgs[0] : imgs;
        } catch (e) {
          imageUrl = prod.images;
        }
      }

      snapshot.push({
        productId: prod.id,
        name: prod.name,
        price: Number(prod.price),
        quantity: item.quantity,
        image: imageUrl,
        lineTotal,
      });
    }
  } else {
    // Mock Data Fallback
    const mockProducts = db.mockData.mockProducts;
    const outOfStockErrors = [];

    for (const item of sortedItems) {
      const prod = mockProducts.find(
        (p) => p.id === item.productId || (item.productId >= 112 && p.id === item.productId - 111)
      );
      if (!prod) {
        throw new Error(`المنتج رقم #${item.productId} غير موجود بالمتجر`);
      }

      if (prod.published === false || prod.published === 0) {
        throw new Error(`المنتج "${prod.name}" غير متاح للشراء حالياً`);
      }

      const availableStock = prod.stock !== undefined && prod.stock !== null ? prod.stock : 0;
      if (availableStock < item.quantity) {
        outOfStockErrors.push({
          productId: prod.id,
          productName: prod.name,
          requested: item.quantity,
          available: availableStock,
        });
      }
    }

    if (outOfStockErrors.length > 0) {
      const detailsMsg = outOfStockErrors
        .map((e) => `المنتج "${e.productName}": المطلوب ${e.requested} والمتاح ${e.available}`)
        .join('، ');
      throw new InsufficientStockError(
        `عذراً، بعض المنتجات غير متوفرة بالكمية الكافية: ${detailsMsg}`,
        outOfStockErrors
      );
    }

    for (const item of sortedItems) {
      const prod = mockProducts.find(
        (p) => p.id === item.productId || (item.productId >= 112 && p.id === item.productId - 111)
      );
      prod.stock = (prod.stock || 0) - item.quantity;

      const lineTotal = Number(prod.price) * item.quantity;
      totalCost += lineTotal;

      let imageUrl = null;
      if (prod.images) {
        imageUrl = Array.isArray(prod.images) ? prod.images[0] : prod.images;
      }

      snapshot.push({
        productId: prod.id,
        name: prod.name,
        price: Number(prod.price),
        quantity: item.quantity,
        image: imageUrl,
        lineTotal,
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
      const pId = Number(item.productId || item.id);
      const qty = Number(item.quantity || item.count) || 1;
      if (!pId) continue;
      await Product.increment('stock', {
        by: qty,
        where: { id: pId },
        transaction: t,
      });
    }
  } else {
    const mockProducts = db.mockData.mockProducts;
    for (const item of items) {
      const pId = Number(item.productId || item.id);
      const qty = Number(item.quantity || item.count) || 1;
      const prod = mockProducts.find((p) => p.id === pId);
      if (prod) {
        prod.stock = (prod.stock || 0) + qty;
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
    message += `   ▫️ السعر: ${item.price} ₪\n`;
    message += `   ▫️ الإجمالي: ${item.lineTotal || item.price * item.quantity} ₪\n`;
  });

  message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💰 *المجموع النهائي المطلوب:* *${totalCost} ₪*\n\n`;
  message += `🚚 التوصيل متاح لكافة مناطق قطاع غزة.\n`;
  message += `يرجى تأكيد موعد الاستلام المناسب لكم. شكراً لتسوقكم من لولو بوتيكات! ✨`;

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

  // Check active pending drafts cap per phone (max 3 unexpired reservations per phone)
  if (customerPhone && db.isConnected) {
    const cleanPhone = String(customerPhone).replace(/\D/g, '');
    if (cleanPhone.length >= 9) {
      const activeDraftsCount = await db.order.count({
        where: {
          customerPhone: { [db.Sequelize.Op.like]: `%${cleanPhone.slice(-9)}` },
          orderStatus: 'pending_whatsapp',
          expiresAt: { [db.Sequelize.Op.gt]: new Date() },
        },
      });
      if (activeDraftsCount >= 3) {
        const err = new Error('لديك 3 حجوزات نشطة حالياً. يرجى إتمام أحد الطلبات السابقة أو إلغاؤه قبل إنشاء حجز جديد.');
        err.statusCode = 429;
        throw err;
      }
    }
  }

  // Check Idempotency Key first
  if (idempotencyKey) {
    if (db.isConnected) {
      const existing = await db.order.findOne({
        where: { idempotencyKey },
      });
      if (existing) {
        if (!isPayloadMatching(existing, normalized, customerPhone, location)) {
          const conflictErr = new Error('تم استخدام مفتاح الإعادة (Idempotency Key) مسبقاً مع بيانات أو سلة مختلفة');
          conflictErr.statusCode = 409;
          throw conflictErr;
        }

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
        if (!isPayloadMatching(existing, normalized, customerPhone, location)) {
          const conflictErr = new Error('تم استخدام مفتاح الإعادة (Idempotency Key) مسبقاً مع بيانات أو سلة مختلفة');
          conflictErr.statusCode = 409;
          throw conflictErr;
        }

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

      // Handle race condition: unique constraint error on idempotencyKey
      if ((err.name === 'SequelizeUniqueConstraintError' || err.message?.includes('Duplicate')) && idempotencyKey) {
        const existing = await db.order.findOne({ where: { idempotencyKey } });
        if (existing) {
          if (!isPayloadMatching(existing, normalized, customerPhone, location)) {
            const conflictErr = new Error('تم استخدام مفتاح الإعادة (Idempotency Key) مسبقاً مع بيانات أو سلة مختلفة');
            conflictErr.statusCode = 409;
            throw conflictErr;
          }
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
      if (!isPayloadMatching(existing, normalized, customerPhone, location)) {
        const conflictErr = new Error('تم استخدام مفتاح الإعادة (Idempotency Key) مسبقاً مع بيانات أو سلة مختلفة');
        conflictErr.statusCode = 409;
        throw conflictErr;
      }
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

      if ((err.name === 'SequelizeUniqueConstraintError' || err.message?.includes('Duplicate')) && idempotencyKey) {
        const existing = await db.order.findOne({ where: { idempotencyKey } });
        if (existing) {
          if (!isPayloadMatching(existing, normalized, customerPhone, location)) {
            const conflictErr = new Error('تم استخدام مفتاح الإعادة (Idempotency Key) مسبقاً مع بيانات أو سلة مختلفة');
            conflictErr.statusCode = 409;
            throw conflictErr;
          }
          return sanitizeOrder(existing);
        }
      }
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
      customerName: customerName || '',
      customerPhone: customerPhone || '',
      orderSource: 'web_auth',
      orderStatus: 'confirmed',
      inventoryTracked: true,
      idempotencyKey: idempotencyKey || null,
      status: false,
      createdAt: new Date().toISOString(),
    };

    mockOrders.unshift(newOrder);
    return sanitizeOrder(newOrder);
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
 * Row-locked, idempotent, and enforces strict state transitions.
 * - 'expired' ONLY applies to pending_whatsapp orders whose expiresAt has passed.
 * - 'cancelled' applies to pending_whatsapp or confirmed orders.
 */
const cancelOrExpireOrder = async (orderId, targetStatus = 'cancelled') => {
  if (targetStatus !== 'cancelled' && targetStatus !== 'expired') {
    throw new Error(`حالة إلغاء غير صالحة: ${targetStatus}`);
  }

  if (db.isConnected) {
    const t = await db.sequelize.transaction();
    try {
      const order = await db.order.findByPk(orderId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!order) throw new Error('الطلب غير موجود');

      // Idempotency: if already in targetStatus, return
      if (order.orderStatus === targetStatus || order.orderStatus === 'cancelled' || order.orderStatus === 'expired') {
        await t.commit();
        return sanitizeOrder(order);
      }

      // Enforce strict expiration conditions:
      if (targetStatus === 'expired') {
        if (order.orderStatus !== 'pending_whatsapp') {
          // Cannot expire an order that is already confirmed or delivered
          await t.commit();
          return sanitizeOrder(order);
        }
        if (order.expiresAt && new Date(order.expiresAt) > new Date()) {
          throw new Error('لا يمكن إنهاء حجز لم تنتهِ صلاحيته بعد');
        }
      }

      // Enforce cancellation conditions:
      if (targetStatus === 'cancelled') {
        if (order.orderStatus === 'delivered') {
          throw new Error('لا يمكن إلغاء طلب تم تسليمه للعميل بالفعل');
        }
      }

      // Only restore stock if currently active (pending_whatsapp or confirmed) and tracked
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

    if (order.orderStatus === targetStatus || order.orderStatus === 'cancelled' || order.orderStatus === 'expired') {
      return order;
    }

    if (targetStatus === 'expired') {
      if (order.orderStatus !== 'pending_whatsapp') {
        return order;
      }
      if (order.expiresAt && new Date(order.expiresAt) > new Date()) {
        throw new Error('لا يمكن إنهاء حجز لم تنتهِ صلاحيته بعد');
      }
    }

    if (targetStatus === 'cancelled' && order.orderStatus === 'delivered') {
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

      // Check timeout when confirming a pending draft:
      if (newStatus === 'confirmed' && order.orderStatus === 'pending_whatsapp') {
        const now = new Date();
        if (order.expiresAt && new Date(order.expiresAt) <= now) {
          // The reservation expired! Transition to expired and restore stock under lock
          if (order.inventoryTracked === true) {
            const items = typeof order.orders === 'string' ? JSON.parse(order.orders) : order.orders;
            await restoreStock(items, { t });
          }
          await order.update(
            { orderStatus: 'expired', inventoryTracked: false, status: false },
            { transaction: t }
          );
          // Commit the expiration and stock restoration to the database so it is never rolled back!
          await t.commit();
          const err = new Error('انتهت صلاحية حجز هذا الطلب (تجاوزت الـ 60 دقيقة) وأعيدت المنتجات للمخزون، لا يمكن تأكيده');
          err.statusCode = 409;
          err.order = sanitizeOrder(order);
          throw err;
        }
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
      if (!t.finished) {
        await t.rollback().catch(() => {});
      }
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

    if (newStatus === 'confirmed' && order.orderStatus === 'pending_whatsapp') {
      const now = new Date();
      if (order.expiresAt && new Date(order.expiresAt) <= now) {
        if (order.inventoryTracked === true) {
          const items = Array.isArray(order.orders) ? order.orders : [];
          await restoreStock(items);
        }
        order.orderStatus = 'expired';
        order.inventoryTracked = false;
        order.status = false;
        const err = new Error('انتهت صلاحية حجز هذا الطلب (تجاوزت الـ 60 دقيقة) وأعيدت المنتجات للمخزون، لا يمكن تأكيده');
        err.statusCode = 409;
        err.order = sanitizeOrder(order);
        throw err;
      }
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
  isPayloadMatching,
  safeCompareTokens,
  createWhatsAppDraft,
  createWebOrder,
  getWhatsAppDraft,
  cancelOrExpireOrder,
  updateOrderStatus,
  cleanupExpiredDrafts,
  sanitizeOrder,
};
