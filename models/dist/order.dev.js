"use strict";

var db = require("."); // Assuming you have defined your User model like this:


var User = db.users;

module.exports = function (sequelize, DataTypes) {
  var Order = sequelize.define('Order', {
    userId: {
      type: DataTypes.INTEGER,
      // Assuming User ID is of type INTEGER
      allowNull: false,
      references: {
        model: 'users',
        // This is the model you're referring to
        key: 'id' // This is the column name in the User model

      }
    },
    orders: {
      type: DataTypes.JSON,
      allowNull: false
    },
    totalCost: DataTypes.INTEGER,
    paid: DataTypes.INTEGER,
    location: DataTypes.STRING
  }, {});

  Order.associate = function (models) {
    Order.belongsTo(models.User, {
      foreignKey: 'userId',
      targetKey: 'id',
      as: 'user' // Alias for the relation

    });
  };

  return Order;
};