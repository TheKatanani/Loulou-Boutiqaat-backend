const express = require('express')
const router = express.Router()
const {
  clearCart,
  getCartItems,
  quantityCartItem,
  deleteFromCart,
  addToCart,
  uploadLocalCart
} = require('../../controllers/cartController')

router.route('/clearCart')
  .delete(clearCart)
router.route('/:id')
  .delete(deleteFromCart)
  .put(quantityCartItem)

router.route('/')
  .get(getCartItems)
  .post(addToCart)
  .put(uploadLocalCart)
module.exports = router