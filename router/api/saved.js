const express = require('express')
const router = express.Router()
const {
  clearSaved, getSavedItems , deleteFromSaved, addToSaved, uploadLocalSaved
} = require('../../controllers/savedController')

router.route('/clearSaved')
  .delete(clearSaved) 
router.route('/:id')
  .delete(deleteFromSaved)

router.route('/')
  .get(getSavedItems) 
  .post(addToSaved)
  .put(uploadLocalSaved)
module.exports = router