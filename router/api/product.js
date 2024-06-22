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
  .post(verifyJWT,verifyRoles(ROLES_LIST.ADMIN, ROLES_LIST.EDITOR), addProduct)
router.route('/published')
  .get(getPublishedProducts)
router.route('/:id')
  .get(verifyRoles(ROLES_LIST.USER, ROLES_LIST.EDITOR, ROLES_LIST.ADMIN), getProduct)
  .put(verifyJWT,verifyRoles(ROLES_LIST.EDITOR, ROLES_LIST.ADMIN), updateProduct)
  .delete(verifyJWT,verifyRoles(ROLES_LIST.ADMIN), deleteProduct)
module.exports = router