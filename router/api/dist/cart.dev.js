"use strict";

var express = require('express');

var router = express.Router();

var _require = require('../../controllers/cartController'),
    clearCart = _require.clearCart,
    getCartItems = _require.getCartItems,
    quantityCartItem = _require.quantityCartItem,
    deleteFromCart = _require.deleteFromCart,
    addToCart = _require.addToCart,
    uploadLocalCart = _require.uploadLocalCart;

router.route('/clearCart')["delete"](clearCart);
router.route('/:id')["delete"](deleteFromCart).put(quantityCartItem);
router.route('/').get(getCartItems).post(addToCart).put(uploadLocalCart);
module.exports = router;