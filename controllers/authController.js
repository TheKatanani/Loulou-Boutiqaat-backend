const bcrypt = require('bcryptjs')
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
    return res.status(400).json({
      message: 'الهاتف وكلمة المرور مطلوبة!'
    })
  }

  if (!db.isConnected) {
    const foundUser = db.mockData.mockUsers.find(u => u.phone === phone);
    if (!foundUser) {
      return res.status(401).json({ message: 'هذا المستخدم ليس لديه حساب!' });
    }
    if (password !== foundUser.password) {
      return res.status(400).json({ message: 'كلمة المرور خاطئة!' });
    }
    const roles = Object.values(foundUser.roles)[0];
    const accessToken = jwt.sign(
      { userInfo: { name: foundUser.name, roles, id: foundUser.id } },
      process.env.ACCESS_TOKEN_SECRET || 'loulou_access_token_secret_default_key_2026',
      { expiresIn: '30m' }
    );
    const refreshToken = jwt.sign(
      { name: foundUser.name },
      process.env.REFRESH_TOKEN_SECRET || 'loulou_refresh_token_secret_default_key_2026',
      { expiresIn: '10d' }
    );
    res.cookie('jwt', refreshToken, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'Lax',
      secure: false
    });
    return res.json({
      accessToken,
      user: {
        id: foundUser.id,
        name: foundUser.name,
        phone: foundUser.phone,
        barthDay: foundUser.barthDay,
        gender: foundUser.gender,
        role: roles
      }
    });
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
    if (match) {
      let roles;
      try {
        const rawRoles = foundUser.roles;
        const parsed = typeof rawRoles === 'string' ? JSON.parse(rawRoles) : rawRoles;
        roles = typeof parsed === 'object' && parsed !== null ? Object.values(parsed)[0] : parsed;
      } catch (e) {
        roles = 2001;
      }

      // create the JWTs 
      const accessToken = jwt.sign({
          userInfo: {
            name: foundUser.name,
            roles,
            id: foundUser.id
          }
        },
        process.env.ACCESS_TOKEN_SECRET || 'loulou_access_token_secret_default_key_2026', {
          expiresIn: '30m'
        }
      )
      const refreshToken = jwt.sign({
          name: foundUser.name
        },
        process.env.REFRESH_TOKEN_SECRET || 'loulou_refresh_token_secret_default_key_2026', {
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
        httpOnly: true, // not available to js 
        maxAge: 24 * 60 * 60 * 1000, // one day 
        sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production'
      })
      return res.json({
        accessToken,
        user: {
          id: foundUser?.id,
          name: foundUser?.name,
          phone: foundUser?.phone,
          barthDay: foundUser?.barthDay,
          gender: foundUser?.gender,
          role: roles // send the user role code 
        }
      })
    } else {
      return res.status(400).json({
        message: 'كلمة المرور خاطئة!'
      })
    }
  } catch (err) {
    return res.status(400).json({
      message: err?.message || err
    })
  }
}

module.exports = {
  loginHandler
}