const db = require("../models")
const Saved = db.saved

const getSavedItems = async (req, res) => {
  const id = req.id
  try {
    const savedItems = await Saved.findAll({
      where: {
        userId:id
      },
      attributes: ["productId"]
    })
    res.status(200).json({
      data: savedItems,
      userId: id
    })
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}
const addToSaved = async (req, res) => {
  const id = req.id
  const {
    productId 
  } = req.body
  const savedItem = {
    productId,
    userId: id 
  }
  try {
    await Saved.create(savedItem)
    res.status(201).json({
      success: `Saved Item Created Successfolly!`
    })
  } catch (err) {
    res.status(400).json({
      message: err.errors[0].message 
    })
  }
}
const deleteFromSaved = async (req, res) => {
  const id = req.id
  const productId = req.params.id
  try {
    const foundedItem = await Saved.findOne({
      where: {
        productId, 
        userId: id 
      }
    })
    if (foundedItem) {
      await Saved.destroy({
        where: { 
            productId,
            userId: id 
        }
      })
      res.json({
        success: `the saved item with product ID:${productId} was deleted!`
      })
    } else {
      res.status(400).json({
        message: `saved item with product ID ${productId} Is Not Found!`
      })
    }
  } catch (err) { 
    res.status(400).json({
      message: err
    })
  }
}
const clearSaved = async (req, res) => { 
  const id = req.id
  try {
    await Saved.destroy({
      where: {
        userId: id
      }
    })
    res.json({
      success: `Clear saved Successfolly!`
    })

  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}
 
module.exports = {
  addToSaved,
  getSavedItems,
  deleteFromSaved,
  clearSaved 
}