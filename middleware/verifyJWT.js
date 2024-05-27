const jwt = require('jsonwebtoken')
require('dotenv').config()
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.sendStatus(401)
  const token = authHeader.split(' ')[1] // bearer token
  console.log(token)
  jwt.verify(
    token,
    process.env.ACCESS_TOKEN_SECRET,
    (err, decoded) => { //decoded information from jwt 
      if (err) return res.sendStatus(403) //invalid token 
      req.user = decoded.userInfo.name,
      req.roles = decoded.userInfo.roles
      req.id = decoded.userInfo.id
      next();
    }
  )
}
module.exports = verifyJWT
// add this controller for the route you want to protect