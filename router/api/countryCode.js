const express = require('express')
const router = express.Router()
const {
  addCountryCode,
  deleteCountryCode,
  getCountryCode,
  updateCountryCode
} = require('../../controllers/countryCodeController.js')

router.route('/')
  .get(getCountryCode)
  .post(addCountryCode)
router.route('/:id')
  .put(updateCountryCode)
  .delete(deleteCountryCode)
module.exports = router