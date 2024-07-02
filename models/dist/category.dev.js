"use strict";

var db = require(".");

module.exports = function (sequelize, DataTypes) {
  var Category = sequelize.define('category', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    description: DataTypes.TEXT,
    background: DataTypes.TEXT,
    published: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  });
  return Category;
};