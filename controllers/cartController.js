const {
  OPERATOR
} = require("../Actions")
const db = require("../models")
const Cart = db.cart

const getCartItems = async (req, res) => {
  const userId = req.id
  try {
    const cartItems = await Cart.findAll({
      where: {
        userId
      },
      attributes: ["productId", "quantity"]
    })
    res.status(200).json({
      data: cartItems,
      userId
    })
  } catch (err) {
    res.json({
      message: err
    })
  }
}
const uploadLocalCart = async (req, res) => {
  const userId = req.id
  const {
    localCart
  } = req.body
  try {
    localCart?.map(async (item) => {
      const founded = await Cart.findOne({
        where: {
          productId: item.productId,
          userId
        }
      })
      item = {
        ...item,
        userId,
      }
      if (founded) {
        await Cart.update(item, {
          where: {
            userId,
            productId: item.productId
          }
        })
      } else {
        await Cart.create(item)
      }
    })
    res.sendStatus(201)
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}
const addToCart = async (req, res) => {
  const id = req.id
  const {
    productId,
    quantity
  } = req.body
  const cartItem = {
    productId,
    userId: id,
    quantity
  }
  try {
    await Cart.create(cartItem)
    res.status(201).json({
      productId,
      quantity
    })
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}
const deleteFromCart = async (req, res) => {
  const id = req.id
  const productId = req.params.id
  try {
    const foundedItem = await Cart.findOne({
      where: {
        productId,
        userId: id
      }
    })
    if (foundedItem) {
      await Cart.destroy({
        where: {
          productId,
          userId: id
        }
      })
      res.json(productId)
    } else {
      res.status(400).json({
        message: `Cart item with product ID ${productId} Is Not Found!`
      })
    }
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}
const clearCart = async (req, res) => {
  const id = req.id
  try {
    await Cart.destroy({
      where: {
        userId: id
      }
    })
    res.json({
      success: `Clear Cart successfully!`
    })

  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}
const quantityCartItem = async (req, res) => {
  const userId = req.id
  const productId = req.params.id
  const {
    operator
  } = req.body
  try {
    const foundedItem = await Cart.findOne({
      where: {
        productId,
        userId
      }
    })
    if (foundedItem) {
      if (foundedItem?.quantity <= 0 && operator === OPERATOR.DECREASE) {
        await Cart.destroy({
          where: {
            productId,
            userId
          }
        })
      } else {
        const newQuantity = (operator === OPERATOR.INCREASE ? ++foundedItem.quantity : --foundedItem.quantity)
        await Cart.update({
          quantity: newQuantity
        }, {
          where: {
            productId,
            userId
          }
        })
      }
      const cartItems = await Cart.findAll({
        where: {
          userId
        },
        attributes: ["productId", "quantity"]
      })
      res.json(cartItems)
    } else {
      res.status(400).json({
        message: `Cart item with product ID ${productId} Is Not Found!`
      })
    }
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}
module.exports = {
  addToCart,
  getCartItems,
  deleteFromCart,
  clearCart,
  quantityCartItem,
  uploadLocalCart
}