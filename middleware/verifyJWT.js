const jwt = require('jsonwebtoken')
require('dotenv').config()
const verifyJWT = (req, res, next) => {
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({
    message: 'unauthorized'
  }) 
  const token = authHeader.split(' ')[1] // bearer token
  jwt.verify(
    token,
    process.env.ACCESS_TOKEN_SECRET || 'loulou_access_token_secret_default_key_2026',
    (err, decoded) => { //decoded information from jwt 
      if (err) return res.status(403).json({
        message: err.message || 'Forbidden'
      }) //invalid token  
      req.user = decoded.userInfo?.name;
      req.roles = decoded.userInfo?.roles;
      req.id = decoded.userInfo?.id;
      next();
    }
  )
}
module.exports = verifyJWT
// add this controller for the route you want to protect