const db = require(".")

const Product = db.products
const User = db.users
module.exports = (sequelize, DataTypes) => {
  const Saved = sequelize.define('saved', {
    productId: {
      type: DataTypes.STRING,
      allowNull: false, 
      primaryKey:true,
      // references: {
      //   model: Product,
      //   key: 'id'
      // }
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey:true,
      // references: {
      //   model: User,
      //   key: 'id'
      // }
    },
    // primaryKey(productId,userId), 
  })
  return Saved
} 