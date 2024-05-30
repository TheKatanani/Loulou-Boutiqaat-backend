"use strict";

module.exports = function (sequelize, DataTypes) {
  var User = sequelize.define('user', {
    name: {
      type: DataTypes.STRING,
      alowNall: false,
      validate: {
        notEmpty: true
      }
    },
    phone: {
      type: DataTypes.STRING,
      uniqe: true
    },
    password: DataTypes.STRING,
    barthDay: DataTypes.STRING,
    gender: DataTypes.STRING,
    roles: DataTypes.JSON,
    refreshToken: DataTypes.STRING
  }, {
    freezetableName: true
  });

  User.associate = function (models) {
    Category.hasMany(models.Category);
  };

  return User;
};