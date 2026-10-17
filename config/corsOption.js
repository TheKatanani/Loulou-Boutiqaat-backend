const allowedOrigins = require('./allowedOrigins.js')

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (such as mobile apps, curl, Postman, or server-to-server health checks)
    if (!origin) {
      return callback(null, true);
    }

    const isExplicitlyAllowed = allowedOrigins.includes(origin);
    const isRenderOrCloudDomain =
      /\.onrender\.com$/.test(origin) ||
      /\.vercel\.app$/.test(origin) ||
      /\.netlify\.app$/.test(origin);

    if (
      isExplicitlyAllowed ||
      isRenderOrCloudDomain ||
      process.env.ALLOW_ALL_ORIGINS === 'true'
    ) {
      callback(null, true);
    } else {
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}

module.exports = {
  corsOptions
}