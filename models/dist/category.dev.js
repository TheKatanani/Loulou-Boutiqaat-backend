"use strict";

var db = require(".");

module.exports = function (sequelize, DataTypes) {
  var Category = sequelize.define('category', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: DataTypes.TEXT,
    background: DataTypes.TEXT,
    published: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    userId: DataTypes.INTEGER
  });

  Category.associate = function (models) {
    Category.belongsTo(models.User);
  }; //this does not work


  return Category;
};