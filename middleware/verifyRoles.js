const normalizeRoles = (rawRoles) => {
  if (!rawRoles) return [];
  if (Array.isArray(rawRoles)) return rawRoles.map(Number);
  if (typeof rawRoles === 'number') return [rawRoles];
  if (typeof rawRoles === 'string') {
    const n = Number(rawRoles);
    return isNaN(n) ? [] : [n];
  }
  if (typeof rawRoles === 'object') {
    return Object.values(rawRoles).map(Number);
  }
  return [];
};

const verifyRoles = (...allowdRoles) => {
  return (req, res, next) => {  
    if (!req?.roles) return res.sendStatus(401);
    const rolesArray = allowdRoles.map(Number);
    const userRoles = normalizeRoles(req.roles);
    const hasRole = userRoles.some(role => rolesArray.includes(role));
    if (!hasRole) return res.sendStatus(401);
    next();
  };
};

module.exports = verifyRoles;
