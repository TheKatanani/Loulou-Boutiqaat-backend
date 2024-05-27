const db = require('../models')
const Product = db.products
const getProducts = async (req, res) => {
  let products = await Product.findAll() //get all info 
  // let products = await Product.findAll({
  //   attributes:['title','price']
  // })//get specific attr
  res.status(200).send(products)
}
const addProduct = async (req, res) => {
  let info = {
    name: req.body?.name,
    description: req.body?.description,
    price: req.body?.price,
    images:req.body?.images,
    prevPrice: req.body?.prevPrice,
    stars: req.body?.stars,
    published: req.body?.published || false
  }
  try { 
    const product = await Product.create(info)
    res.status(200).json(product)
  } catch (err) {
    res.json({
      message: `Something went wrong!,${err}`
    })
  } 
}
const updateProduct = async (req, res) => {
  const id = req.params.id
  let product = await Product.update(req.body, {
    where: {
      id: id
    }
  })
  res.status(200).send(product)
}
const deleteProduct = async (req, res) => {
  const id = req.params.id
  await Product.destroy({
    where: {
      id: id
    }
  })
  res.status(200).json({
    message: 'Product is deleted!'
  })
}
const getProduct = async (req, res) => {
  const id = req.params.id
  let product = await Product.findOne({
    where: {
      id: id
    }
  })
  res.status(200).send(product)
}
const getPublishedProducts = async (req, res) => {
  let products = await Product.findAll({
    where: {
      published: true
    }
  })
  res.status(200).send(products)
}

module.exports = {
  addProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getPublishedProducts
}