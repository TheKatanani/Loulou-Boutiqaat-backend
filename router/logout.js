const path = require('path')
const express = require('express') 
const { logoutHandler } = require('../controllers/logoutController')
const router = express.Router() 

router.get('/', logoutHandler)

module.exports = router 