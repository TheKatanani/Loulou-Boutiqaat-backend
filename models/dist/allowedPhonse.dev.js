"use strict";

module.exports = function (sequelize, DataTypes) {
  var AllowedPhone = sequelize.define('allowedPhone', {
    value: {
      type: DataTypes.STRING,
      allowNull: false
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false
    }
  });
  return AllowedPhone;
};