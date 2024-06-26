"use strict";

var allowedOrigins = require('./allowedOrigins.js');

var corsOptions = {
  origin: function origin(_origin, callback) {
    if (allowedOrigins.indexOf(_origin) !== -1 || !_origin) {
      //during the development //if you send from local get undefind for origin
      callback(null, true); //the first parameter is errors and null mean no errors and the second allowd to access our api
    } else {
      callback(new Error('not allowd by cors'));
    }
  },
  optionsSuccessStatus: 200
};
module.exports = {
  corsOptions: corsOptions
};