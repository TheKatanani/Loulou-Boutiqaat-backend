const db = require('../models')
const Order = db.order
const getOrders = async (req, res) => {
  try {
    let orders = await Order.findAll()
    let newOrders = orders.map(order => {
      order.orders = JSON.parse(order.orders)
      return order
    })
    res.status(200).send(newOrders)
  } catch (err) {
    res.status(400).json({
      message: err
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
    res.status(201).json(order)
  } catch (err) {
    res.status(400).json({
      message: err
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
      order.orders = JSON.parse(order.orders)
      res.json(order)
    } else {
      res.status(404).json({
        message: `can not found this order!`
      })
    }
  } catch (err) {
    res.status(400).json({
      message: err
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
      res.status(200).json({
        message: 'order is deleted!'
      })
    } else {
      res.status(404).json({
        message: 'order is not found!'
      })
    }
  } catch (err) {
    res.json({
      message: err
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
    order.orders =  JSON.parse(order.orders) 
    res.status(200).json(order)
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}

module.exports = {
  addOrder,
  getOrders,
  getOrder,
  updateOrder,
  deleteOrder,
}