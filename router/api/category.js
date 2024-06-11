const express = require('express')
const router = express.Router()
const {
  getCategorys,
  addCategory,
  deleteCategory,
  updateCategory,
  getPublishedCategorys
} = require('../../controllers/categoryController')
const verifyJWT = require('../../middleware/verifyJWT')
const verifyRoles = require('../../middleware/verifyRoles')
const ROLES_LIST = require('../../config/roles_list')

router.route('/')
  .get(getCategorys)
  .post(verifyJWT, verifyRoles(ROLES_LIST.ADMIN, ROLES_LIST.EDITOR), addCategory)
router.route('/published')
  .get(getPublishedCategorys)
router.route('/:id')
  .put(verifyJWT, verifyRoles(ROLES_LIST.ADMIN, ROLES_LIST.EDITOR), updateCategory)
  .delete(verifyJWT, verifyRoles(ROLES_LIST.ADMIN), deleteCategory)
module.exports = router