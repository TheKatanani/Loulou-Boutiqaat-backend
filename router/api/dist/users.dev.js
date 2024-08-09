"use strict";

var express = require('express');

var router = express.Router();

var _require = require('../../controllers/userController'),
    getAllUsers = _require.getAllUsers,
    createUser = _require.createUser,
    updateUser = _require.updateUser,
    deleteUser = _require.deleteUser,
    getUser = _require.getUser,
    updateUserInfo = _require.updateUserInfo;

var verifyRoles = require('../../middleware/verifyRoles');

var ROLES_LIST = require('../../config/roles_list');

router.route('/').get(verifyRoles(ROLES_LIST.EDITOR, ROLES_LIST.ADMIN), getAllUsers).post(verifyRoles(ROLES_LIST.ADMIN), createUser);
router.route('/updateUserInfo').put(updateUserInfo);
router.route('/:id').put(verifyRoles(ROLES_LIST.ADMIN), updateUser)["delete"](verifyRoles(ROLES_LIST.ADMIN), deleteUser).get(getUser);
module.exports = router;