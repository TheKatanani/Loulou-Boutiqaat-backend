"use strict";

var db = require(".");

module.exports = function (sequelize, DataTypes) {
  var Cart = sequelize.define('cart', {
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
    quantity: DataTypes.INTEGER
  });

  Cart.associate = function (models) {
    Cart.belongsTo(models.Product, {
      foreignKey: 'productId',
      targetKey: 'id',
      as: 'product'
    });
    Cart.belongsTo(models.User, {
      foreignKey: 'userId',
      targetKey: 'id',
      as: 'user'
    });
  };

  return Cart;
};