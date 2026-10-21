module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define('Product', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    price: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    prevPrice: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }, 
    images: DataTypes.JSON,  
    stars: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    description: DataTypes.TEXT, 
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Categories',
        key: 'id'
      } 
    },
    published: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    stock: {
      type: DataTypes.INTEGER,
      defaultValue: 25,
      allowNull: false
    }
  });

  Product.associate = function (models) {
    Product.belongsTo(models.Category, {
      foreignKey: 'categoryId',
      targetKey: 'id',
      as: 'category'  
    });
    Product.hasMany(models.Cart, {
      foreignKey: 'productId',
      targetKey: 'id',
      as: 'car'
    });
    Product.hasMany(models.Saved, {
      foreignKey: 'productId',
      targetKey: 'id',
      as: 'saved'
    });
  };

  return Product;
};
