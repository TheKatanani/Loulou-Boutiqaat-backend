module.exports = (sequelize, DataTypes) => {
  const StockMovement = sequelize.define('StockMovement', {
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Products',
        key: 'id',
      },
    },
    movementType: {
      type: DataTypes.ENUM(
        'receipt',              // استلام بضاعة / توريد
        'reservation',          // حجز لطلب جديد
        'reservation_release',  // فك حجز لطلب ملغي أو منتهي
        'delivery',             // تسليم طلب مبيعات
        'return',               // إرجاع مبيعات مسلّمة
        'adjustment',           // تسوية جردية
        'opening_balance'       // رصيد افتتاحي
      ),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    unitCost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    totalCost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    physicalBefore: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    physicalAfter: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    reservedBefore: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    reservedAfter: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    availableBefore: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    availableAfter: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    unitCostBefore: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    unitCostAfter: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Orders',
        key: 'id',
      },
    },
    orderCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    createdByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'User',
        key: 'id',
      },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    idempotencyKey: {
      type: DataTypes.STRING(128),
      allowNull: true,
      unique: true,
    },
  }, {
    tableName: 'StockMovements',
    timestamps: true,
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ['idempotencyKey'],
      },
    ],
  });

  StockMovement.associate = function (models) {
    StockMovement.belongsTo(models.Product, {
      foreignKey: 'productId',
      targetKey: 'id',
      as: 'product',
    });
    StockMovement.belongsTo(models.Order, {
      foreignKey: 'orderId',
      targetKey: 'id',
      as: 'order',
    });
    StockMovement.belongsTo(models.User, {
      foreignKey: 'createdByUserId',
      targetKey: 'id',
      as: 'createdByUser',
    });
  };

  return StockMovement;
};
