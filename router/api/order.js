const express = require('express')
const router = express.Router()
const {
  addOrder,
  deleteOrder,
  getOrder,
  getOrders,
  updateOrder
} = require('../../controllers/orderController')
router.route('/')
  .get(getOrders)
  .post(addOrder)
router.route('/:id')
  .get(getOrder)
  .put(updateOrder)
  .delete(deleteOrder)
module.exports = router