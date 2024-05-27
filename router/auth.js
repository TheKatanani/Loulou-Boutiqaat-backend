const path = require('path')
const express = require('express') 
const { loginHandler } = require('../controllers/authController')
const router = express.Router() 

router.post('/', loginHandler)

module.exports = router 