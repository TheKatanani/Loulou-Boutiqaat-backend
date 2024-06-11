"use strict";

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var db = require("../models");

var User = db.users;

var getAllUsers = function getAllUsers(req, res) {
  var users;
  return regeneratorRuntime.async(function getAllUsers$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _context.next = 3;
          return regeneratorRuntime.awrap(User.findAll({
            attributes: {
              exclude: ['refreshToken']
            }
          }));

        case 3:
          users = _context.sent;
          res.status(200).json(users);
          _context.next = 10;
          break;

        case 7:
          _context.prev = 7;
          _context.t0 = _context["catch"](0);
          res.status(400).json({
            message: "Users Not Found! "
          });

        case 10:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 7]]);
};

var getUser = function getUser(req, res) {
  var id, user;
  return regeneratorRuntime.async(function getUser$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          id = req.params.id;
          _context2.next = 3;
          return regeneratorRuntime.awrap(User.findOne({
            where: {
              id: id
            }
          }));

        case 3:
          user = _context2.sent;

          if (user) {
            res.json({
              user: user
            });
          } else {
            res.status(400).json({
              message: "User ID ".concat(req.params.id, " Is Not Found! ")
            });
          }

        case 5:
        case "end":
          return _context2.stop();
      }
    }
  });
}; // const createUser = (req, res) => {
//   const user = {
//     "id": v4(),
//     "name": req.body?.name,
//     "phone": req.body?.phone,
//     "password": req.body?.password,
//     "gender": req.body?.gender,
//     "barthDay": req.body?.barthDay,
//     "role": req.body?.role
//   } //new user
//   // you must add validation here 
//   // in this example you update the fucken variable not the json object
//   const isExist = users.data.find(_user => _user.id === user?.id)
//   if (isExist) {
//     const filterUsers = users.data.filter(_user => _user.id !== parseInt(user.id))
//     users.setData([...filterUsers, user])
//   } else {
//     users.setData([...users.data, user])
//   }
//   res.json(user)
// } there create user in the register controller


var updateUser = function updateUser(req, res) {
  var id, user, foundedUser, updated;
  return regeneratorRuntime.async(function updateUser$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          id = req.params.id;
          user = req.body; //new user

          _context3.prev = 2;
          _context3.next = 5;
          return regeneratorRuntime.awrap(User.findOne({
            where: {
              id: id
            }
          }));

        case 5:
          foundedUser = _context3.sent;

          if (!foundedUser) {
            _context3.next = 13;
            break;
          }

          _context3.next = 9;
          return regeneratorRuntime.awrap(User.update(_objectSpread({}, foundedUser, {}, user), {
            where: {
              id: id
            }
          }));

        case 9:
          updated = _context3.sent;

          if (updated) {
            res.json({
              success: "User with ID:".concat(id, ", updated successfoly!")
            });
          } else {
            res.json({
              message: 'something went wrong!'
            });
          }

          _context3.next = 14;
          break;

        case 13:
          res.status(400).json({
            message: "User ID ".concat(req.params.id, " Is Not Found! ")
          });

        case 14:
          res.status(201).json(user);
          _context3.next = 20;
          break;

        case 17:
          _context3.prev = 17;
          _context3.t0 = _context3["catch"](2);
          res.json({
            message: "something went wrong!,Error:".concat(_context3.t0)
          });

        case 20:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[2, 17]]);
};

var deleteUser = function deleteUser(req, res) {
  var id, foundedUser;
  return regeneratorRuntime.async(function deleteUser$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          id = req.params.id;
          _context4.prev = 1;
          _context4.next = 4;
          return regeneratorRuntime.awrap(User.findOne({
            where: {
              id: id
            }
          }));

        case 4:
          foundedUser = _context4.sent;

          if (!foundedUser) {
            _context4.next = 11;
            break;
          }

          _context4.next = 8;
          return regeneratorRuntime.awrap(User.destroy({
            where: {
              id: id
            }
          }));

        case 8:
          res.json({
            success: "the user with ID:".concat(id, " was deleted!")
          });
          _context4.next = 12;
          break;

        case 11:
          res.status(400).json({
            message: "User ID ".concat(req.params.id, " Is Not Found!")
          });

        case 12:
          _context4.next = 17;
          break;

        case 14:
          _context4.prev = 14;
          _context4.t0 = _context4["catch"](1);
          res.status(400).json({
            message: "Something Went Wrong!"
          });

        case 17:
        case "end":
          return _context4.stop();
      }
    }
  }, null, null, [[1, 14]]);
};

module.exports = {
  getAllUsers: getAllUsers,
  getUser: getUser,
  // createUser,
  updateUser: updateUser,
  deleteUser: deleteUser
};