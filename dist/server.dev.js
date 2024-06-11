"use strict";

var express = require('express');

var path = require('path');

var cors = require('cors');

var bodyParser = require("body-parser");

var _require = require('./middleware/errorHandler'),
    errorHandler = _require.errorHandler;

var _require2 = require('./middleware/logEvents'),
    logger = _require2.logger;

var _require3 = require('./config/corsOption.js'),
    corsOptions = _require3.corsOptions;

var verifyJWT = require('./middleware/verifyJWT.js');

var cookieParser = require('cookie-parser');

var credentials = require('./middleware/credentials.js');

var app = express();
var PORT = process.env.PORT || 3500;
app.use(bodyParser.json({
  estended: true,
  limit: '50mb'
})); // middleware to handle urlencoded form data

app.use(express.urlencoded({
  extended: false
})); // middleware for cookies

app.use(express.json()); // middleware for cookies

app.use(cookieParser());
app.use(credentials); //cross origin resourse sharing 

app.use(cors(corsOptions)); // app.use(cors({
//   origin:'http://localhost:3001',
//   allowHeaders:['Authorization'],
//   credentials:true,
//   methods:['GET','POST','PUT','DELETE']
// })) 

app.use(express["static"](path.join(__dirname, '/public')));
app.use('^/$', require('./router/root.js'));
app.use('/register', require('./router/register'));
app.use('/login', require('./router/auth'));
app.use('/refresh', require('./router/refresh'));
app.use('/logout', require('./router/logout')); // API

app.use('/product', require('./router/api/product.js'));
app.use('/countryCode', require('./router/api/countryCode.js'));
app.use('/category', require('./router/api/category.js')); //any route under this line must verify by jwt

app.use(verifyJWT);
app.use('/users', require('./router/api/users'));
app.use('/cart', require('./router/api/cart.js'));
app.use('/saved', require('./router/api/saved.js'));
app.use(logger); //DOES NOT WORK

app.all('*', function (req, res) {
  res.status(404);

  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'views', '404.html'));
  } else if (req.accepts('json')) {
    res.send({
      error: '404 Not Found'
    });
  } else {
    res.type('txt').send('404 Not Found');
  }
});
app.use(errorHandler);
app.listen(PORT, function () {
  console.log("app listing on port ".concat(PORT));
});