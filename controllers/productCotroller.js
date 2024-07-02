const {
  Op
} = require('sequelize')
const db = require('../models')
const Product = db.products
const getProducts = async (req, res) => {
  const {
    name_like,
    categoryId
  } = req.query
  console.log(name_like)
  console.log(categoryId)
  try {
    let products
    if (categoryId && name_like) {
      products = await Product.findAll({
        where: {
          name: {
            [Op.substring]: name_like,
          },
          categoryId
        }
      })
    } else if (categoryId) {
      products = await Product.findAll({
        where: { 
          categoryId
        }
      })
    } else if (name_like) {
      products = await Product.findAll({
        where: {
          name: {
            [Op.substring]: name_like,
          } 
        }
      })
    } else {
      products = await Product.findAll()
    }
    let newProducts = products?.map(product => {
      product.images = JSON.parse(product.images)
      return product
    })
    res.status(200).send(newProducts)
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}
const addProduct = async (req, res) => {
  let info = {
    name: req.body?.name,
    description: req.body?.description,
    price: req.body?.price,
    images: req.body?.images,
    prevPrice: req.body?.prevPrice,
    count: req.body?.count,
    stars: req.body?.stars,
    categoryId: req.body?.categoryId,
    published: req.body?.published || false
  }
  try {
    const product = await Product.create(info)

    res.status(201).json(product)
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}
const updateProduct = async (req, res) => {
  const id = req.params.id
  try {
    const foundedItem = await Product.findOne({
      where: {
        id
      }
    })
    if (foundedItem) {
      await Product.update(req.body, {
        where: {
          id
        }
      })
      const product = await Product.findOne({
        where: {
          id
        }
      })
      product.images = JSON.parse(product.images)
      res.json(product)
    } else {
      res.status(404).json({
        message: `can not found this Product!`
      })
    }
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}
const deleteProduct = async (req, res) => {
  const id = req.params.id
  try {
    const foundedItem = await Product.findOne({
      where: {
        id
      }
    })
    if (foundedItem) {
      await Product.destroy({
        where: {
          id
        }
      })
      res.status(200).json({
        message: 'Product is deleted!'
      })
    } else {
      res.status(404).json({
        message: 'Product is not found!'
      })
    }
  } catch (err) {
    res.json({
      message: err
    })
  }
}
const getProduct = async (req, res) => {
  const id = req.params.id
  try {
    let product = await Product.findOne({
      where: {
        id: id
      }
    })
    product.images = JSON.parse(product.images)
    res.status(200).json(product)
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}
const getPublishedProducts = async (req, res) => {
  try {
    let products = await Product.findAll({
      where: {
        published: true,
      }
    })
    let newProducts = products.map(product => {
      product.images = JSON.parse(product.images)
      return product
    })
    res.status(200).json(newProducts)
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}

module.exports = {
  addProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getPublishedProducts
}