const express = require('express')
const router = express.Router()
const {
  getProduct,
  getProducts,
  updateProduct,
  addProduct,
  deleteProduct,
  getPublishedProducts
} = require('../../controllers/productCotroller')
const verifyRoles = require('../../middleware/verifyRoles')
const ROLES_LIST = require('../../config/roles_list')

router.route('/')
  .get(verifyRoles(ROLES_LIST.User, ROLES_LIST.Editor, ROLES_LIST.Admin), getProducts)
  .post(verifyRoles(ROLES_LIST.Admin, ROLES_LIST.Editor), addProduct)
router.route('/:id')
  .get(verifyRoles(ROLES_LIST.User, ROLES_LIST.Editor, ROLES_LIST.Admin), getProduct)
  .put(verifyRoles(ROLES_LIST.Editor, ROLES_LIST.Admin), updateProduct)
  .delete(verifyRoles(ROLES_LIST.Admin), deleteProduct)
router.route('/published')
  .get(getPublishedProducts)
module.exports = router