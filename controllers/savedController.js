const db = require("../models")
const Saved = db.saved

const getSavedItems = async (req, res) => {
  const id = req.id
  try {
    const savedItems = await Saved.findAll({
      where: {
        userId: id
      },
      attributes: ["productId"]
    })
    const saved = savedItems.map(el => el.productId)
    res.status(200).json({
      data: saved,
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
    res.status(201).json(productId)
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}
const uploadLocalSaved = async (req, res) => {
  const userId = req.id
  const {
    localSaved
  } = req.body
  try {
    localSaved?.map(async (productId) => {
      const founded = await Saved.findOne({
        where: {
          productId,
          userId
        }
      })
      let item = {
        productId,
        userId,
      }
      if (founded) {
        await Saved.update(item, {
          where: {
            userId,
            productId
          }
        })
      } else {
        await Saved.create(item)
      }
    })
    res.sendStatus(201)
  } catch (err) {
    res.status(400).json({
      message: err
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
      res.json(productId)
    } else {
      res.status(404).json({
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
      success: `Clear saved successfully!`
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
  clearSaved,
  uploadLocalSaved
}