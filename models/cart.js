module.exports = (sequelize, DataTypes) => {
  const Cart = sequelize.define('cart', {
    productId: {
      type: DataTypes.STRING,
      allowNull: false, 
      primaryKey:true
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey:true
    },
    // primaryKey(productId,userId),
    quantity: DataTypes.INTEGER  
  })
  return Cart
} 