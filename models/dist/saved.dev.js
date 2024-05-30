"use strict";

module.exports = function (sequelize, DataTypes) {
  var Saved = sequelize.define('saved', {
    productId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    } // primaryKey(productId,userId), 

  });
  return Saved;
};