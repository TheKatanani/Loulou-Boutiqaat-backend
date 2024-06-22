const express = require('express')
const router = express.Router()
const {
  getSocialItems,
  updateSocial
} = require('../../controllers/socialController')
const verifyRoles = require('../../middleware/verifyRoles')
const ROLES_LIST = require('../../config/roles_list')


router.route('/')
  .get(getSocialItems)
  .put(verifyRoles(ROLES_LIST.ADMIN, ROLES_LIST.EDITOR), updateSocial)

module.exports = router