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
      unique: true
    },
    password: {
      type: DataTypes.STRING,
      require: true
    },
    barthDay: DataTypes.STRING,
    gender: {
      type: DataTypes.STRING,
      defaultValue: 'female'
    },
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