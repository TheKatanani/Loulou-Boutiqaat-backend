module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('user', {
    name: {
      type: DataTypes.STRING,
      alowNall: false,
      validate: {
        notEmpty: true
      }
    },
    phone: {
      type: DataTypes.STRING,
      uniqe: true
    },
    password: DataTypes.STRING,
    barthDay: DataTypes.STRING,
    gender: DataTypes.STRING,
    roles: DataTypes.JSON,
    refreshToken:DataTypes.STRING
  }, {
    freezetableName: true,
  })
  return User;
}