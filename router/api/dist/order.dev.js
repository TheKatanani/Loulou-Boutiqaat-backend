"use strict";

var express = require('express');

var router = express.Router();

var _require = require('../../controllers/orderController'),
    addOrder = _require.addOrder,
    deleteOrder = _require.deleteOrder,
    getOrder = _require.getOrder,
    getOrders = _require.getOrders,
    updateOrder = _require.updateOrder,
    cancelOrder = _require.cancelOrder;

var verifyRoles = require('../../middleware/verifyRoles');

var ROLES_LIST = require('../../config/roles_list');

router.route('/').get(getOrders).post(addOrder);
router.route('/cancel/:id')["delete"](cancelOrder);
router.route('/:id').get(getOrder).put(verifyRoles(ROLES_LIST.EDITOR, ROLES_LIST.ADMIN), updateOrder)["delete"](verifyRoles(ROLES_LIST.EDITOR, ROLES_LIST.ADMIN), deleteOrder);
module.exports = router;