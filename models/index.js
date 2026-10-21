const dbConfig = require('../config/dbConfig.js')
const Sequelize = require('sequelize')

const useSsl = process.env.DB_SSL === 'true' || (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('ssl'));

let sequelize;
if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: useSsl ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    } : {},
    pool: {
      max: dbConfig.pool.max,
      min: dbConfig.pool.min,
      acquire: dbConfig.pool.acquire || 30000,
      idle: dbConfig.pool.idle, 
    }
  });
} else {
  sequelize = new Sequelize(dbConfig.DATABASE, dbConfig.USER, dbConfig.PASSWORD, {
    host: dbConfig.HOST,
    port: dbConfig.PORT || 3306,
    dialect: dbConfig.DIALECT,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: useSsl ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    } : {},
    pool: {
      max: dbConfig.pool.max,
      min: dbConfig.pool.min,
      acquire: dbConfig.pool.acquire || 30000,
      idle: dbConfig.pool.idle, 
    }
  });
}

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
    await ensureSchemaUpdates();
async function ensureSchemaUpdates() {
  const queryInterface = db.sequelize.getQueryInterface();
  try {
    const productDesc = await queryInterface.describeTable('Products').catch(() => null);
    if (productDesc && !productDesc.stock) {
      await queryInterface.addColumn('Products', 'stock', {
        type: Sequelize.DataTypes.INTEGER,
        defaultValue: 25,
        allowNull: false
      }).catch(err => console.warn('stock add column notice:', err.message));
      console.log('Added column stock to Products table.');
    }
  } catch (e) {
    console.warn('Product schema check:', e.message);
  }

  try {
    const orderDesc = await queryInterface.describeTable('Orders').catch(() => null);
    if (orderDesc) {
      if (orderDesc.userId && !orderDesc.userId.allowNull) {
        await queryInterface.changeColumn('Orders', 'userId', {
          type: Sequelize.DataTypes.INTEGER,
          allowNull: true
        }).catch(err => console.warn('userId allowNull change notice:', err.message));
      }
      if (!orderDesc.orderCode) {
        await queryInterface.addColumn('Orders', 'orderCode', {
          type: Sequelize.DataTypes.STRING,
          allowNull: true
        }).catch(err => console.warn('orderCode notice:', err.message));
      }
      if (!orderDesc.customerName) {
        await queryInterface.addColumn('Orders', 'customerName', {
          type: Sequelize.DataTypes.STRING,
          allowNull: true
        }).catch(err => console.warn('customerName notice:', err.message));
      }
      if (!orderDesc.customerPhone) {
        await queryInterface.addColumn('Orders', 'customerPhone', {
          type: Sequelize.DataTypes.STRING,
          allowNull: true
        }).catch(err => console.warn('customerPhone notice:', err.message));
      }
      if (!orderDesc.orderSource) {
        await queryInterface.addColumn('Orders', 'orderSource', {
          type: Sequelize.DataTypes.STRING,
          defaultValue: 'web_auth'
        }).catch(err => console.warn('orderSource notice:', err.message));
      }
      if (!orderDesc.orderStatus) {
        await queryInterface.addColumn('Orders', 'orderStatus', {
          type: Sequelize.DataTypes.STRING,
          defaultValue: 'pending_whatsapp'
        }).catch(err => console.warn('orderStatus notice:', err.message));
      }
      if (!orderDesc.expiresAt) {
        await queryInterface.addColumn('Orders', 'expiresAt', {
          type: Sequelize.DataTypes.DATE,
          allowNull: true
        }).catch(err => console.warn('expiresAt notice:', err.message));
      }
      if (!orderDesc.secretToken) {
        await queryInterface.addColumn('Orders', 'secretToken', {
          type: Sequelize.DataTypes.STRING,
          allowNull: true
        }).catch(err => console.warn('secretToken notice:', err.message));
      }
    }
  } catch (e) {
    console.warn('Orders schema check:', e.message);
  }
}

  } catch (error) {
    db.isConnected = false;
    console.warn(`Database connection notice: ${error.message}. Operating in Mock Fallback Mode.`);
  }
}
test()

module.exports = db