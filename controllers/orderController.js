const db = require('../models')
const Order = db.order 

const parseOrders = (orders) => {
  if (!orders) return [];
  if (Array.isArray(orders) || typeof orders === 'object') return orders;
  if (typeof orders === 'string') {
    try {
      return JSON.parse(orders);
    } catch (e) {
      return orders;
    }
  }
  return orders;
};

const formatOrder = (order) => {
  if (!order) return order;
  const o = order.dataValues ? { ...order.dataValues } : { ...order };
  o.orders = parseOrders(o.orders);
  return o;
};

const getOrders = async (req, res) => {
  try {
    let orders = await Order.findAll()
    let newOrders = (orders || []).map(formatOrder);
    res.status(200).send(newOrders)
  } catch (err) {
    res.status(400).json({
      message: err?.message || err
    })
  }
}
const addOrder = async (req, res) => {
  const userId = req.id
  try {
    const order = await Order.create({
      ...req.body,
      userId
    })
    res.status(201).json(formatOrder(order))
  } catch (err) {
    res.status(400).json({
      message: err?.message || err
    })
  }
}
const updateOrder = async (req, res) => {
  const id = req.params.id
  try {
    const foundedItem = await Order.findOne({
      where: {
        id
      }
    })
    if (foundedItem) {
      await Order.update(req.body, {
        where: {
          id
        }
      })
      const order = await Order.findOne({
        where: {
          id
        }
      })
      res.json(formatOrder(order))
    } else {
      res.status(404).json({
        message: `can not found this order!`
      })
    }
  } catch (err) {
    res.status(400).json({
      message: err?.message || err
    })
  }
}
const deleteOrder = async (req, res) => {
  const id = req.params.id
  try {
    const foundedItem = await Order.findOne({
      where: {
        id
      }
    })
    if (foundedItem) {
      await Order.destroy({
        where: {
          id
        }
      })
      res.status(200).json(id)
    } else {
      res.status(404).json({
        message: 'order is not found!'
      })
    }
  } catch (err) {
    res.status(400).json({
      message: err?.message || err
    })
  }
}
const cancelOrder = async (req, res) => {
  const orderId = req.params.id
  const userId = req.id 
  try {
    const foundedOrder = await Order.findOne({
      where: {
        id:orderId
      }
    }) 
    if (foundedOrder && foundedOrder.userId == userId) {
      await Order.destroy({
        where: {
          id:orderId
        }
      })
      res.status(200).json(orderId)
    } else {
      res.status(404).json({
        message: 'order is not found!'
      })
    }
  } catch (err) {
    res.status(400).json({
      message: err?.message || err
    })
  }
}
const getOrder = async (req, res) => {
  const id = req.params.id
  try {
    let order = await Order.findOne({
      where: {
        id
      }
    })
    if (!order) {
      return res.status(404).json({
        message: 'Order not found'
      })
    }
    res.status(200).json(formatOrder(order))
  } catch (err) {
    res.status(400).json({
      message: err?.message || err
    })
  }
}

module.exports = {
  addOrder,
  getOrders,
  getOrder,
  updateOrder,
  deleteOrder,
  cancelOrder
}