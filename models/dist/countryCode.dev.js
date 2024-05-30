"use strict";

module.exports = function (sequelize, DataTypes) {
  var CountryCode = sequelize.define('countryCode', {
    value: {
      type: DataTypes.STRING,
      allowNull: false
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false
    }
  });
  return CountryCode;
};