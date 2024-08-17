const bcrypt = require('bcrypt')
const ROLES_LIST = require('../config/roles_list')

const db = require('../models')
const User = db.users
const createUser = async (req, res) => {
  const user = { 
    "name": req.body?.name,
    "phone": req.body?.phone,
    "password": req.body?.password,
    "gender": req.body?.gender,
    "barthDay": req.body?.barthDay,
    "roles": {
      USER: ROLES_LIST.USER
    }
  } //new user
  // you must add validation here  
  const isExist = await User.findOne({
    where: {
      phone: user.phone
    }
  })
  if (isExist) {
    res.status(409) //conflict 
      .json({
        message: `هذا المستخدم الذي يحمل رقم الهاتف ${user.phone} لديه حساب`
      })
  } else {
    if (!user.phone || !user.password) {
      res.status(400).json({
        message: `الهاتف وكلمة المرور مطلوبان`
      })
    }
    try {
      const newPassword = await bcrypt.hash(user.password, 10)
      user.password = newPassword
      await User.create(user)
      res.status(201).json({
        success: `تم إنشاء المستخدم الجديد ${user.name}!`
      })
    } catch (err) {
      res.json({
        message: err
      })
    }
  }
}
module.exports = {
  createUser,
}