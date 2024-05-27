const express = require('express')
const path = require('path')
const cors = require('cors')
const bodyParser = require("body-parser");
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

app.use(bodyParser.json());

// middleware to handle urlencoded form data
app.use(express.urlencoded({
  extended: false
})) 
// middleware for cookies
app.use(express.json())

// middleware for cookies
app.use(cookieParser())

app.use(credentials)
//cross origin resourse sharing 
app.use(cors(corsOptions))

app.use(express.static(path.join(__dirname, '/public')))

app.use('^/$', require('./router/root.js'))

app.use('/register', require('./router/register'))
app.use('/login', require('./router/auth'))
app.use('/refresh', require('./router/refresh'))
app.use('/logout', require('./router/logout'))

//any route under this line must verify by jwt
app.use(verifyJWT)

// API
app.use('/users', require('./router/api/users'))
app.use('/product', require('./router/api/product.js'))
app.use('/cart', require('./router/api/cart.js'))



app.use(logger)
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


app.listen(PORT, () => {
  console.log(`app listing on port ${PORT}`)
})