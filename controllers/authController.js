const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const db = require('../models')
require('dotenv').config()
const User = db.users
const loginHandler = async (req, res) => {
  const {
    phone,
    password,
  } = req.body
  if (!phone || !password) {
    res.status(400).json({
      message: 'الهاتف وكلمة المرور مطلوبة!'
    })
  }
  try {
    const foundUser = await User.findOne({
      where: {
        phone
      }
    })
    if (!foundUser) {
      return res.status(401).json({
        message: 'هذا المستخدم ليس لديه حساب!'
      })
    }
    const match = await bcrypt.compare(password, foundUser?.password)
    // const match =  password=== foundUser?.password 
    if (match) {
      const roles = Object.values(JSON.parse(foundUser.roles))[0]
      // create the JWTs 
      const accessToken = jwt.sign({
          userInfo: {
            name: foundUser.name,
            roles,
            id: foundUser.id
          }
        },
        process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: '30m'
        }
      )
      const refreshToken = jwt.sign({
          name: foundUser.name
        },
        process.env.REFRESH_TOKEN_SECRET, {
          expiresIn: '10d'
        }
      )
      await User.update({
        refreshToken
      }, {
        where: {
          phone
        }
      })
      res.cookie('jwt', refreshToken, {
        httpOnly: true, //not avilable for js 
        maxAge: 24 * 60 * 60 * 1000, //one day 
        // sameSite: 'None',
        // secure: true
      })
      res.json({
        accessToken,
        user: {
          id: foundUser?.id,
          name: foundUser?.name,
          password: foundUser?.password,
          phone: foundUser?.phone,
          barthDay: foundUser?.barthDay,
          gender: foundUser?.gender,
          role: roles //send the user role code 
        }
      })
    } else {
      res.status(400).json({
        message: 'كلمة المرور خاطئة!'
      })
    }
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}

module.exports = {
  loginHandler
}