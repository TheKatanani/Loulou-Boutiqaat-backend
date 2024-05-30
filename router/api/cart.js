const express = require('express')
const router = express.Router()
const {
  clearCart,
  getCartItems,
  quantityCartItem,
  deleteFromCart,
  addToCart
} = require('../../controllers/cartController')

router.route('/clearCart')
  .delete(clearCart)
router.route('/:id')
  .delete(deleteFromCart)

router.route('/')
  .get(getCartItems)
  .put(quantityCartItem) // update quantity and add the operator 
  .post(addToCart)
module.exports = router