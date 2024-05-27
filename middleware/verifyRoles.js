const verifyRoles = (...allowdRoles) => {
  return (req, res, next) => {
    if (!req?.roles) return res.sendStatus(401) // update this and handle it with jwt
    const rolesArray = [...allowdRoles]
    // console.log('req.roles=>',req.roles)
    // const result = rolesArray.includes(req.roles)
    const result = req.roles.map(role => rolesArray.includes(role)).find(val => val === true) //true and false arrays this filter to find one true
    if (!result) return res.sendStatus(401)
    next()
  }
}
module.exports = verifyRoles