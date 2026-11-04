const db = require('../models');
const {
  calculateWeightedAverageCost,
  calculateWacOnReturn,
  calculateProfitabilitySummary,
} = require('../utils/inventoryMath');

/**
 * Transactional Inventory Service managing physical, reserved, and available stock
 * and append-only audit trail movements.
 */
const createInventoryService = (injectedDb = db) => {
  const { Product, Order, StockMovement, sequelize, Sequelize } = injectedDb;

  /**
   * Helper to execute within a given transaction or create a new managed one
   */
  const withTx = async (tx, fn) => {
    if (tx) return fn(tx);
    return sequelize.transaction(fn);
  };

  /**
   * 1. Receive Stock (توريد / استلام بضاعة)
   * Primary merchant action: increases physical & available stock, updates moving WAC.
   * Strictly idempotent via idempotencyKey.
   */
  const receiveStock = async ({
    productId,
    quantity,
    unitCost = null,
    userId = null,
    notes = '',
    idempotencyKey = null,
    transaction = null,
  }) => {
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      const err = new Error('الكمية المستلمة يجب أن تكون عدداً صحيحاً أكبر من الصفر');
      err.statusCode = 400;
      throw err;
    }

    let parsedCost = null;
    if (unitCost !== null && unitCost !== undefined && unitCost !== '') {
      parsedCost = Number(unitCost);
      if (isNaN(parsedCost) || parsedCost < 0) {
        const err = new Error('سعر الشراء للوحدة يجب أن يكون رقماً غير سالب');
        err.statusCode = 400;
        throw err;
      }
      parsedCost = Number(parsedCost.toFixed(2));
    }

    return withTx(transaction, async (t) => {
      const product = await Product.findByPk(productId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!product) {
        const err = new Error('المنتج غير موجود');
        err.statusCode = 404;
        throw err;
      }

      // Idempotency check: replay previous result if identical request received
      if (idempotencyKey) {
        const existingMovement = await StockMovement.findOne({
          where: { idempotencyKey },
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (existingMovement) {
          const isSamePayload =
            existingMovement.movementType === 'receipt' &&
            existingMovement.productId === Number(productId) &&
            existingMovement.quantity === qty &&
            (existingMovement.unitCost == null ? null : Number(existingMovement.unitCost)) === parsedCost;

          if (isSamePayload) {
            return {
              product: product.get({ plain: true }),
              movement: existingMovement.get({ plain: true }),
              replayed: true,
            };
          } else {
            const conflictErr = new Error('مفتاح الطلب (idempotencyKey) مستخدم مسبقاً لعملية توريد مختلفة');
            conflictErr.statusCode = 409;
            throw conflictErr;
          }
        }
      }

      const physBefore = Number(product.physicalStock) || 0;
      const resBefore = Number(product.reservedStock) || 0;
      const availBefore = Number(product.stock) || 0;
      const costBefore = product.unitCost != null ? Number(product.unitCost) : null;

      const costAfter = calculateWeightedAverageCost(physBefore, costBefore, qty, parsedCost);
      const physAfter = physBefore + qty;
      const availAfter = availBefore + qty;

      await product.update(
        {
          physicalStock: physAfter,
          stock: availAfter, // availableStock preserved on Product.stock
          unitCost: costAfter,
        },
        { transaction: t }
      );

      const totalMovementCost = parsedCost !== null ? Number((qty * parsedCost).toFixed(2)) : null;

      const movement = await StockMovement.create(
        {
          productId: product.id,
          movementType: 'receipt',
          quantity: qty,
          unitCost: parsedCost,
          totalCost: totalMovementCost,
          physicalBefore: physBefore,
          physicalAfter: physAfter,
          reservedBefore: resBefore,
          reservedAfter: resBefore,
          availableBefore: availBefore,
          availableAfter: availAfter,
          unitCostBefore: costBefore,
          unitCostAfter: costAfter,
          orderId: null,
          orderCode: null,
          createdByUserId: userId,
          notes: notes || `استلام توريد: +${qty} قطعة بسعر شراء ${parsedCost != null ? parsedCost + ' ₪' : 'غير محدد'}`,
          idempotencyKey: idempotencyKey || null,
        },
        { transaction: t }
      );

      return {
        product: product.get({ plain: true }),
        movement: movement.get({ plain: true }),
      };
    });
  };

  /**
   * 2. Reserve Stock for Order (حجز بضاعة لطلب جديد)
   * Decrements available stock, increments reserved stock; physical stock unchanged.
   */
  const reserveStockForOrder = async ({ items, orderId = null, orderCode = null, transaction = null }) => {
    if (!items || !items.length) return [];

    return withTx(transaction, async (t) => {
      const movements = [];

      for (const item of items) {
        const pId = Number(item.productId || item.id);
        const qty = Number(item.quantity || item.count) || 1;
        if (!pId || qty <= 0) continue;

        const product = await Product.findByPk(pId, {
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (!product) {
          throw new Error(`المنتج رقم #${pId} غير موجود`);
        }

        const physBefore = Number(product.physicalStock) || 0;
        const resBefore = Number(product.reservedStock) || 0;
        const availBefore = Number(product.stock) || 0;
        const costVal = product.unitCost != null ? Number(product.unitCost) : null;

        const resAfter = resBefore + qty;
        const availAfter = availBefore - qty;

        await product.update(
          {
            reservedStock: resAfter,
            stock: availAfter,
          },
          { transaction: t }
        );

        const movement = await StockMovement.create(
          {
            productId: product.id,
            movementType: 'reservation',
            quantity: -qty,
            unitCost: costVal,
            totalCost: costVal != null ? Number((qty * costVal).toFixed(2)) : null,
            physicalBefore: physBefore,
            physicalAfter: physBefore, // physical stock unchanged on reservation!
            reservedBefore: resBefore,
            reservedAfter: resAfter,
            availableBefore: availBefore,
            availableAfter: availAfter,
            unitCostBefore: costVal,
            unitCostAfter: costVal,
            orderId,
            orderCode,
            createdByUserId: null,
            notes: `حجز للطلب ${orderCode || ''}: ${qty} قطعة`,
          },
          { transaction: t }
        );

        movements.push(movement.get({ plain: true }));
      }

      return movements;
    });
  };

  /**
   * 3. Release Order Reservation (فك حجز طلب ملغي أو منتهي الصلاحية)
   * Decrements reserved stock, restores available stock; physical stock unchanged.
   */
  const releaseOrderReservation = async ({ order, transaction = null }) => {
    if (!order) return [];

    let items = order.orders;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch { items = []; }
    }
    if (!Array.isArray(items) || items.length === 0) return [];

    return withTx(transaction, async (t) => {
      const movements = [];

      for (const item of items) {
        const pId = Number(item.productId || item.id);
        const qty = Number(item.quantity || item.count) || 1;
        if (!pId || qty <= 0) continue;

        const product = await Product.findByPk(pId, {
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (!product) continue;

        const physBefore = Number(product.physicalStock) || 0;
        const resBefore = Number(product.reservedStock) || 0;
        const availBefore = Number(product.stock) || 0;
        const costVal = product.unitCost != null ? Number(product.unitCost) : null;

        const resAfter = Math.max(0, resBefore - qty);
        const availAfter = availBefore + qty;

        await product.update(
          {
            reservedStock: resAfter,
            stock: availAfter,
          },
          { transaction: t }
        );

        const movement = await StockMovement.create(
          {
            productId: product.id,
            movementType: 'reservation_release',
            quantity: qty,
            unitCost: costVal,
            totalCost: costVal != null ? Number((qty * costVal).toFixed(2)) : null,
            physicalBefore: physBefore,
            physicalAfter: physBefore,
            reservedBefore: resBefore,
            reservedAfter: resAfter,
            availableBefore: availBefore,
            availableAfter: availAfter,
            unitCostBefore: costVal,
            unitCostAfter: costVal,
            orderId: order.id,
            orderCode: order.orderCode,
            createdByUserId: null,
            notes: `تحرير حجز للطلب ${order.orderCode || ''}: +${qty} للمتاح`,
          },
          { transaction: t }
        );

        movements.push(movement.get({ plain: true }));
      }

      return movements;
    });
  };

  /**
   * 4. Deliver Order (تسليم الطلب وتحويله إلى مبيع نهائي)
   * Converts reservation into an actual sale:
   * Decrements physical stock and reserved stock. Available stock is NOT deducted twice!
   * Snapshots unitCost and COGS idempotently. Fails closed on insufficient quantities.
   */
  const deliverOrder = async ({ orderId, userId = null, transaction = null }) => {
    return withTx(transaction, async (t) => {
      const order = await Order.findByPk(orderId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!order) {
        const err = new Error('الطلب غير موجود');
        err.statusCode = 404;
        throw err;
      }

      // Idempotency check: if already delivered or costs snapshotted, return early safely
      if (order.orderStatus === 'delivered' || order.costSnapshotted) {
        return order.get({ plain: true });
      }

      if (order.orderStatus === 'cancelled' || order.orderStatus === 'expired') {
        const err = new Error('لا يمكن تسليم طلب ملغي أو منتهي الصلاحية');
        err.statusCode = 400;
        throw err;
      }

      let items = order.orders;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = []; }
      }

      let orderTotalCOGS = 0;
      let hasUnknown = false;
      const snapshottedItems = [];

      for (const item of items) {
        const pId = Number(item.productId || item.id);
        const qty = Number(item.quantity || item.count) || 1;
        const price = Number(item.price) || 0;

        const product = await Product.findByPk(pId, {
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (!product) {
          throw new Error(`تعذر تسليم الطلب: المنتج رقم #${pId} غير موجود`);
        }

        const physBefore = Number(product.physicalStock) || 0;
        const resBefore = Number(product.reservedStock) || 0;
        const availBefore = Number(product.stock) || 0;
        const unitCost = product.unitCost != null ? Number(product.unitCost) : null;

        // Blocker 7: Fail closed instead of clamping!
        if (physBefore < qty || resBefore < qty) {
          const err = new Error(
            `تعذر تسليم الطلب: رصيد المخزون الفعلي (${physBefore}) أو المحجوز (${resBefore}) للمنتج #${pId} غير كافٍ لتسليم ${qty} قطعة`
          );
          err.statusCode = 400;
          throw err;
        }

        const physAfter = physBefore - qty;
        const resAfter = resBefore - qty;
        // Available stock remains availBefore! (Not deducted twice).

        await product.update(
          {
            physicalStock: physAfter,
            reservedStock: resAfter,
          },
          { transaction: t }
        );

        let itemCOGS = null;
        let itemProfit = null;

        if (unitCost !== null) {
          itemCOGS = Number((unitCost * qty).toFixed(2));
          orderTotalCOGS += itemCOGS;
          itemProfit = Number(((price * qty) - itemCOGS).toFixed(2));
        } else {
          hasUnknown = true;
        }

        snapshottedItems.push({
          ...item,
          productId: product.id,
          name: product.name,
          price,
          quantity: qty,
          lineTotal: Number((price * qty).toFixed(2)),
          unitCost,
          itemCOGS,
          itemGrossProfit: itemProfit,
        });

        await StockMovement.create(
          {
            productId: product.id,
            movementType: 'delivery',
            quantity: -qty,
            unitCost,
            totalCost: itemCOGS,
            physicalBefore: physBefore,
            physicalAfter: physAfter,
            reservedBefore: resBefore,
            reservedAfter: resAfter,
            availableBefore: availBefore,
            availableAfter: availBefore,
            unitCostBefore: unitCost,
            unitCostAfter: unitCost,
            orderId: order.id,
            orderCode: order.orderCode,
            createdByUserId: userId,
            notes: `تسليم مبيعات للطلب ${order.orderCode || ''}: -${qty} قطعة من المخزون الفعلي`,
          },
          { transaction: t }
        );
      }

      await order.update(
        {
          orderStatus: 'delivered',
          status: true,
          costSnapshotted: true,
          totalPurchaseCost: hasUnknown ? null : Number(orderTotalCOGS.toFixed(2)),
          hasUnknownCost: hasUnknown,
          deliveredAt: new Date(),
          orders: snapshottedItems,
        },
        { transaction: t }
      );

      return order.get({ plain: true });
    });
  };

  /**
   * 5. Return Delivered Order (إرجاع طلب مسلّم)
   * Separate audited return flow: restores physical & available stock,
   * recalculates moving WAC with original purchase cost, and records 'return' movement.
   */
  const returnDeliveredOrder = async ({ orderId, reason = '', userId = null, transaction = null }) => {
    return withTx(transaction, async (t) => {
      const order = await Order.findByPk(orderId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!order) {
        const err = new Error('الطلب غير موجود');
        err.statusCode = 404;
        throw err;
      }

      if (order.orderStatus !== 'delivered') {
        const err = new Error('يمكن إرجاع الطلبات المسلّمة فقط');
        err.statusCode = 400;
        throw err;
      }

      let items = order.orders;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = []; }
      }

      for (const item of items) {
        const pId = Number(item.productId || item.id);
        const qty = Number(item.quantity || item.count) || 1;
        const snapshottedCost = item.unitCost != null ? Number(item.unitCost) : null;

        const product = await Product.findByPk(pId, {
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (!product) continue;

        const physBefore = Number(product.physicalStock) || 0;
        const resBefore = Number(product.reservedStock) || 0;
        const availBefore = Number(product.stock) || 0;
        const curCost = product.unitCost != null ? Number(product.unitCost) : null;

        const physAfter = physBefore + qty;
        const availAfter = availBefore + qty;

        // Blocker 4: Recalculate WAC on return
        const costAfter = calculateWacOnReturn(physBefore, curCost, qty, snapshottedCost);

        await product.update(
          {
            physicalStock: physAfter,
            stock: availAfter,
            unitCost: costAfter,
          },
          { transaction: t }
        );

        const totalCost = snapshottedCost !== null ? Number((qty * snapshottedCost).toFixed(2)) : null;

        await StockMovement.create(
          {
            productId: product.id,
            movementType: 'return',
            quantity: qty,
            unitCost: snapshottedCost,
            totalCost,
            physicalBefore: physBefore,
            physicalAfter: physAfter,
            reservedBefore: resBefore,
            reservedAfter: resBefore,
            availableBefore: availBefore,
            availableAfter: availAfter,
            unitCostBefore: curCost,
            unitCostAfter: costAfter,
            orderId: order.id,
            orderCode: order.orderCode,
            createdByUserId: userId,
            notes: `إرجاع مبيعات للطلب ${order.orderCode || ''}: ${reason || 'إرجاع للعميل'}`,
          },
          { transaction: t }
        );
      }

      await order.update(
        {
          orderStatus: 'returned',
          returnedAt: new Date(),
          returnReason: reason || 'طلب مرتجع',
        },
        { transaction: t }
      );

      return order.get({ plain: true });
    });
  };

  /**
   * 6. Audited Stock Adjustment (تسوية جردية لمخزون المنتج)
   * Strictly enforces physicalStock >= reservedStock and verifies expectedStock atomically.
   */
  const adjustStock = async ({
    productId,
    newPhysical,
    reason,
    userId = null,
    expectedStock = undefined,
    idempotencyKey = null,
    transaction = null,
  }) => {
    const targetPhys = Number(newPhysical);
    if (!Number.isInteger(targetPhys) || targetPhys < 0) {
      const err = new Error('الكمية الفعلية الجديدة يجب أن تكون عدداً صحيحاً أكبر من أو يساوي الصفر');
      err.statusCode = 400;
      throw err;
    }

    if (!reason || !reason.trim()) {
      const err = new Error('سبب التسوية الجردية مطلوب');
      err.statusCode = 400;
      throw err;
    }

    return withTx(transaction, async (t) => {
      if (idempotencyKey) {
        const existingMovement = await StockMovement.findOne({
          where: { idempotencyKey },
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (existingMovement) {
          const product = await Product.findByPk(productId, { transaction: t });
          return {
            product: product.get({ plain: true }),
            movement: existingMovement.get({ plain: true }),
            replayed: true,
          };
        }
      }

      const product = await Product.findByPk(productId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!product) {
        const err = new Error('المنتج غير موجود');
        err.statusCode = 404;
        throw err;
      }

      const physBefore = Number(product.physicalStock) || 0;
      const resBefore = Number(product.reservedStock) || 0;
      const availBefore = Number(product.stock) || 0;
      const curCost = product.unitCost != null ? Number(product.unitCost) : null;

      // Blocker 6: Atomic expectedStock validation under lock
      if (expectedStock !== undefined && expectedStock !== null) {
        const expNum = Number(expectedStock);
        if (availBefore !== expNum) {
          const conflictErr = new Error(
            `تعارض في تحديث المخزون: تغير المخزون في هذه الأثناء ليصبح ${availBefore} قطعة بدلاً من ${expNum}`
          );
          conflictErr.statusCode = 409;
          conflictErr.currentStock = availBefore;
          throw conflictErr;
        }
      }

      // Blocker 7: Reject setting physical count below active reservations
      if (targetPhys < resBefore) {
        const err = new Error(
          `لا يمكن تعديل المخزون الفعلي إلى (${targetPhys}) لأنه أقل من الكمية المحجوزة لطلبات نشطة (${resBefore} قطعة)`
        );
        err.statusCode = 400;
        throw err;
      }

      const deltaPhysical = targetPhys - physBefore;
      if (deltaPhysical === 0) {
        return { product: product.get({ plain: true }), delta: 0 };
      }

      // Strict invariant: available = physical - reserved
      const availAfter = targetPhys - resBefore;

      await product.update(
        {
          physicalStock: targetPhys,
          stock: availAfter,
        },
        { transaction: t }
      );

      const movement = await StockMovement.create(
        {
          productId: product.id,
          movementType: 'adjustment',
          quantity: deltaPhysical,
          unitCost: curCost,
          totalCost: curCost != null ? Number((Math.abs(deltaPhysical) * curCost).toFixed(2)) : null,
          physicalBefore: physBefore,
          physicalAfter: targetPhys,
          reservedBefore: resBefore,
          reservedAfter: resBefore,
          availableBefore: availBefore,
          availableAfter: availAfter,
          unitCostBefore: curCost,
          unitCostAfter: curCost,
          orderId: null,
          orderCode: null,
          createdByUserId: userId,
          notes: `تسوية جردية: ${reason.trim()} (${deltaPhysical > 0 ? '+' : ''}${deltaPhysical} قطعة)`,
          idempotencyKey: idempotencyKey || null,
        },
        { transaction: t }
      );

      return {
        product: product.get({ plain: true }),
        movement: movement.get({ plain: true }),
      };
    });
  };

  /**
   * 7. Overview Dashboard Metrics (نظرة عامة على المستودع)
   */
  const getOverviewMetrics = async () => {
    const products = await Product.findAll({
      where: { isArchived: false },
      attributes: ['id', 'name', 'stock', 'physicalStock', 'reservedStock', 'unitCost'],
    });

    let totalAvailable = 0;
    let totalReserved = 0;
    let totalPhysical = 0;
    let totalValuation = 0;
    let productsWithValuation = 0;
    let lowStockCount = 0;

    for (const p of products) {
      const avail = Number(p.stock) || 0;
      const res = Number(p.reservedStock) || 0;
      const phys = Number(p.physicalStock) || 0;
      const cost = p.unitCost != null ? Number(p.unitCost) : null;

      totalAvailable += avail;
      totalReserved += res;
      totalPhysical += phys;

      if (cost !== null) {
        totalValuation += phys * cost;
        productsWithValuation++;
      }

      if (avail <= 5) {
        lowStockCount++;
      }
    }

    return {
      totalProductsCount: products.length,
      totalAvailableUnits: totalAvailable,
      totalReservedUnits: totalReserved,
      totalPhysicalUnits: totalPhysical,
      totalInventoryValuation: Number(totalValuation.toFixed(2)),
      productsWithKnownCostCount: productsWithValuation,
      productsWithUnknownCostCount: products.length - productsWithValuation,
      lowStockAlertCount: lowStockCount,
    };
  };

  /**
   * 8. Compact Gross Profitability Report (تقرير الأرباح الإجمالية)
   * Includes delivered sales and dated return deductions.
   * Never inflates profit on unknown costs (Blocker 1 & Blocker 4).
   * Retains financial records even if orders are archived.
   */
  const getProfitabilityReport = async ({ startDate = null, endDate = null } = {}) => {
    const Op = Sequelize.Op;

    // Delivery date filter
    const deliveryWhere = {
      deliveredAt: { [Op.ne]: null },
    };
    if (startDate && endDate) {
      deliveryWhere.deliveredAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    } else if (startDate) {
      deliveryWhere.deliveredAt = { [Op.gte]: new Date(startDate) };
    } else if (endDate) {
      deliveryWhere.deliveredAt = { [Op.lte]: new Date(endDate) };
    }

    const deliveredOrders = await Order.findAll({
      where: deliveryWhere,
      order: [['deliveredAt', 'DESC']],
    });

    // Return date filter for reversals
    const returnWhere = {
      orderStatus: 'returned',
      returnedAt: { [Op.ne]: null },
    };
    if (startDate && endDate) {
      returnWhere.returnedAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    } else if (startDate) {
      returnWhere.returnedAt = { [Op.gte]: new Date(startDate) };
    } else if (endDate) {
      returnWhere.returnedAt = { [Op.lte]: new Date(endDate) };
    }

    const returnedOrders = await Order.findAll({
      where: returnWhere,
      order: [['returnedAt', 'DESC']],
    });

    // Construct unified list of financial events
    const financialOrders = [];

    // 1. Deliveries (Revenue & COGS)
    for (const o of deliveredOrders) {
      const rev = Number(o.totalCost) || 0;
      let cogs = null;
      if (o.totalPurchaseCost !== null && o.totalPurchaseCost !== undefined) {
        cogs = Number(o.totalPurchaseCost);
      }

      financialOrders.push({
        id: o.id,
        orderCode: o.orderCode,
        eventType: 'delivery',
        eventDate: o.deliveredAt,
        revenue: rev,
        cogs,
        hasUnknownCost: Boolean(o.hasUnknownCost || cogs === null),
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        archived: Boolean(o.archived),
      });
    }

    // 2. Returns in range (Reversal entries)
    for (const r of returnedOrders) {
      // Reversal: negative revenue and negative COGS
      const rev = -(Number(r.totalCost) || 0);
      let cogs = null;
      if (r.totalPurchaseCost !== null && r.totalPurchaseCost !== undefined) {
        cogs = -(Number(r.totalPurchaseCost));
      }

      financialOrders.push({
        id: r.id,
        orderCode: `${r.orderCode} (مرتجع)`,
        eventType: 'return',
        eventDate: r.returnedAt,
        revenue: rev,
        cogs,
        hasUnknownCost: Boolean(r.hasUnknownCost || cogs === null),
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        archived: Boolean(r.archived),
      });
    }

    // Compute metrics using pure calculation helper (prevents profit inflation)
    const summary = calculateProfitabilitySummary(financialOrders);

    // Decorate individual order summaries for the frontend table
    const orderSummaries = financialOrders.map((o) => {
      const grossProfit = o.cogs !== null ? Number((o.revenue - o.cogs).toFixed(2)) : null;
      const margin = (o.revenue > 0 && grossProfit !== null)
        ? Number(((grossProfit / o.revenue) * 100).toFixed(1))
        : null;

      return {
        id: o.id,
        orderCode: o.orderCode,
        eventType: o.eventType,
        eventDate: o.eventDate,
        revenue: o.revenue,
        cogs: o.cogs,
        grossProfit,
        marginPercent: margin,
        hasUnknownCost: o.hasUnknownCost,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        archived: o.archived,
      };
    });

    return {
      ...summary,
      deliveredCount: deliveredOrders.length,
      returnsCount: returnedOrders.length,
      orders: orderSummaries,
    };
  };

  return {
    receiveStock,
    reserveStockForOrder,
    releaseOrderReservation,
    deliverOrder,
    returnDeliveredOrder,
    adjustStock,
    getOverviewMetrics,
    getProfitabilityReport,
    calculateWeightedAverageCost,
  };
};

// Application Singleton
const inventoryService = createInventoryService();

module.exports = {
  inventoryService,
  createInventoryService,
  calculateWeightedAverageCost,
};
