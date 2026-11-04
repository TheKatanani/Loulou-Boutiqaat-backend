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
      defaultValue: 0,
      allowNull: false
    },
    physicalStock: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    reservedStock: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    unitCost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null
    },
    isArchived: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
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
    Product.hasMany(models.StockMovement, {
      foreignKey: 'productId',
      as: 'stockMovements'
    });
  };

  return Product;
};
