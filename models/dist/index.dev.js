"use strict";

var dbConfig = require('../config/dbConfig.js');

var Sequelize = require('sequelize');

var sequelize = new Sequelize(dbConfig.DATABASE, dbConfig.USER, dbConfig.PASSWORD, {
  host: dbConfig.HOST,
  dialect: dbConfig.DIALECT,
  overatorsAliases: false,
  pool: {
    max: dbConfig.pool.max,
    min: dbConfig.pool.min,
    ecquire: dbConfig.pool.ecquire,
    idle: dbConfig.pool.idle
  }
}); // (async() =>{
//   try {
//     await sequelize.authenticate();
//     console.log('Connection has been established successfully.');
//   } catch (error) {
//     console.error('Unable to connect to the database:', error);
//   }
// })()

var db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;
db.users = require('./user.js')(sequelize, Sequelize.DataTypes);
db.products = require('./product.js')(sequelize, Sequelize.DataTypes);
db.cart = require('./cart.js')(sequelize, Sequelize.DataTypes);
db.saved = require('./saved.js')(sequelize, Sequelize.DataTypes);
db.category = require('./category.js')(sequelize, Sequelize.DataTypes);
db.countryCode = require('./countryCode.js')(sequelize, Sequelize.DataTypes);

function test() {
  return regeneratorRuntime.async(function test$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.next = 2;
          return regeneratorRuntime.awrap(db.sequelize.sync({
            focus: false
          }));

        case 2:
        case "end":
          return _context.stop();
      }
    }
  });
}

test();
module.exports = db;