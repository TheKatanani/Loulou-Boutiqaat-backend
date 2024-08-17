const db = require(".")

const Category = db.category
module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define('Product', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    price:{
      type:DataTypes.INTEGER,
      defaultVaule:0
    },
    prevPrice:{
      type:DataTypes.INTEGER,
      defaultVaule:0
    }, 
    images: DataTypes.JSON,  
    stars: {
      type:DataTypes.INTEGER,
      defaultVaule:1
    },
    description: DataTypes.TEXT, 
    categoryId:{
      type:DataTypes.INTEGER,
      allowNull:false,
      references: {
        model: 'categories',
        key: 'id'
      } 
    },
    published: {
      type:DataTypes.BOOLEAN,
      defaultVaule:false
    },
  }) 
  Product.associate = function (models) {
    Product.belongsTo(models.Category, {
      foreignKey: 'categoryId',
      targetKey:'id',
      as: 'category'  
    });
    Product.hasMany(models.Cart, {
      foreignKey: 'productId',
      targetKey:'id',
      as: 'car'
    });
    Product.hasMany(models.Saved, {
      foreignKey: 'productId',
      targetKey:'id',
      as: 'saved'
    });
  };
  return Product
} 

