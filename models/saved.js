module.exports = (sequelize, DataTypes) => {
  const Saved = sequelize.define('saved', {
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'products',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    // primaryKey(productId,userId), 
  })
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
  }
  return Saved
}