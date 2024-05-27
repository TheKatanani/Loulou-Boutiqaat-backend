const express = require('express')
const router = express.Router()
const {
  getAllUsers,
  // createUser,
  updateUser,
  deleteUser,
  getUser
} = require('../../controllers/userController')
const verifyRoles = require('../../middleware/verifyRoles')
const ROLES_LIST = require('../../config/roles_list')

router.route('/')
  .get(verifyRoles(ROLES_LIST.Editor, ROLES_LIST.Admin),getAllUsers) 
  router.route('/:id')
  .put(verifyRoles(ROLES_LIST.Editor, ROLES_LIST.Admin), updateUser)
  .delete(verifyRoles(ROLES_LIST.Admin), deleteUser)
  .get(verifyRoles(ROLES_LIST.User, ROLES_LIST.Editor, ROLES_LIST.Admin), getUser)
module.exports = router