module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('Category', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique:true
    },
    description: DataTypes.TEXT, 
    background: DataTypes.TEXT,  
    published:{
      type: DataTypes.BOOLEAN,
      defaultValue:false
    }, 
  }) 
  Category.associate = function (models) {
    Category.hasMany(models.Product, {
      foreignKey: 'categoryId',
      targetKey:'id',
      as: 'products'
    });
  };
  return Category
} 