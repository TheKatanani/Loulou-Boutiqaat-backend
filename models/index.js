const dbConfig = require('../config/dbConfig.js')
const Sequelize = require('sequelize')
const sequelize = new Sequelize(dbConfig.DATABASE, dbConfig.USER, dbConfig.PASSWORD, {
  host: dbConfig.HOST,
  dialect: dbConfig.DIALECT,
  overatorsAliases: false,
  pool: {
    max: dbConfig.pool.max,
    min: dbConfig.pool.min,
    ecquire: dbConfig.pool.ecquire,
    idle: dbConfig.pool.idle, 
  }
}) 
const db = {}
db.Sequelize = Sequelize
db.sequelize = sequelize
db.users = require('./user.js')(sequelize,Sequelize.DataTypes)
db.products = require('./product.js')(sequelize,Sequelize.DataTypes)
db.cart = require('./cart.js')(sequelize,Sequelize.DataTypes)
db.saved = require('./saved.js')(sequelize,Sequelize.DataTypes)
db.category = require('./category.js')(sequelize,Sequelize.DataTypes)
db.countryCode  = require('./countryCode.js')(sequelize,Sequelize.DataTypes)
db.social  = require('./social.js')(sequelize,Sequelize.DataTypes)
db.order  = require('./order.js')(sequelize,Sequelize.DataTypes)
async function test(){
  await db.sequelize.sync({
    focus: false
  })
}
test()

module.exports = db