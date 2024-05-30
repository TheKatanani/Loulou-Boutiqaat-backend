const db = require("../models")
const Cart = db.cart

const getCartItems = async (req, res) => {
  const id = req.id
  try {
    const cartItems = await Cart.findAll({
      where: {
        id
      },
      attributes: ["productId", "quantity"]
    })
    res.status(200).json({
      data: cartItems,
      userId: id
    })
  } catch (err) {
    res.json({
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
      success: `Cart Item Created Successfolly!`
    })
  } catch (err) {
    res.json({
      message: err.errors[0].message 
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
      res.json({
        success: `the cart item with product ID:${productId} was deleted!`
      })
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
      success: `Clear Cart Successfolly!`
    })

  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}
const quantityCartItem = async (req, res) => {
  const id = req.id
  const {
    productId,
    operator
  } = req.body
  try {

    const foundedItem = await Cart.findOne({
      where: { 
            productId ,
            userId: id 
      }
    })
 
    if (foundedItem) { 
      if (foundedItem?.quantity >= 1) {
        console.log("foundedItem.quantity",foundedItem.quantity)
        const newQuantity = (operator === "increase" ? ++foundedItem.quantity : --foundedItem.quantity)
        console.log(newQuantity)
        await Cart.update({
          quantity: newQuantity
        }, {
          where: { 
            productId,
            userId: id 
          }
        }) 
      } else {
        await Cart.destroy({
          where: { 
                productId,
                userId: id 
          }
        })
      }
      res.json({
        success: `Update Quantity cart item with product ID:${productId} !`
      })
    } else {
      res.status(400).json({
        message: `Cart item with product ID ${productId} Is Not Found!`
      })
    }
  } catch (err) {
    res.json({
      message: err
    })
  }
}
module.exports = {
  addToCart,
  getCartItems,
  deleteFromCart,
  clearCart,
  quantityCartItem
}