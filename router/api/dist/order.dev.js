"use strict";

var express = require('express');

var router = express.Router();

var _require = require('../../controllers/orderController'),
    addOrder = _require.addOrder,
    deleteOrder = _require.deleteOrder,
    getOrder = _require.getOrder,
    getOrders = _require.getOrders,
    updateOrder = _require.updateOrder;

router.route('/').get(getOrders).post(addOrder);
router.route('/:id').get(getOrder).put(updateOrder)["delete"](deleteOrder);
module.exports = router;