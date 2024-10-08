const jwt = require('jsonwebtoken')
const db = require('../models')
const User = db.users
require('dotenv').config()
const handleRefreshToken = async (req, res) => {
  const cookies = req.cookies
  if (!cookies?.jwt) return res.sendStatus(401) // unauthorized
  const refreshToken = cookies.jwt
  try {
    const foundUser = await User.findOne({
      where: {
        refreshToken
      }
    })
    if (!foundUser) return res.sendStatus(403) //forbidden
    jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      (err, decoded) => {
        if (err) return res.sendStatus(403)
        const roles = Object.values(JSON.parse(foundUser?.roles))[0]  
        const accessToken = jwt.sign({
            userInfo: {
              name: foundUser.name,// || decoded.userInfo.name
              roles,
              id: foundUser.id
            }
          },
          process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: '30m'
          }
        )
        res.json({
          accessToken,
          user: {
            id:foundUser?.id, 
            name: foundUser?.name,
            password: foundUser?.password,
            phone: foundUser?.phone,
            barthDay: foundUser?.barthDay,
            gender: foundUser?.gender,
            role: roles 
          }
        })
      }
    )
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}

module.exports = {
  handleRefreshToken
}