const {
  Op
} = require('sequelize');
const db = require('../models');
const Product = db.products;
const { inventoryService } = require('../services/inventoryService');
const ROLES_LIST = require('../config/roles_list');

const isStaffRequest = (req) => {
  if (!req || !req.roles) return false;
  const roles = Array.isArray(req.roles) ? req.roles : (typeof req.roles === 'object' ? Object.values(req.roles) : [req.roles]);
  const numRoles = roles.map(Number);
  return numRoles.includes(ROLES_LIST.ADMIN) || numRoles.includes(ROLES_LIST.EDITOR);
};

const parseImages = (images) => {
  if (!images) return [];
  if (Array.isArray(images)) return images;
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      return [images];
    }
  }
  return [images];
};

const formatProduct = (product, isStaff = false) => {
  if (!product) return product;
  const p = product.dataValues ? { ...product.dataValues } : { ...product };
  p.images = parseImages(p.images);
  p.stock = typeof p.stock === 'number' ? p.stock : 25;

  // Keep purchasing & physical inventory valuation private from non-admin/editor users
  if (!isStaff) {
    delete p.unitCost;
    delete p.physicalStock;
    delete p.reservedStock;
    delete p.isArchived;
  }
  return p;
};

const getProducts = async (req, res) => {
  const isStaff = isStaffRequest(req);
  const {
    name_like,
    categoryId
  } = req.query;

  if (!db.isConnected) {
    let prods = (db.mockData.mockProducts || []).map((p) => formatProduct(p, isStaff));
    if (categoryId) {
      prods = prods.filter(p => p.categoryId == categoryId);
    }
    if (name_like) {
      prods = prods.filter(p => p.name.includes(name_like));
    }
    return res.status(200).send(prods);
  }

  try {
    const where = { isArchived: false };
    if (name_like) {
      where.name = { [Op.substring]: name_like };
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }

    const products = await Product.findAll({ where });
    const newProducts = (products || []).map((p) => formatProduct(p, isStaff));
    res.status(200).send(newProducts);
  } catch (err) {
    res.status(400).json({
      message: err?.message || err
    });
  }
};

const addProduct = async (req, res) => {
  let stock = 0;
  if (req.body?.stock !== undefined && req.body?.stock !== null && req.body?.stock !== '') {
    const parsedStock = parseInt(req.body.stock, 10);
    if (!isNaN(parsedStock) && parsedStock >= 0) {
      stock = parsedStock;
    }
  }

  let info = {
    name: req.body?.name,
    description: req.body?.description,
    price: req.body?.price,
    images: req.body?.images,
    prevPrice: req.body?.prevPrice, 
    stars: req.body?.stars,
    categoryId: req.body?.categoryId,
    published: req.body?.published !== undefined ? req.body.published : false,
    stock,
    physicalStock: stock,
    reservedStock: 0,
    unitCost: req.body?.unitCost != null ? Number(req.body.unitCost) : null,
    isArchived: false,
  };
  try {
    const product = await Product.create(info);
    if (db.isConnected && db.StockMovement && stock > 0) {
      await db.StockMovement.create({
        productId: product.id,
        movementType: 'opening_balance',
        quantity: stock,
        unitCost: info.unitCost,
        totalCost: info.unitCost != null ? Number((stock * info.unitCost).toFixed(2)) : null,
        physicalBefore: 0,
        physicalAfter: stock,
        reservedBefore: 0,
        reservedAfter: 0,
        availableBefore: 0,
        availableAfter: stock,
        unitCostBefore: null,
        unitCostAfter: info.unitCost,
        notes: 'رصيد افتتاحي عند إضافة المنتج',
      }).catch(() => {});
    }
    res.status(201).json(formatProduct(product, true));
  } catch (err) {
    res.status(400).json({
      message: err?.message || err
    });
  }
};

const updateProduct = async (req, res) => {
  const id = req.params.id;
  try {
    const foundedItem = await Product.findOne({
      where: {
        id
      }
    });
    if (!foundedItem) {
      return res.status(404).json({
        message: `can not found this Product!`
      });
    }

    // Only allow updating general attributes; stock is strictly protected from stale overwrite
    const allowedFields = ['name', 'description', 'price', 'prevPrice', 'images', 'stars', 'categoryId', 'published'];
    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    await Product.update(updateData, {
      where: {
        id
      }
    });
    const product = await Product.findOne({
      where: {
        id
      }
    });
    res.json(formatProduct(product));
  } catch (err) {
    res.status(400).json({
      message: err?.message || err
    });
  }
};

const isStrictInteger = (val) => {
  if (typeof val === 'number') return Number.isInteger(val);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!/^[-+]?\d+$/.test(trimmed)) return false;
    const num = Number(trimmed);
    return Number.isSafeInteger(num);
  }
  return false;
};

/**
 * Dedicated inventory adjustment endpoint
 * Strictly atomic: uses transaction row locking (t.LOCK.UPDATE) matching orderService
 * Rejects non-integers, enforces expectedStock on absolute updates, and rejects negative stock on deltas
 */
const updateProductStock = async (req, res) => {
  const isStaff = isStaffRequest(req);
  const id = req.params.id;
  try {
    const { stock, delta, expectedStock, unitCost, notes } = req.body;

    if (delta !== undefined && stock !== undefined) {
      return res.status(400).json({ message: 'يرجى إرسال إما التغيير النسبي (delta) أو المخزون المطلق (stock) وليس كلاهما' });
    }

    if (delta !== undefined) {
      if (!isStrictInteger(delta)) {
        return res.status(400).json({ message: 'قيمة التغيير النسبي (delta) يجب أن تكون رقماً صحيحاً' });
      }
      const deltaNum = Number(delta);
      if (deltaNum === 0) {
        return res.status(400).json({ message: 'قيمة التغيير النسبي يجب ألا تكون صفراً' });
      }

      if (db.isConnected) {
        return await db.sequelize.transaction(async (t) => {
          if (deltaNum > 0) {
            const result = await inventoryService.receiveStock({
              productId: id,
              quantity: deltaNum,
              unitCost,
              userId: req.user,
              notes: notes || 'تحديث المخزون (إضافة)',
              transaction: t,
            });
            return res.json(formatProduct(result.product, isStaff));
          } else {
            // Negative delta adjustment under atomic lock
            const item = await Product.findByPk(id, {
              lock: t.LOCK.UPDATE,
              transaction: t,
            });
            if (!item) {
              const err = new Error('المنتج غير موجود');
              err.statusCode = 404;
              throw err;
            }
            const curPhys = Number(item.physicalStock) || 0;
            const resv = Number(item.reservedStock) || 0;
            const newPhys = curPhys + deltaNum;
            if (newPhys < resv) {
              const err = new Error(`لا يمكن خفض المخزون لأقل من الكميات المحجوزة حالياً (${resv} قطعة)`);
              err.statusCode = 400;
              throw err;
            }
            const result = await inventoryService.adjustStock({
              productId: id,
              newPhysical: newPhys,
              reason: notes || `تعديل نسبي للمخزون (${deltaNum})`,
              userId: req.user,
              transaction: t,
            });
            return res.json(formatProduct(result.product, isStaff));
          }
        });
      } else {
        const item = (db.mockData?.mockProducts || []).find((p) => Number(p.id) === Number(id));
        if (!item) return res.status(404).json({ message: 'المنتج غير موجود' });
        const currentStock = item.stock !== undefined && item.stock !== null ? Number(item.stock) : 0;
        const newStock = currentStock + deltaNum;
        if (newStock < 0) {
          return res.status(400).json({ message: `لا يمكن أن يصبح المخزون سالباً: المخزون الحالي ${currentStock} والتغيير المطلوب ${deltaNum}` });
        }
        item.stock = newStock;
        return res.json(formatProduct(item, isStaff));
      }
    }

    if (stock !== undefined && stock !== null && stock !== '') {
      if (!isStrictInteger(stock) || Number(stock) < 0) {
        return res.status(400).json({ message: 'يجب أن يكون المخزون عدداً صحيحاً أكبر من أو يساوي الصفر' });
      }

      if (expectedStock === undefined || expectedStock === null || !isStrictInteger(expectedStock) || Number(expectedStock) < 0) {
        return res.status(400).json({ message: 'expectedStock مطلوب ويجب أن يكون رقماً صحيحاً غير سالب عند التعديل المطلق' });
      }

      const targetStock = Number(stock);
      const expStock = Number(expectedStock);

      if (db.isConnected) {
        return await db.sequelize.transaction(async (t) => {
          const item = await Product.findByPk(id, {
            lock: t.LOCK.UPDATE,
            transaction: t,
          });
          if (!item) {
            const err = new Error('المنتج غير موجود');
            err.statusCode = 404;
            throw err;
          }

          const currentAvailable = item.stock !== undefined && item.stock !== null ? Number(item.stock) : 0;
          if (currentAvailable !== expStock) {
            const conflictErr = new Error(
              `تعارض في تحديث المخزون: تغير المخزون في هذه الأثناء ليصبح ${currentAvailable} قطعة بدلاً من ${expStock}`
            );
            conflictErr.statusCode = 409;
            conflictErr.currentStock = currentAvailable;
            throw conflictErr;
          }

          const reserved = Number(item.reservedStock) || 0;
          const targetPhysical = targetStock + reserved;

          const result = await inventoryService.adjustStock({
            productId: id,
            newPhysical: targetPhysical,
            expectedStock: expStock,
            reason: notes || `تسوية جردية للمخزون المتاح إلى ${targetStock} قطعة`,
            userId: req.user,
            transaction: t,
          });

          return res.json(formatProduct(result.product, isStaff));
        });
      } else {
        const item = (db.mockData?.mockProducts || []).find((p) => Number(p.id) === Number(id));
        if (!item) return res.status(404).json({ message: 'المنتج غير موجود' });
        const currentStock = item.stock !== undefined && item.stock !== null ? Number(item.stock) : 0;
        if (currentStock !== expStock) {
          return res.status(409).json({
            message: `تعارض في تحديث المخزون: تغير المخزون في هذه الأثناء ليصبح ${currentStock} قطعة بدلاً من ${expStock}`,
            currentStock,
          });
        }
        item.stock = targetStock;
        return res.json(formatProduct(item, isStaff));
      }
    }

    return res.status(400).json({ message: 'يرجى تحديد قيمة المخزون الجديدة أو التغيير النسبي' });
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      message: err.message || err,
      ...(err.currentStock !== undefined ? { currentStock: err.currentStock } : {}),
    });
  }
};

const deleteProduct = async (req, res) => {
  const id = req.params.id;
  try {
    const foundedItem = await Product.findOne({
      where: {
        id
      }
    });
    if (foundedItem) {
      await foundedItem.update({
        isArchived: true,
        published: false,
      });
      res.status(200).json({
        message: 'Product is deleted!'
      });
    } else {
      res.status(404).json({
        message: 'Product is not found!'
      });
    }
  } catch (err) {
    res.status(400).json({
      message: err?.message || err
    });
  }
};

const getProduct = async (req, res) => {
  const isStaff = isStaffRequest(req);
  const id = req.params.id;
  if (!db.isConnected) {
    const p = db.mockData.mockProducts.find(item => item.id == id && !item.isArchived);
    if (!p) {
      return res.status(404).json({ message: 'Product not found' });
    }
    return res.status(200).json(formatProduct(p, isStaff));
  }
  try {
    let product = await Product.findOne({
      where: {
        id: id,
        isArchived: false,
      }
    });
    if (!product) {
      return res.status(404).json({
        message: 'Product not found'
      });
    }
    res.status(200).json(formatProduct(product, isStaff));
  } catch (err) {
    res.status(400).json({
      message: err?.message || err
    });
  }
};

const getPublishedProducts = async (req, res) => {
  const isStaff = isStaffRequest(req);
  if (!db.isConnected) {
    return res.status(200).json((db.mockData.mockProducts || []).filter(p => p.published && !p.isArchived).map(p => formatProduct(p, isStaff)));
  }
  try {
    let products = await Product.findAll({
      where: {
        published: true,
        isArchived: false,
      }
    });
    const newProducts = (products || []).map(p => formatProduct(p, isStaff));
    res.status(200).json(newProducts);
  } catch (err) {
    res.status(400).json({
      message: err?.message || err
    });
  }
};

module.exports = {
  addProduct,
  getProducts,
  getProduct,
  updateProduct,
  updateProductStock,
  deleteProduct,
  getPublishedProducts
};
