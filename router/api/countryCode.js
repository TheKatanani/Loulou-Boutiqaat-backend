const express = require('express')
const router = express.Router()
const {
  addCountryCode,
  deleteCountryCode,
  getCountryCode,
  updateCountryCode
} = require('../../controllers/countryCodeController.js')
const verifyJWT = require('../../middleware/verifyJWT.js') 
const verifyRoles = require('../../middleware/verifyRoles.js') 
const ROLES_LIST = require('../../config/roles_list.js')

router.route('/')
  .get(getCountryCode)
  .post(verifyJWT,verifyRoles([ROLES_LIST.Admin,ROLES_LIST.Editor]),addCountryCode)
router.route('/:id')
  .put(verifyJWT,verifyRoles([ROLES_LIST.Admin,ROLES_LIST.Editor]),updateCountryCode)
  .delete(verifyJWT,verifyRoles([ROLES_LIST.Admin]),deleteCountryCode)
module.exports = router