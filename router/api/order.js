const express = require('express')
const router = express.Router()
const {
  addOrder,
  deleteOrder,
  getOrder,
  getOrders,
  updateOrder,
  cancelOrder
} = require('../../controllers/orderController')
const verifyRoles = require('../../middleware/verifyRoles')
const ROLES_LIST = require('../../config/roles_list')
router.route('/')
  .get(getOrders)
  .post(addOrder)
router.route('/cancel/:id')
  .delete(cancelOrder)
router.route('/:id')
  .get(getOrder)
  .put(verifyRoles(ROLES_LIST.EDITOR, ROLES_LIST.ADMIN), updateOrder)
  .delete(verifyRoles(ROLES_LIST.EDITOR, ROLES_LIST.ADMIN), deleteOrder)
module.exports = router