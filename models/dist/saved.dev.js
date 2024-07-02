"use strict";

var db = require(".");

var Product = db.products;
var User = db.users;

module.exports = function (sequelize, DataTypes) {
  var Saved = sequelize.define('saved', {
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
      primaryKey: true // references: {
      //   model: User,
      //   key: 'id'
      // }

    } // primaryKey(productId,userId), 

  });
  return Saved;
};