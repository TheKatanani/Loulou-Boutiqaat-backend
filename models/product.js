module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define('product', {
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
    count:{
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
      type:DataTypes.STRING,
      allowNull:false
    },
    published: {
      type:DataTypes.BOOLEAN,
      defaultVaule:false
    },
  })
  return Product
} 