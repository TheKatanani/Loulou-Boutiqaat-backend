const db = require(".")

module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('category', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: DataTypes.TEXT, 
    background: DataTypes.TEXT,  
    published:{
      type: DataTypes.BOOLEAN,
      defaultValue:false
    },
    userId:DataTypes.INTEGER
  })
  Category.associate = models => {
    Category.belongsTo(models.User)
  }//this does not work
  return Category
} 