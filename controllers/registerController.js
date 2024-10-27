const bcrypt = require('bcrypt')
const ROLES_LIST = require('../config/roles_list')
const jwt = require('jsonwebtoken')

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
      phone: user?.phone
    }
  })
  if (isExist) {
    res.status(409) //conflict 
      .json({
        message: `هذا المستخدم الذي يحمل رقم الهاتف ${user.phone} لديه حساب`
      })
  } else {
    // You must improve this validation 
    if (!user.phone || !user.password) {
      res.status(400).json({
        message: `الهاتف وكلمة المرور مطلوبان`
      })
    }
    try { 
      const newPassword = await bcrypt.hash(user.password, 10) 
      user.password = newPassword 
      const refreshToken = jwt.sign({
        name: user?.name
      },
      process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: '10d'
      }
    ) 
      let newUser = await User.create({
        ...user
        ,
        refreshToken
      }) //is this return the creation user ? 
      newUser = newUser?.dataValues
      // res.status(201).json({
        //   success: `تم إنشاء المستخدم الجديد ${user.name}!`
        // })
        // // // // // // // // // // // // // // // //  

      const roles = Object.values(newUser?.roles)[0] 
      // create the JWTs 
      const accessToken = jwt.sign({
          userInfo: {
            name: newUser?.name,
            roles, // send user role
            id: newUser?.id
          }
        },
        process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: '30m'
        }
      )  
      res.cookie('jwt', refreshToken, {
        httpOnly: true, //not avilable for js 
        maxAge: 24 * 60 * 60 * 1000, //one day 
        // sameSite: 'None',
        // secure: true
      })
      res.json({
        accessToken,
        user: {
          id: newUser?.id,
          name: newUser?.name,
          password: newUser?.password,
          phone: newUser?.phone,
          barthDay: newUser?.barthDay,
          gender: newUser?.gender,
          role: roles //send the user role code 
        }
      })
      // // // // // // // // // // // // // // // // 
    } catch (err) {
      res.status(400).json({
        message: err
      })
    }
  }
}
module.exports = {
  createUser,
}