const dbConfig = require('../config/dbConfig.js')
const Sequelize = require('sequelize')
const sequelize = new Sequelize(dbConfig.DATABASE, dbConfig.USER, dbConfig.PASSWORD, {
  host: dbConfig.HOST,
  port: dbConfig.PORT || 3306,
  dialect: dbConfig.DIALECT,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: dbConfig.pool.max,
    min: dbConfig.pool.min,
    acquire: dbConfig.pool.acquire || 30000,
    idle: dbConfig.pool.idle, 
  }
}) 
const db = {}
db.Sequelize = Sequelize
db.sequelize = sequelize
db.users = require('./user.js')(sequelize, Sequelize.DataTypes)
db.products = require('./product.js')(sequelize, Sequelize.DataTypes)
db.cart = require('./cart.js')(sequelize, Sequelize.DataTypes)
db.saved = require('./saved.js')(sequelize, Sequelize.DataTypes)
db.category = require('./category.js')(sequelize, Sequelize.DataTypes)
db.countryCode = require('./countryCode.js')(sequelize, Sequelize.DataTypes)
db.social = require('./social.js')(sequelize, Sequelize.DataTypes)
db.order = require('./order.js')(sequelize, Sequelize.DataTypes)

// Map capitalized names so model associations (e.g. models.Category, models.Product) resolve correctly
db.User = db.users
db.Product = db.products
db.Cart = db.cart
db.Saved = db.saved
db.Category = db.category
db.CountryCode = db.countryCode
db.Social = db.social
db.Order = db.order

// Invoke associations once per model
const modelList = [db.users, db.products, db.cart, db.saved, db.category, db.countryCode, db.social, db.order];
modelList.forEach((model) => {
  if (model && typeof model.associate === 'function') {
    model.associate(db);
  }
});

db.isConnected = false
db.mockData = require('../config/mockData')

async function test() {
  try {
    await db.sequelize.authenticate();
    console.log('Database connected successfully.');
    await db.sequelize.sync({
      force: false
    });
    console.log('Database synchronized.');
    db.isConnected = true;
  } catch (error) {
    db.isConnected = false;
    console.warn('MySQL not detected on localhost:3306. Operating in Mock Fallback Mode.');
  }
}
test()

module.exports = db