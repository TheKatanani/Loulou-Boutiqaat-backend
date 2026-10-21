module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('Order', {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Nullable to support guest WhatsApp checkout
      references: {
        model: 'User',
        key: 'id',
      }
    },
    orderCode: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    orders: {
      type: DataTypes.JSON, // Contains historical snapshot of items [{ productId, name, price, quantity, subtotal }]
      allowNull: false,
    },
    totalCost: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    paid: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    location: DataTypes.STRING,
    customerName: DataTypes.STRING,
    customerPhone: DataTypes.STRING,
    orderSource: {
      type: DataTypes.STRING, // 'web_auth', 'whatsapp_draft', 'whatsapp_native'
      defaultValue: 'web_auth'
    },
    orderStatus: {
      type: DataTypes.STRING, // 'pending_whatsapp', 'confirmed', 'delivered', 'cancelled', 'expired'
      defaultValue: 'pending_whatsapp'
    },
    expiresAt: DataTypes.DATE, // 60 minutes reservation for WhatsApp drafts
    secretToken: DataTypes.STRING, // Secret token to resume/cancel draft without auth
    status: {
      type: DataTypes.BOOLEAN, // Backward compatibility: true if delivered, else false
      defaultValue: false
    }
  }, {});

  Order.associate = function (models) {
    Order.belongsTo(models.User, {
      foreignKey: 'userId',
      targetKey: 'id',
      as: 'user'
    });
  };

  return Order;
};
