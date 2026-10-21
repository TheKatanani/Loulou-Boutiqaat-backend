module.exports = (sequelize, DataTypes) => {
  const Saved = sequelize.define('saved', {
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'Products',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'User',
        key: 'id'
      }
    },
  });

  Saved.associate = function (models) {
    Saved.belongsTo(models.Product, {
      foreignKey: 'productId',
      targetKey: 'id',
      as: 'product'
    });
    Saved.belongsTo(models.User, {
      foreignKey: 'userId',
      targetKey: 'id',
      as: 'user'
    });
  };

  return Saved;
};
