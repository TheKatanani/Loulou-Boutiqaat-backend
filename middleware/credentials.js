const allowedOrigins = require("../config/allowedOrigins");

const credentials = (req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) {
    return next();
  }

  const isAllowed =
    allowedOrigins.includes(origin) ||
    /\.onrender\.com$/.test(origin) ||
    /\.vercel\.app$/.test(origin) ||
    /\.netlify\.app$/.test(origin) ||
    process.env.ALLOW_ALL_ORIGINS === 'true';

  if (isAllowed) {
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  next();
};

module.exports = credentials;