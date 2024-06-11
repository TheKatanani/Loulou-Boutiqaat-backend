const db = require('../models')
const User = db.users


const logoutHandler = async (req, res) => { 
  const cookies = req.cookies 
  if (!cookies?.jwt) return res.sendStatus(401) // unauthorized

  const refreshToken = cookies.jwt
  try {
    const foundUser =await User.findOne({
      where: {
        refreshToken
      }
    })
    if (!foundUser) {
      res.clearCookie('jwt', {
        httpOnly: true,
        // secure: true,
        // sameSite: 'None'
      }) //you must add the same option you send with
      // maxAge does not needed on clear cookies
      return res.status(204)
    } 
    User.update({
      refreshToken: ''
    }, {
      where: {
        id: foundUser?.id
      }
    })
    res.clearCookie('jwt', {
      httpOnly: true,
      // sameSite: 'None',
      // secure: true
    }) // on production add secure:true - only serves on https

    res.sendStatus(204)
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}

module.exports = logoutHandler
