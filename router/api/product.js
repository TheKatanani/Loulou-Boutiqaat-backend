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
const verifyJWT = require('../../middleware/verifyJWT')

router.route('/')
  .get(getProducts) 
  .post(verifyJWT,verifyRoles(ROLES_LIST.Admin, ROLES_LIST.Editor), addProduct)
router.route('/published')
  .get(getPublishedProducts)
router.route('/:id')
  .get(verifyRoles(ROLES_LIST.User, ROLES_LIST.Editor, ROLES_LIST.Admin), getProduct)
  .put(verifyJWT,verifyRoles(ROLES_LIST.Editor, ROLES_LIST.Admin), updateProduct)
  .delete(verifyJWT,verifyRoles(ROLES_LIST.Admin), deleteProduct)
module.exports = router