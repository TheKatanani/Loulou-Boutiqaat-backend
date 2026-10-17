const db = require('../models')
const { getClearCookieOptions } = require('../config/cookieConfig')
const User = db.users

const logoutHandler = async (req, res) => { 
  const cookies = req.cookies 
  if (!cookies?.jwt) return res.sendStatus(204) // No content

  const refreshToken = cookies.jwt

  if (!db.isConnected) {
    res.clearCookie('jwt', getClearCookieOptions())
    return res.sendStatus(204)
  }

  try {
    const foundUser = await User.findOne({
      where: {
        refreshToken
      }
    })
    if (!foundUser) {
      res.clearCookie('jwt', getClearCookieOptions())
      return res.sendStatus(204)
    } 
    await User.update({
      refreshToken: ''
    }, {
      where: {
        id: foundUser?.id
      }
    })
    res.clearCookie('jwt', getClearCookieOptions())
    res.sendStatus(204)
  } catch (err) {
    res.clearCookie('jwt', getClearCookieOptions())
    res.sendStatus(204)
  }
}

module.exports = logoutHandler
