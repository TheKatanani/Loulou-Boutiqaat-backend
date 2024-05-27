const users = {
  data: require('../models/users.json'),
  setData: (data) => this.data = data
}
const path = require('path')
const fsPromises = require('fs').promises


const logoutHandler = async (req, res) => {
  const cookies = req.cookies
  if (!cookies?.jwt) return res.sendStatus(204) // no content
  const refreshToken = cookies.jwt

  const foundUser = users.data.find(_user => _user.refreshToken === refreshToken)
  if (!foundUser) {
    res.clearCookie('jwt', {
      httpOnly: true, 
      secure:true,
      sameSite:'None'
    }) //you must add the same option you send with
    // maxAge does not needed on clear cookies
    return res.status(204)
  }
  //delete the refresh token in the db
  const otherUsers = users.data.filter(_user => _user.name !== foundUser.name)
  const currentUser = {
    ...foundUser,
    refreshToken: ''
  }
  users.setData([...otherUsers, currentUser])
  await fsPromises.writeFile(
    path.join(__dirname, '..', 'model', 'users.js'),
    JSON.stringify(users.data)
  )
  res.clearCookie('jwt', {
    httpOnly: true, 
    sameSite:'None',
    secure:true
  }) // on production add secure:true - only serves on https
  
  res.sendStatus(204)
}

module.exports = {
  logoutHandler
}