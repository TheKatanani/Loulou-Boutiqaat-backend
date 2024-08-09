const verifyRoles = (...allowdRoles) => {
  return (req, res, next) => {  
    if (!req?.roles) return res.sendStatus(401) // update this and handle it with jwt
    const rolesArray = [...allowdRoles]   
    const result = rolesArray.includes(req.roles) 
    if (!result) return res.sendStatus(401)
    next()
  }
}
module.exports = verifyRoles