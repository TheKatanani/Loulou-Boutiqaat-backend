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
      process.env.REFRESH_TOKEN_SECRET || 'loulou_refresh_token_secret_default_key_2026',
      (err, decoded) => {
        if (err) return res.sendStatus(403)
        let roles;
        try {
          const rawRoles = foundUser?.roles;
          const parsed = typeof rawRoles === 'string' ? JSON.parse(rawRoles) : rawRoles;
          roles = typeof parsed === 'object' && parsed !== null ? Object.values(parsed)[0] : parsed;
        } catch (e) {
          roles = 2001;
        }

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
        return res.json({
          accessToken,
          user: {
            id: foundUser?.id, 
            name: foundUser?.name,
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