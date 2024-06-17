"use strict";

var express = require('express');

var router = express.Router();

var _require = require('../../controllers/savedController'),
    clearSaved = _require.clearSaved,
    getSavedItems = _require.getSavedItems,
    deleteFromSaved = _require.deleteFromSaved,
    addToSaved = _require.addToSaved,
    uploadLocalSaved = _require.uploadLocalSaved;

router.route('/clearSaved')["delete"](clearSaved);
router.route('/:id')["delete"](deleteFromSaved);
router.route('/').get(getSavedItems).post(addToSaved).put(uploadLocalSaved);
module.exports = router;