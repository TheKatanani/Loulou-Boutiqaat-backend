require('dotenv').config();
const express = require('express')
const path = require('path')
const cors = require('cors')
const {
  errorHandler
} = require('./middleware/errorHandler')
const {
  logger
} = require('./middleware/logEvents')
const {
  corsOptions
} = require('./config/corsOption.js')
const verifyJWT = require('./middleware/verifyJWT.js')
const cookieParser = require('cookie-parser')
const credentials = require('./middleware/credentials.js')

const app = express()
const PORT = process.env.PORT || 3500

// Required on Render / reverse proxies for secure cross-site cookies & accurate client IP
app.set('trust proxy', 1)

// Custom request logger
app.use(logger)

// Handle options credentials check before CORS! and fetch cookies credentials requirement
app.use(credentials)

// Cross origin resource sharing
app.use(cors(corsOptions))

// Middleware to handle urlencoded and json data (built into Express)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware for cookies
app.use(cookieParser())

app.use(express.static(path.join(__dirname, '/public')))

// Health check endpoint for Render zero-downtime deployments and monitoring
app.get('/health', (req, res) => {
  const db = require('./models');
  res.status(200).json({
    status: 'ok',
    service: 'Loulou Boutiqaat API',
    uptime: Math.floor(process.uptime()),
    database: db.isConnected ? 'connected' : 'mock-fallback',
    timestamp: new Date().toISOString()
  });
});

app.use('^/$', require('./router/root.js'))

app.use('/register', require('./router/register'))
app.use('/login', require('./router/auth'))
app.use('/refresh', require('./router/refresh'))
app.use('/logout', require('./router/logout'))

// API (Public or self-handled authentication)
app.use('/product', require('./router/api/product.js'))
app.use('/countryCode', require('./router/api/countryCode.js'))
app.use('/category', require('./router/api/category.js'))
app.use('/social', require('./router/api/social.js'))
app.use('/catalog', require('./router/api/catalog.js'))
app.use('/order', require('./router/api/order.js'))

// Any route under this line must verify by JWT
app.use(verifyJWT)
app.use('/users', require('./router/api/users'))
app.use('/cart', require('./router/api/cart.js'))
app.use('/saved', require('./router/api/saved.js'))

app.all('*', (req, res) => {
  res.status(404)
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'views', '404.html'))
  } else if (req.accepts('json')) {
    res.send({
      error: '404 Not Found'
    })
  } else {
    res.type('txt').send('404 Not Found')
  }
})

app.use(errorHandler)

const db = require('./models');
const { cleanupExpiredDrafts } = require('./services/orderService');

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Loulou Boutiqaat backend listening on 0.0.0.0:${PORT}`);
  // Wait for database connection and schema updates before starting background jobs
  if (db.initPromise) {
    await db.initPromise.catch((err) => console.warn('Database initialization warning:', err.message));
  }
  cleanupExpiredDrafts().catch((e) => console.error('Initial cleanup error:', e.message));
  setInterval(() => {
    cleanupExpiredDrafts().catch((e) => console.error('Interval cleanup error:', e.message));
  }, 60 * 1000);
});