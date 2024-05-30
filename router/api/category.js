const express = require('express')
const router = express.Router()
const {
  getCategorys,
  addCategory,
  deleteCategory,
  updateCategory,
  getPublishedCategorys
} = require('../../controllers/categoryController') 

router.route('/')
  .get(getCategorys)
  .post(addCategory)
router.route('/published')
  .get(getPublishedCategorys)
router.route('/:id')
  .put(updateCategory)
  .delete(deleteCategory) 
module.exports = router