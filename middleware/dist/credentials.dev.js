"use strict";

var allowedOrigins = require("../config/allowedOrigins");

var credentials = function credentials(req, res, next) {
  var origin = req.headers.origin;

  if (allowedOrigins.includes(origin) || !origin) {
    res.header('Access-control-Allow-Credentials', true);
  }

  next();
};

module.exports = credentials;