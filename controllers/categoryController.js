const db = require('../models')
const Category = db.category
const getCategorys = async (req, res) => {
  try {
    let categories = await Category.findAll()
    res.status(200).send(categories)
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}
const addCategory = async (req, res) => {
  let info = {
    name: req.body?.name,
    description: req.body?.description,
    background: req.body?.background,
    published: req.body?.published,
  }
  try {
    const category = await Category.create(info)
    res.status(201).json(category)
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}
const updateCategory = async (req, res) => {
  const id = req.params.id
  try {
    const foundedItem = await Category.findOne({
      where: {
        id
      }
    })
    if (foundedItem) {
      await Category.update(req.body, {
        where: {
          id
        }
      })
      res.json(req.body)
    } else {
      res.status(400).json({
        message: `can not found this category!`
      })
    }
  } catch (err) {
    res.json({
      message: err
    })
  }
}
const deleteCategory = async (req, res) => {
  const id = req.params.id
  try {
    const foundedItem = await Category.findOne({
      where: {
        id
      }
    })
    if (foundedItem) {
      await Category.destroy({
        where: {
          id
        }
      })
      res.status(200).json({
        message: 'Category is deleted!'
      })
    } else {
      res.status(400).json({
        message: 'Category is not found!'
      })
    }
  } catch (err) {
    res.json({
      message: err
    })
  }
}

const getPublishedCategorys = async (req, res) => {
  try {
    let categorys = await Category.findAll({
      where: {
        published: true
      }
    })
    res.status(200).send(categorys)
  } catch (err) {
    res.json({
      message: err
    })
  }
}

module.exports = {
  addCategory,
  getCategorys,
  updateCategory,
  deleteCategory,
  getPublishedCategorys
}