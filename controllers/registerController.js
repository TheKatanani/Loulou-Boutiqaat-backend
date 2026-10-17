require('dotenv').config()
const bcrypt = require('bcryptjs')
const ROLES_LIST = require('../config/roles_list')
const jwt = require('jsonwebtoken')
const { getCookieOptions } = require('../config/cookieConfig')

const db = require('../models')
const User = db.users

const createUser = async (req, res) => {
  const user = {
    name: req.body?.name,
    phone: req.body?.phone,
    password: req.body?.password,
    gender: req.body?.gender || 'female',
    barthDay: req.body?.barthDay || '',
    roles: {
      USER: ROLES_LIST.USER
    }
  }

  if (!user.phone || !user.password || !user.name) {
    return res.status(400).json({
      message: 'الاسم، رقم الهاتف، وكلمة المرور مطلوبة'
    })
  }

  try {
    const isExist = await User.findOne({
      where: {
        phone: user.phone
      }
    })
    if (isExist) {
      return res.status(409).json({
        message: `هذا المستخدم الذي يحمل رقم الهاتف ${user.phone} لديه حساب بالفعل`
      })
    }

    const newPassword = await bcrypt.hash(user.password, 10) 
    user.password = newPassword 

    const refreshToken = jwt.sign({
        name: user.name
      },
      process.env.REFRESH_TOKEN_SECRET || 'loulou_refresh_token_secret_default_key_2026', {
        expiresIn: '10d'
      }
    ) 

    let newUser = await User.create({
      ...user,
      refreshToken
    })
    newUser = newUser?.dataValues || newUser

    let roles;
    try {
      const rawRoles = newUser?.roles;
      const parsed = typeof rawRoles === 'string' ? JSON.parse(rawRoles) : rawRoles;
      roles = typeof parsed === 'object' && parsed !== null ? Object.values(parsed)[0] : parsed;
    } catch (e) {
      roles = ROLES_LIST.USER;
    }

    const accessToken = jwt.sign({
        userInfo: {
          name: newUser?.name,
          roles,
          id: newUser?.id
        }
      },
      process.env.ACCESS_TOKEN_SECRET || 'loulou_access_token_secret_default_key_2026', {
        expiresIn: '30m'
      }
    )  

    res.cookie('jwt', refreshToken, getCookieOptions())

    return res.status(201).json({
      accessToken,
      user: {
        id: newUser?.id,
        name: newUser?.name,
        phone: newUser?.phone,
        barthDay: newUser?.barthDay,
        gender: newUser?.gender,
        role: roles
      }
    })
  } catch (err) {
    return res.status(400).json({
      message: err?.message || err
    })
  }
}
module.exports = {
  createUser,
}