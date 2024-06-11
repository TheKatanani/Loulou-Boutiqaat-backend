"use strict";

var express = require('express');

var router = express.Router();

var _require = require('../../controllers/countryCodeController.js'),
    addCountryCode = _require.addCountryCode,
    deleteCountryCode = _require.deleteCountryCode,
    getCountryCode = _require.getCountryCode,
    updateCountryCode = _require.updateCountryCode;

var verifyJWT = require('../../middleware/verifyJWT.js');

var verifyRoles = require('../../middleware/verifyRoles.js');

var ROLES_LIST = require('../../config/roles_list.js');

router.route('/').get(getCountryCode).post(verifyJWT, verifyRoles([ROLES_LIST.Admin, ROLES_LIST.Editor]), addCountryCode);
router.route('/:id').put(verifyJWT, verifyRoles([ROLES_LIST.Admin, ROLES_LIST.Editor]), updateCountryCode)["delete"](verifyJWT, verifyRoles([ROLES_LIST.Admin]), deleteCountryCode);
module.exports = router;