module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    name: {
      type: DataTypes.STRING,
      alowNall: false,
      validate: {
        notEmpty: true
      }
    },
    phone: {
      type: DataTypes.STRING,
      unique: true
    },
    password: {
      type: DataTypes.STRING,
      require: true
    },
    barthDay: DataTypes.STRING,
    gender: {
      type: DataTypes.STRING,
      defaultValue: 'female'
    },
    roles: DataTypes.JSON,
    refreshToken: DataTypes.STRING
  }, {
    freezetableName: true,
  })
  User.associate = function (models) {
    User.hasMany(models.Order, {
      foreignKey: 'userId',
      targetKey:'id',
      as: 'order'
    });
    User.hasMany(models.Cart, {
      foreignKey: 'userId',
      targetKey:'id',
      as: 'car'
    });
    User.hasMany(models.Saved, {
      foreignKey: 'userId',
      targetKey:'id',
      as: 'saved'
    });
  };
  return User;
}