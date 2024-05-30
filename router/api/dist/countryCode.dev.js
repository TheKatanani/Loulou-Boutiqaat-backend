"use strict";

var express = require('express');

var router = express.Router();

var _require = require('../../controllers/countryCodeController.js'),
    addCountryCode = _require.addCountryCode,
    deleteCountryCode = _require.deleteCountryCode,
    getCountryCode = _require.getCountryCode,
    updateCountryCode = _require.updateCountryCode;

router.route('/').get(getCountryCode).post(addCountryCode);
router.route('/:id').put(updateCountryCode)["delete"](deleteCountryCode);
module.exports = router;