const db = require('../models')
const Category = db.category
const getCategorys = async (req, res) => {
  let categories = await Category.findAll()
  res.status(200).send(categories)
}
const addCategory = async (req, res) => {
  const id = req.id
  let info = {
    name: req.body?.name,
    description: req.body?.description,
    background: req.body?.background,
    published: req.body?.published,
    userId: id
  }
  try {
    const category = await Category.create(info, {
      where: {
        userId: id
      }
    })
    res.status(201).json({
      success: `${category.name} Catigory Added Successfolly!`
    })
  } catch (err) {
    res.status(400).json({
      message: `Something went wrong!,${err}`
    })
  }
}
const updateCategory = async (req, res) => {
  const id = req.params.id
  const userId = req.id
  try {
    const foundedItem = await Category.findOne({
      where: {
        userId,
        id
      }
    })
    if (foundedItem) { 
      await Category.update(req.body, {
        where: {
          userId,
          id
        }
      })
      res.json({
        success: `Category Updated Successfolly!`
      })
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
  const userId = req.id
  try {
    const foundedItem = await Category.findOne({
      where: {
        userId,
        id
      }
    })
    if(foundedItem){ 
      await Category.destroy({
        where: {
          id ,
          userId
        }
      })
      res.status(200).json({
        message: 'Category is deleted!'
      })
    }else {
      res.status(400).json({
        message: 'Category is not found!'
      })
    }
  }catch (err){
    res.json({
      message: err
    })
  }
}

const getPublishedCategorys = async (req, res) => {
  const userId = req.id
  let categorys = await Category.findAll({
    where: {
      published: true,
      userId
    }
  })
  res.status(200).send(categorys)
}

module.exports = {
  addCategory,
  getCategorys, 
  updateCategory,
  deleteCategory,
  getPublishedCategorys
}