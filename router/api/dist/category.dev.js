"use strict";

var express = require('express');

var router = express.Router();

var _require = require('../../controllers/categoryController'),
    getCategorys = _require.getCategorys,
    addCategory = _require.addCategory,
    deleteCategory = _require.deleteCategory,
    updateCategory = _require.updateCategory,
    getPublishedCategorys = _require.getPublishedCategorys;

var verifyJWT = require('../../middleware/verifyJWT');

var verifyRoles = require('../../middleware/verifyRoles');

var ROLES_LIST = require('../../config/roles_list');

router.route('/').get(getCategorys).post(verifyJWT, verifyRoles(ROLES_LIST.ADMIN, ROLES_LIST.EDITOR), addCategory);
router.route('/published').get(getPublishedCategorys);
router.route('/:id').put(verifyJWT, verifyRoles(ROLES_LIST.ADMIN, ROLES_LIST.EDITOR), updateCategory)["delete"](verifyJWT, verifyRoles(ROLES_LIST.ADMIN), deleteCategory);
module.exports = router;