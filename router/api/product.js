const express = require('express')
const router = express.Router()
const {
  getProduct,
  getProducts,
  updateProduct,
  updateProductStock,
  addProduct,
  deleteProduct,
  getPublishedProducts
} = require('../../controllers/productCotroller')
const verifyRoles = require('../../middleware/verifyRoles')
const ROLES_LIST = require('../../config/roles_list')
const verifyJWT = require('../../middleware/verifyJWT')

router.route('/')
  .get(getProducts) 
  .post(verifyJWT, verifyRoles(ROLES_LIST.ADMIN, ROLES_LIST.EDITOR), addProduct)

router.route('/published')
  .get(getPublishedProducts)

router.route('/:id/stock')
  .patch(verifyJWT, verifyRoles(ROLES_LIST.EDITOR, ROLES_LIST.ADMIN), updateProductStock)
  .put(verifyJWT, verifyRoles(ROLES_LIST.EDITOR, ROLES_LIST.ADMIN), updateProductStock)

router.route('/:id')
  .get(getProduct)
  .put(verifyJWT, verifyRoles(ROLES_LIST.EDITOR, ROLES_LIST.ADMIN), updateProduct)
  .delete(verifyJWT, verifyRoles(ROLES_LIST.ADMIN), deleteProduct)

module.exports = router
