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

var verifyJWT = require('../../middleware/verifyJWT');

router.route('/').get(getProducts).post(verifyJWT, verifyRoles(ROLES_LIST.ADMIN, ROLES_LIST.EDITOR), addProduct);
router.route('/published').get(getPublishedProducts);
router.route('/:id').get(verifyRoles(ROLES_LIST.USER, ROLES_LIST.EDITOR, ROLES_LIST.ADMIN), getProduct).put(verifyJWT, verifyRoles(ROLES_LIST.EDITOR, ROLES_LIST.ADMIN), updateProduct)["delete"](verifyJWT, verifyRoles(ROLES_LIST.ADMIN), deleteProduct);
module.exports = router;