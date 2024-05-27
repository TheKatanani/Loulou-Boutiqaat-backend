module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define('product', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    price: DataTypes.INTEGER,
    prevPrice: DataTypes.INTEGER,
    images: DataTypes.JSON,  
    stars: DataTypes.INTEGER,
    description: DataTypes.TEXT, 
    published: DataTypes.BOOLEAN,
  })
  return Product
} 