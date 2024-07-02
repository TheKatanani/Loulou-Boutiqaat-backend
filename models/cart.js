const db = require(".")

const Product = db.products
const User = db.users
module.exports = (sequelize, DataTypes) => {
  const Cart = sequelize.define('cart', {
    productId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
      // references: {
      //   model: Product,
      //   key: 'id'
      // }
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
      // references:{
      //   model:User,
      //   key:'id'
      // }
    },
    // primaryKey(productId,userId),
    quantity: DataTypes.INTEGER
  })
  return Cart
}