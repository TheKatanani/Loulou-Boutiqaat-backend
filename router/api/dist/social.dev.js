"use strict";

var express = require('express');

var router = express.Router();

var _require = require('../../controllers/socialController'),
    getSocialItems = _require.getSocialItems,
    updateSocial = _require.updateSocial;

var verifyRoles = require('../../middleware/verifyRoles');

var ROLES_LIST = require('../../config/roles_list');

var verifyJWT = require('../../middleware/verifyJWT');

router.route('/').get(getSocialItems).put(verifyJWT, verifyRoles(ROLES_LIST.ADMIN, ROLES_LIST.EDITOR), updateSocial);
module.exports = router;