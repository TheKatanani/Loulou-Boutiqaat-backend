module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('product', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    }, 
    background: DataTypes.STRING, 
    description: DataTypes.TEXT, 
    published: DataTypes.BOOLEAN  
  })
  return Category
} 