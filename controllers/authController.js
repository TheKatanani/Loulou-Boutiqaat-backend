const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const db = require('../models')
const {
  Op
} = require('sequelize')
require('dotenv').config() 
const User = db.users
const loginHandler = async (req, res) => {
  const {
    phone,
    password
  } = req.body
  if (!phone || !password) {
    res.status(400).json({
      message: 'phone and password are required!'
    })
  }
  const foundUser = await User.findOne({
    where:{
      phone 
    }
  })
  if (!foundUser) {
    res.status(401).json({
      message: 'This User Does Not Have An Account!'
    })
  }
  const match = await bcrypt.compare(password, foundUser?.password)
  if (match) {
    const roles = Object.values(JSON.parse(foundUser.roles))
    // create the JWTs 
    const accessToken = jwt.sign({
        userInfo: {
          name: foundUser.name,
          roles,
          id:foundUser.id
        }
      },
      process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '15m' //enshor if it's work 
      }
    )
    const refreshToken = jwt.sign({
        name: foundUser.name
      },
      process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: '1d'
      }
    ) 
    await User.update({
      refreshToken
    }, {
      where: {
        phone :{
          [Op.eq]: phone
        }
      }
    })  
      res.cookie('jwt', refreshToken, {
        httpOnly: true, //not avilable for js 
        maxAge: 24 * 60 * 60 * 1000, //one day 
        sameSite: 'None',
        secure: true
      })
      res.json({
        accessToken
      }) 
  } else {
    res.json({
      message: 'Wrong Password'
    })
  }
}

module.exports = {
  loginHandler
}