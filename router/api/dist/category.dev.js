"use strict";

var express = require('express');

var router = express.Router();

var _require = require('../../controllers/categoryController'),
    getCategorys = _require.getCategorys,
    addCategory = _require.addCategory,
    deleteCategory = _require.deleteCategory,
    updateCategory = _require.updateCategory,
    getPublishedCategorys = _require.getPublishedCategorys;

router.route('/').get(getCategorys).post(addCategory);
router.route('/published').get(getPublishedCategorys);
router.route('/:id').put(updateCategory)["delete"](deleteCategory);
module.exports = router;