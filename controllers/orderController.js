const db = require('../models');
const Order = db.order;
const orderService = require('../services/orderService');
const ROLES_LIST = require('../config/roles_list');

const parseOrders = (orders) => {
  if (!orders) return [];
  if (Array.isArray(orders) || typeof orders === 'object') return orders;
  if (typeof orders === 'string') {
    try {
      return JSON.parse(orders);
    } catch (e) {
      return orders;
    }
  }
  return orders;
};

const formatOrder = (order) => {
  if (!order) return order;
  const o = order.dataValues ? { ...order.dataValues } : { ...order };
  o.orders = parseOrders(o.orders);
  delete o.secretToken; // Never leak secretToken in public/authenticated list APIs
  return o;
};

const isUserAdminOrEditor = (req) => {
  if (!req || !req.roles) return false;
  const roles = Array.isArray(req.roles) ? req.roles : Object.values(req.roles);
  return roles.includes(ROLES_LIST.ADMIN) || roles.includes(ROLES_LIST.EDITOR);
};

/**
 * Returns orders:
 * - Admin/Editor sees all orders.
 * - Regular authenticated user ONLY sees their own orders.
 */
const getOrders = async (req, res) => {
  const userId = req.id;
  const isAdmin = isUserAdminOrEditor(req);

  if (!db.isConnected) {
    let list = db.mockData.mockOrders || [];
    if (!isAdmin) {
      list = list.filter((o) => o.userId == userId);
    }
    return res.status(200).send(list.map(formatOrder));
  }

  try {
    const whereClause = isAdmin ? {} : { userId };
    let orders = await Order.findAll({
      where: whereClause,
      order: [['id', 'DESC']],
    });
    let newOrders = (orders || []).map(formatOrder);
    res.status(200).send(newOrders);
  } catch (err) {
    res.status(400).json({ message: err?.message || err });
  }
};

/**
 * Returns a single order by ID.
 * Strict ownership check: only owner or admin can view.
 */
const getOrder = async (req, res) => {
  const id = req.params.id;
  const userId = req.id;
  const isAdmin = isUserAdminOrEditor(req);

  try {
    let order;
    if (db.isConnected) {
      order = await Order.findOne({ where: { id } });
    } else {
      order = (db.mockData.mockOrders || []).find((o) => o.id == id);
    }

    if (!order) {
      return res.status(404).json({ message: 'الطلب غير موجود' });
    }

    if (!isAdmin && order.userId != userId) {
      return res.status(403).json({ message: 'غير مصرح لك بعرض هذا الطلب' });
    }

    res.status(200).json(formatOrder(order));
  } catch (err) {
    res.status(400).json({ message: err?.message || err });
  }
};

/**
 * Creates authenticated in-app web order with stock reservation
 */
const addOrder = async (req, res) => {
  const userId = req.id;
  try {
    const rawItems = req.body.orders || req.body.items || [];
    const location = req.body.location || '';
    const customerName = req.body.customerName || '';
    const customerPhone = req.body.customerPhone || '';
    const idempotencyKey = req.body.idempotencyKey || req.headers['x-idempotency-key'] || null;

    const newOrder = await orderService.createWebOrder({
      userId,
      items: rawItems,
      location,
      customerName,
      customerPhone,
      idempotencyKey,
    });
    return res.status(201).json(formatOrder(newOrder));
  } catch (err) {
    if (err.name === 'InsufficientStockError' || err.statusCode === 409) {
      return res.status(409).json({
        message: err.message,
        details: err.details,
      });
    }
    return res.status(400).json({
      message: err?.message || 'تعذر إتمام الطلب',
    });
  }
};

/**
 * Creates WhatsApp draft reservation (Public, no login needed)
 * 60-minute reservation with row-level stock deduction
 */
const createWhatsAppDraftHandler = async (req, res) => {
  try {
    const { items, customerName, customerPhone, location } = req.body;
    const userId = req.id || null;
    const idempotencyKey = req.body.idempotencyKey || req.headers['x-idempotency-key'] || null;

    const result = await orderService.createWhatsAppDraft({
      items,
      customerName,
      customerPhone,
      location,
      userId,
      idempotencyKey,
    });

    return res.status(201).json({
      message: 'تم حجز المنتجات لمدة 60 دقيقة وإنشاء مسودة الطلب بنجاح',
      ...result,
    });
  } catch (err) {
    if (err.name === 'InsufficientStockError' || err.statusCode === 409) {
      return res.status(409).json({
        message: err.message,
        details: err.details,
      });
    }
    return res.status(400).json({
      message: err.message || 'حدث خطأ أثناء حجز المنتجات ومسودة الطلب',
    });
  }
};

/**
 * Retrieves WhatsApp draft by ID and Secret Token
 * Requires valid secretToken to prevent unauthorized draft inspection
 */
const getWhatsAppDraftHandler = async (req, res) => {
  try {
    const id = req.params.id;
    const token = req.query.token || req.headers['x-secret-token'];
    const draft = await orderService.getWhatsAppDraft(id, token);
    return res.status(200).json(formatOrder(draft));
  } catch (err) {
    return res.status(404).json({
      message: err.message || 'مسودة الطلب غير موجودة أو رمز الوصول غير صالح',
    });
  }
};

/**
 * Cancels WhatsApp draft reservation & releases reserved stock
 * Strictly requires secretToken
 */
const cancelWhatsAppDraftHandler = async (req, res) => {
  try {
    const id = req.params.id;
    const token = req.query.token || req.headers['x-secret-token'];
    const draft = await orderService.getWhatsAppDraft(id, token);
    const cancelled = await orderService.cancelOrExpireOrder(draft.id, 'cancelled');
    return res.status(200).json({
      message: 'تم إلغاء الحجز وإعادة الكميات للمخزون بنجاح',
      order: formatOrder(cancelled),
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message || 'تعذر إلغاء الحجز',
    });
  }
};

/**
 * Admin updates order status (pending_whatsapp -> confirmed -> delivered / cancelled)
 */
const adminUpdateStatusHandler = async (req, res) => {
  try {
    const id = req.params.id;
    const { status, orderStatus } = req.body;
    const targetStatus = orderStatus || status;
    const updated = await orderService.updateOrderStatus(id, targetStatus);
    return res.status(200).json({
      message: 'تم تحديث حالة الطلب بنجاح',
      order: formatOrder(updated),
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message || 'تعذر تحديث حالة الطلب',
    });
  }
};

/**
 * Admin general order update
 * If orderStatus or status is changed, strictly routes through state machine
 */
const updateOrder = async (req, res) => {
  const id = req.params.id;
  try {
    if (req.body.orderStatus) {
      const updated = await orderService.updateOrderStatus(id, req.body.orderStatus);
      return res.json(formatOrder(updated));
    }

    if (req.body.status !== undefined) {
      const target = req.body.status ? 'delivered' : 'confirmed';
      const updated = await orderService.updateOrderStatus(id, target);
      return res.json(formatOrder(updated));
    }

    if (!db.isConnected) {
      const index = (db.mockData.mockOrders || []).findIndex((o) => o.id == id);
      if (index === -1) {
        return res.status(404).json({ message: 'can not found this order!' });
      }
      db.mockData.mockOrders[index] = { ...db.mockData.mockOrders[index], ...req.body };
      return res.json(formatOrder(db.mockData.mockOrders[index]));
    }

    const foundedItem = await Order.findOne({ where: { id } });
    if (foundedItem) {
      await Order.update(req.body, { where: { id } });
      const order = await Order.findOne({ where: { id } });
      res.json(formatOrder(order));
    } else {
      res.status(404).json({ message: 'can not found this order!' });
    }
  } catch (err) {
    res.status(400).json({ message: err?.message || err });
  }
};

const deleteOrder = async (req, res) => {
  const id = req.params.id;
  try {
    // Release stock before deleting if pending or confirmed
    await orderService.cancelOrExpireOrder(id, 'cancelled').catch(() => {});

    if (!db.isConnected) {
      const index = (db.mockData.mockOrders || []).findIndex((o) => o.id == id);
      if (index === -1) {
        return res.status(404).json({ message: 'order is not found!' });
      }
      db.mockData.mockOrders.splice(index, 1);
      return res.status(200).json(Number(id));
    }

    const foundedItem = await Order.findOne({ where: { id } });
    if (foundedItem) {
      await Order.destroy({ where: { id } });
      res.status(200).json(Number(id));
    } else {
      res.status(404).json({ message: 'order is not found!' });
    }
  } catch (err) {
    res.status(400).json({ message: err?.message || err });
  }
};

/**
 * Authenticated user cancels their own order
 * Non-admins can NEVER cancel an order belonging to another user or a guest
 */
const cancelOrder = async (req, res) => {
  const orderId = req.params.id;
  const userId = req.id;
  const isAdmin = isUserAdminOrEditor(req);

  try {
    let order;
    if (db.isConnected) {
      order = await Order.findOne({ where: { id: orderId } });
    } else {
      order = (db.mockData.mockOrders || []).find((o) => o.id == orderId);
    }

    if (!order) {
      return res.status(404).json({ message: 'الطلب غير موجود' });
    }

    // Only order owner or admin can cancel
    if (!isAdmin && order.userId != userId) {
      return res.status(403).json({ message: 'غير مصرح لك بإلغاء هذا الطلب' });
    }

    const cancelled = await orderService.cancelOrExpireOrder(orderId, 'cancelled');
    return res.status(200).json(formatOrder(cancelled));
  } catch (err) {
    res.status(400).json({ message: err?.message || err });
  }
};

module.exports = {
  addOrder,
  getOrders,
  getOrder,
  updateOrder,
  deleteOrder,
  cancelOrder,
  createWhatsAppDraftHandler,
  getWhatsAppDraftHandler,
  cancelWhatsAppDraftHandler,
  adminUpdateStatusHandler,
};
