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
let inventoryReady = process.env.NODE_ENV !== 'production' && !process.env.RENDER_GIT_COMMIT

// Required on Render / reverse proxies for secure cross-site cookies & accurate client IP
app.set('trust proxy', 1)

// Custom request logger
app.use(logger)

// Handle options credentials check before CORS! and fetch cookies credentials requirement
app.use(credentials)

// Cross origin resource sharing
app.use(cors(corsOptions))

// Middleware to handle urlencoded and json data (built into Express)
app.use(express.json({ limit: '50mb', verify: (req, res, buffer) => {
  if (req.originalUrl.startsWith('/webhook') || req.originalUrl.startsWith('/api/webhook/whatsapp')) req.rawBody = Buffer.from(buffer);
} }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware for cookies
app.use(cookieParser())

app.use(express.static(path.join(__dirname, '/public')))

// Health check endpoint for Render zero-downtime deployments and monitoring
app.get('/health', (req, res) => {
  const db = require('./models');
  const isHealthy = db.isConnected === true;
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'initializing',
    service: 'Loulou Boutiqaat API',
    uptime: Math.floor(process.uptime()),
    database: db.isConnected ? 'connected' : 'disconnected',
    commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'e4cf833',
    databaseTarget: db.sequelize?.config?.database || 'unknown',
    inventoryCutover: inventoryReady ? 'ready' : 'waiting',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res, next) => {
  if (inventoryReady) return next();
  res.set('Retry-After', '30');
  return res.status(503).json({
    status: 'inventory_cutover',
    message: 'المتجر في صيانة مؤقتة لتحديث المخزون. يرجى المحاولة بعد قليل.',
  });
});

// Guard: ensure database is connected before processing API requests (never serve mock data during startup)
app.use((req, res, next) => {
  const db = require('./models');
  if (req.path === '/health') return next();
  if (db.isConnected) return next();
  return res.status(503).json({
    message: 'جاري تهيئة الاتصال بقاعدة البيانات، يرجى الانتظار ثوانٍ معدودة...',
    status: 'initializing',
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
app.use('/webhook', require('./router/api/webhook.js'))
app.use('/api/webhook/whatsapp', require('./router/api/webhook.js'))
app.use('/whatsapp', require('./router/api/whatsappInbox').createRouter(require('./services/whatsappInbox')))
app.use('/inventory', require('./router/api/inventory.js'))

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
const { keyPrefix } = require('./scripts/reconcileOpeningStock');

function startWorkers() {
  const cleanup = () => cleanupExpiredDrafts().catch(err => console.error('Order cleanup:', err.message));
  const inbox = require('./services/whatsappInbox');
  const runInbox = () => inbox.processPending().catch(err => console.error('WhatsApp processing:', err.message));
  cleanup();
  runInbox();
  setInterval(cleanup, 60000);
  setInterval(runInbox, 15000);
}

async function waitForOpeningInventory() {
  try {
    const [[row]] = await db.sequelize.query(
      "SELECT (NOT EXISTS (SELECT 1 FROM Products) OR EXISTS (SELECT 1 FROM StockMovements WHERE movementType = 'opening_balance' AND idempotencyKey LIKE :prefix)) AS ready",
      { replacements: { prefix: keyPrefix + '%' } }
    );
    if (Number(row.ready) === 1) {
      inventoryReady = true;
      startWorkers();
      return;
    }
  } catch (err) {
    console.error('Inventory cutover check:', err.message);
  }
  setTimeout(waitForOpeningInventory, 5000);
}

(async () => {
  // Await database connection & schema sync BEFORE opening the listening port
  if (db.initPromise) {
    try {
      await db.initPromise;
    } catch (err) {
      console.warn('Database initialization warning:', err.message);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Loulou Boutiqaat backend listening on 0.0.0.0:${PORT} [DB: ${db.sequelize?.config?.database || 'unknown'}]`);
    if (inventoryReady) startWorkers();
    else waitForOpeningInventory();
  });
})();
