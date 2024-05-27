const express = require('express')
const router = express.Router()
const {
  clearCart, getCartItems, quantityCartItem, deleteFromCart, addToCart
} = require('../../controllers/cartController')

router.route('/:id')
  .delete(deleteFromCart)

router.route('/')
  .get(getCartItems)
  .put(quantityCartItem)
  .post(addToCart)
router.route('/clearCart')
  .get(clearCart)
module.exports = router