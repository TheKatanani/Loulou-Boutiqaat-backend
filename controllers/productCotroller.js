const {
  Op
} = require('sequelize')
const db = require('../models')
const Product = db.products

const parseImages = (images) => {
  if (!images) return [];
  if (Array.isArray(images)) return images;
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      return [images];
    }
  }
  return [images];
};

const formatProduct = (product) => {
  if (!product) return product;
  const p = product.dataValues ? { ...product.dataValues } : { ...product };
  p.images = parseImages(p.images);
  return p;
};

const getProducts = async (req, res) => {
  const {
    name_like,
    categoryId
  } = req.query 

  if (!db.isConnected) {
    let prods = db.mockData.mockProducts;
    if (categoryId) {
      prods = prods.filter(p => p.categoryId == categoryId);
    }
    if (name_like) {
      prods = prods.filter(p => p.name.includes(name_like));
    }
    return res.status(200).send(prods);
  }

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
    const newProducts = (products || []).map(formatProduct);
    res.status(200).send(newProducts)
  } catch (err) {
    res.status(400).json({
      message: err?.message || err
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
    stars: req.body?.stars,
    categoryId: req.body?.categoryId,
    published: req.body?.published || false
  }
  try {
    const product = await Product.create(info)
    res.status(201).json(formatProduct(product))
  } catch (err) {
    res.status(400).json({
      message: err?.message || err
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
      res.json(formatProduct(product))
    } else {
      res.status(404).json({
        message: `can not found this Product!`
      })
    }
  } catch (err) {
    res.status(400).json({
      message: err?.message || err
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
    res.status(400).json({
      message: err?.message || err
    })
  }
}

const getProduct = async (req, res) => {
  const id = req.params.id
  if (!db.isConnected) {
    const p = db.mockData.mockProducts.find(item => item.id == id);
    if (!p) {
      return res.status(404).json({ message: 'Product not found' });
    }
    return res.status(200).json(p);
  }
  try {
    let product = await Product.findOne({
      where: {
        id: id
      }
    })
    if (!product) {
      return res.status(404).json({
        message: 'Product not found'
      })
    }
    res.status(200).json(formatProduct(product))
  } catch (err) {
    res.status(400).json({
      message: err?.message || err
    })
  }
}

const getPublishedProducts = async (req, res) => {
  if (!db.isConnected) {
    return res.status(200).json(db.mockData.mockProducts.filter(p => p.published));
  }
  try {
    let products = await Product.findAll({
      where: {
        published: true,
      }
    })
    const newProducts = (products || []).map(formatProduct);
    res.status(200).json(newProducts)
  } catch (err) {
    res.status(400).json({
      message: err?.message || err
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