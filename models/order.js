 
module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('order', {
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      // references: {
      //   model: User,
      //   key: 'id',
      //   deferrable:Deferrable.INITIALLY_IMMEDIATE
      // }
    },
    orders: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    totalCost: DataTypes.INTEGER, 
    paid: DataTypes.INTEGER,
    location: DataTypes.STRING
  })
  return Order
}