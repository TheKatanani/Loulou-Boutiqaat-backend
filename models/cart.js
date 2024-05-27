module.exports = (sequelize, DataTypes) => {
  const Cart = sequelize.define('cart', {
    productId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    quantity: DataTypes.INTEGER  
  })
  return Cart
} 