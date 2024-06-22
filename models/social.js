module.exports = (sequelize, DataTypes) => {
  const Social = sequelize.define('social', {
    name: {
      type: DataTypes.STRING,
      allowNull: false, 
      unique:true
    },
    value: {
      type: DataTypes.STRING, 
    }, 
  })
  return Social
} 