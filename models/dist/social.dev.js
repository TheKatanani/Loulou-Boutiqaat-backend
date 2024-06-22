"use strict";

module.exports = function (sequelize, DataTypes) {
  var Social = sequelize.define('social', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    value: {
      type: DataTypes.STRING
    }
  });
  return Social;
};