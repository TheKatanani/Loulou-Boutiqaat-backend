const express = require('express')
const router = express.Router()
const {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getUser,
  updateUserInfo
} = require('../../controllers/userController')
const verifyRoles = require('../../middleware/verifyRoles')
const ROLES_LIST = require('../../config/roles_list') 

router.route('/')
  .get(verifyRoles(ROLES_LIST.EDITOR, ROLES_LIST.ADMIN), getAllUsers)
  .post(verifyRoles(ROLES_LIST.ADMIN), createUser)
router.route('/updateUserInfo')
  .put(updateUserInfo)
router.route('/:id')
  .put(verifyRoles(ROLES_LIST.ADMIN), updateUser)
  .delete(verifyRoles(ROLES_LIST.ADMIN), deleteUser)
  .get(getUser)
module.exports = router