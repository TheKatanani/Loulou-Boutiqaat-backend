const users = {
  data: require('../models/users.json'),
  setData: (data) => this.data = data
}
const jwt = require('jsonwebtoken')
require('dotenv').config()
const handleRefreshToken = (req, res) => {
  const cookies = req.cookies
  if (!cookies?.jwt) return res.sendStatus(401) // unauthorized
  const refreshToken = cookies.jwt
  const foundUser = users.data.find(_user => _user.refreshToken === refreshToken)
  if (!foundUser) return res.sendStatus(403) //forbidden
  jwt.verify(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET,
    (err, decoded) => {
      if (err || foundUser.name !== decoded.name) return res.sendStatus(403)
      // const roles = Object.values(foundUser.roles)
      const accessToken = jwt.sign({
          name: decoded.name,
          // roles
        },
        process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: '30s' // set it logner in production app
        }
      )
      res.json({
        accessToken
      })
    }
  ) 
}

module.exports = {
  handleRefreshToken
}