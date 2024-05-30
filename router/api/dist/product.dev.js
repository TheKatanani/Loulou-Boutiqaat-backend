"use strict";

var express = require('express');

var router = express.Router();

var _require = require('../../controllers/productCotroller'),
    getProduct = _require.getProduct,
    getProducts = _require.getProducts,
    updateProduct = _require.updateProduct,
    addProduct = _require.addProduct,
    deleteProduct = _require.deleteProduct,
    getPublishedProducts = _require.getPublishedProducts;

var verifyRoles = require('../../middleware/verifyRoles');

var ROLES_LIST = require('../../config/roles_list');

router.route('/').get(verifyRoles(ROLES_LIST.User, ROLES_LIST.Editor, ROLES_LIST.Admin), getProducts).post(verifyRoles(ROLES_LIST.Admin, ROLES_LIST.Editor), addProduct);
router.route('/published').get(getPublishedProducts);
router.route('/:id').get(verifyRoles(ROLES_LIST.User, ROLES_LIST.Editor, ROLES_LIST.Admin), getProduct).put(verifyRoles(ROLES_LIST.Editor, ROLES_LIST.Admin), updateProduct)["delete"](verifyRoles(ROLES_LIST.Admin), deleteProduct);
module.exports = router;