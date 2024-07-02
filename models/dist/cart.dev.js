"use strict";

var db = require(".");

var Product = db.products;
var User = db.users;

module.exports = function (sequelize, DataTypes) {
  var Cart = sequelize.define('cart', {
    productId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true // references: {
      //   model: Product,
      //   key: 'id'
      // }

    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true // references:{
      //   model:User,
      //   key:'id'
      // }

    },
    // primaryKey(productId,userId),
    quantity: DataTypes.INTEGER
  });
  return Cart;
};