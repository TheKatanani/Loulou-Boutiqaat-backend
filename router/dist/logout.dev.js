"use strict";

var path = require('path');

var express = require('express');

var logoutHandler = require('../controllers/logoutController');

var router = express.Router();
router.post('/', logoutHandler);
module.exports = router;