const { Op } = require('sequelize');
const db = require('../models');
const { inventoryService } = require('../services/inventoryService');

const getOverview = async (req, res) => {
  try {
    const overview = await inventoryService.getOverviewMetrics();
    res.status(200).json(overview);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || 'تعذر تحميل مؤشرات المستودع' });
  }
};

const getInventoryProducts = async (req, res) => {
  try {
    const { search, categoryId, lowStock } = req.query;
    const where = { isArchived: false };

    if (search && search.trim()) {
      where.name = { [Op.substring]: search.trim() };
    }
    if (categoryId) {
      where.categoryId = Number(categoryId);
    }
    if (lowStock === 'true' || lowStock === true) {
      where.stock = { [Op.lte]: 5 };
    }

    const products = await db.Product.findAll({
      where,
      order: [['id', 'ASC']],
      include: [{ model: db.Category, as: 'category', attributes: ['id', 'name'] }],
    });

    const formatted = products.map((p) => {
      const plain = p.get({ plain: true });
      const avail = Number(plain.stock) || 0;
      const phys = Number(plain.physicalStock) || 0;
      const resv = Number(plain.reservedStock) || 0;
      const cost = plain.unitCost != null ? Number(plain.unitCost) : null;
      const valuation = cost != null ? Number((phys * cost).toFixed(2)) : null;

      let images = [];
      if (plain.images) {
        try {
          images = typeof plain.images === 'string' ? JSON.parse(plain.images) : plain.images;
          if (!Array.isArray(images)) images = [images];
        } catch {
          images = [plain.images];
        }
      }

      return {
        id: plain.id,
        name: plain.name,
        images,
        price: Number(plain.price) || 0,
        availableStock: avail,
        physicalStock: phys,
        reservedStock: resv,
        unitCost: cost,
        valuation,
        published: Boolean(plain.published),
        category: plain.category,
      };
    });

    res.status(200).json(formatted);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || 'تعذر تحميل قائمة المخزون' });
  }
};

const receiveStockHandler = async (req, res) => {
  try {
    const { productId, quantity, unitCost, notes } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey || null;
    if (!productId) {
      return res.status(400).json({ message: 'معرف المنتج مطلوب' });
    }

    const result = await inventoryService.receiveStock({
      productId: Number(productId),
      quantity,
      unitCost,
      userId: req.id || null,
      notes,
      idempotencyKey,
    });

    res.status(200).json({
      message: result.replayed ? 'تم استرجاع عملية التوريد المعتمدة مسبقاً' : 'تم استلام وتوريد المخزون بنجاح',
      product: result.product,
      movement: result.movement,
      replayed: Boolean(result.replayed),
    });
  } catch (err) {
    res.status(err.statusCode || 400).json({ message: err.message || 'فشل في استلام المخزون' });
  }
};

const adjustStockHandler = async (req, res) => {
  try {
    const { productId, newPhysical, reason, expectedStock } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey || null;
    if (!productId) {
      return res.status(400).json({ message: 'معرف المنتج مطلوب' });
    }

    const result = await inventoryService.adjustStock({
      productId: Number(productId),
      newPhysical,
      reason,
      expectedStock,
      userId: req.id || null,
      idempotencyKey,
    });

    res.status(200).json({
      message: result.replayed ? 'تم استرجاع نتيجة التسوية الجردية مسبقاً' : 'تمت التسوية الجردية بنجاح',
      product: result.product,
      movement: result.movement,
      replayed: Boolean(result.replayed),
    });
  } catch (err) {
    res.status(err.statusCode || 400).json({ message: err.message || 'فشلت التسوية الجردية' });
  }
};

const getStockMovementsHandler = async (req, res) => {
  try {
    const { productId, movementType, orderCode, limit = 50, offset = 0 } = req.query;
    const where = {};

    if (productId) where.productId = Number(productId);
    if (movementType) where.movementType = movementType;
    if (orderCode && orderCode.trim()) {
      where.orderCode = { [Op.substring]: orderCode.trim() };
    }

    const movements = await db.StockMovement.findAndCountAll({
      where,
      order: [['id', 'DESC']],
      limit: Math.min(Number(limit) || 50, 100),
      offset: Number(offset) || 0,
      include: [
        { model: db.Product, as: 'product', attributes: ['id', 'name', 'images'] },
        { model: db.User, as: 'createdByUser', attributes: ['id', 'name'] },
      ],
    });

    res.status(200).json({
      total: movements.count,
      rows: movements.rows,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || 'تعذر تحميل حركات المخزون' });
  }
};

const getProfitabilityReportHandler = async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    let start = null;
    let end = null;
    const now = new Date();

    if (period === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (period === 'week') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      end = now;
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = now;
    } else if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    }

    const report = await inventoryService.getProfitabilityReport({
      startDate: start,
      endDate: end,
    });

    res.status(200).json(report);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || 'تعذر إنشاء تقرير الأرباح' });
  }
};

module.exports = {
  getOverview,
  getInventoryProducts,
  receiveStockHandler,
  adjustStockHandler,
  getStockMovementsHandler,
  getProfitabilityReportHandler,
};
