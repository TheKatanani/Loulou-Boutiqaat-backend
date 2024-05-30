module.exports = (sequelize, DataTypes) => {
  const CountryCode  = sequelize.define('countryCode', {
    value: {
      type: DataTypes.STRING,
      allowNull: false,  
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false, 
    }, 
  })
  return CountryCode 
} 