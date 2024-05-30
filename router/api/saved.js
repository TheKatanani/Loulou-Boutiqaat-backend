const express = require('express')
const router = express.Router()
const {
  clearSaved, getSavedItems , deleteFromSaved, addToSaved
} = require('../../controllers/savedController')

router.route('/clearSaved')
  .delete(clearSaved) 
router.route('/:id')
  .delete(deleteFromSaved)

router.route('/')
  .get(getSavedItems) 
  .post(addToSaved)
module.exports = router