"use strict";

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var db = require('../models');

var Order = db.order;

var getOrders = function getOrders(req, res) {
  var orders, newOrders;
  return regeneratorRuntime.async(function getOrders$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _context.next = 3;
          return regeneratorRuntime.awrap(Order.findAll());

        case 3:
          orders = _context.sent;
          newOrders = orders.map(function (order) {
            order.orders = JSON.parse(order.orders);
            return order;
          });
          res.status(200).send(newOrders);
          _context.next = 11;
          break;

        case 8:
          _context.prev = 8;
          _context.t0 = _context["catch"](0);
          res.status(400).json({
            message: _context.t0
          });

        case 11:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 8]]);
};

var addOrder = function addOrder(req, res) {
  var userId, order;
  return regeneratorRuntime.async(function addOrder$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          userId = req.id;
          _context2.prev = 1;
          _context2.next = 4;
          return regeneratorRuntime.awrap(Order.create(_objectSpread({}, req.body, {
            userId: userId
          })));

        case 4:
          order = _context2.sent;
          res.status(201).json(order);
          _context2.next = 11;
          break;

        case 8:
          _context2.prev = 8;
          _context2.t0 = _context2["catch"](1);
          res.status(400).json({
            message: _context2.t0
          });

        case 11:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[1, 8]]);
};

var updateOrder = function updateOrder(req, res) {
  var id, foundedItem, order;
  return regeneratorRuntime.async(function updateOrder$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          id = req.params.id;
          _context3.prev = 1;
          _context3.next = 4;
          return regeneratorRuntime.awrap(Order.findOne({
            where: {
              id: id
            }
          }));

        case 4:
          foundedItem = _context3.sent;

          if (!foundedItem) {
            _context3.next = 15;
            break;
          }

          _context3.next = 8;
          return regeneratorRuntime.awrap(Order.update(req.body, {
            where: {
              id: id
            }
          }));

        case 8:
          _context3.next = 10;
          return regeneratorRuntime.awrap(Order.findOne({
            where: {
              id: id
            }
          }));

        case 10:
          order = _context3.sent;
          order.orders = JSON.parse(order.orders);
          res.json(order);
          _context3.next = 16;
          break;

        case 15:
          res.status(404).json({
            message: "can not found this order!"
          });

        case 16:
          _context3.next = 21;
          break;

        case 18:
          _context3.prev = 18;
          _context3.t0 = _context3["catch"](1);
          res.status(400).json({
            message: _context3.t0
          });

        case 21:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[1, 18]]);
};

var deleteOrder = function deleteOrder(req, res) {
  var id, foundedItem;
  return regeneratorRuntime.async(function deleteOrder$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          id = req.params.id;
          _context4.prev = 1;
          _context4.next = 4;
          return regeneratorRuntime.awrap(Order.findOne({
            where: {
              id: id
            }
          }));

        case 4:
          foundedItem = _context4.sent;

          if (!foundedItem) {
            _context4.next = 11;
            break;
          }

          _context4.next = 8;
          return regeneratorRuntime.awrap(Order.destroy({
            where: {
              id: id
            }
          }));

        case 8:
          res.status(200).json(id);
          _context4.next = 12;
          break;

        case 11:
          res.status(404).json({
            message: 'order is not found!'
          });

        case 12:
          _context4.next = 17;
          break;

        case 14:
          _context4.prev = 14;
          _context4.t0 = _context4["catch"](1);
          res.json({
            message: _context4.t0
          });

        case 17:
        case "end":
          return _context4.stop();
      }
    }
  }, null, null, [[1, 14]]);
};

var cancelOrder = function cancelOrder(req, res) {
  var orderId, userId, foundedOrder;
  return regeneratorRuntime.async(function cancelOrder$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          orderId = req.params.id;
          userId = req.id;
          _context5.prev = 2;
          _context5.next = 5;
          return regeneratorRuntime.awrap(Order.findOne({
            where: {
              id: orderId
            }
          }));

        case 5:
          foundedOrder = _context5.sent;

          if (!(foundedOrder && foundedOrder.userId == userId)) {
            _context5.next = 12;
            break;
          }

          _context5.next = 9;
          return regeneratorRuntime.awrap(Order.destroy({
            where: {
              id: orderId
            }
          }));

        case 9:
          res.status(200).json(orderId);
          _context5.next = 13;
          break;

        case 12:
          res.status(404).json({
            message: 'order is not found!'
          });

        case 13:
          _context5.next = 18;
          break;

        case 15:
          _context5.prev = 15;
          _context5.t0 = _context5["catch"](2);
          res.status(400).json({
            message: _context5.t0
          });

        case 18:
        case "end":
          return _context5.stop();
      }
    }
  }, null, null, [[2, 15]]);
};

var getOrder = function getOrder(req, res) {
  var id, order;
  return regeneratorRuntime.async(function getOrder$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          id = req.params.id;
          _context6.prev = 1;
          _context6.next = 4;
          return regeneratorRuntime.awrap(Order.findOne({
            where: {
              id: id
            }
          }));

        case 4:
          order = _context6.sent;
          order.orders = JSON.parse(order.orders);
          res.status(200).json(order);
          _context6.next = 12;
          break;

        case 9:
          _context6.prev = 9;
          _context6.t0 = _context6["catch"](1);
          res.status(400).json({
            message: _context6.t0
          });

        case 12:
        case "end":
          return _context6.stop();
      }
    }
  }, null, null, [[1, 9]]);
};

module.exports = {
  addOrder: addOrder,
  getOrders: getOrders,
  getOrder: getOrder,
  updateOrder: updateOrder,
  deleteOrder: deleteOrder,
  cancelOrder: cancelOrder
};