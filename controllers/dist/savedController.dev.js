"use strict";

var db = require("../models");

var Saved = db.saved;

var getSavedItems = function getSavedItems(req, res) {
  var id, savedItems, saved;
  return regeneratorRuntime.async(function getSavedItems$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          id = req.id;
          _context.prev = 1;
          _context.next = 4;
          return regeneratorRuntime.awrap(Saved.findAll({
            where: {
              userId: id
            },
            attributes: ["productId"]
          }));

        case 4:
          savedItems = _context.sent;
          saved = savedItems.map(function (el) {
            return el.productId;
          });
          res.status(200).json({
            data: saved,
            userId: id
          });
          _context.next = 12;
          break;

        case 9:
          _context.prev = 9;
          _context.t0 = _context["catch"](1);
          res.status(400).json({
            message: _context.t0
          });

        case 12:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[1, 9]]);
};

var addToSaved = function addToSaved(req, res) {
  var id, productId, savedItem;
  return regeneratorRuntime.async(function addToSaved$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          id = req.id;
          productId = req.body.productId;
          savedItem = {
            productId: productId,
            userId: id
          };
          _context2.prev = 3;
          _context2.next = 6;
          return regeneratorRuntime.awrap(Saved.create(savedItem));

        case 6:
          res.status(201).json(productId);
          _context2.next = 12;
          break;

        case 9:
          _context2.prev = 9;
          _context2.t0 = _context2["catch"](3);
          res.status(400).json({
            message: _context2.t0
          });

        case 12:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[3, 9]]);
};

var deleteFromSaved = function deleteFromSaved(req, res) {
  var id, productId, foundedItem;
  return regeneratorRuntime.async(function deleteFromSaved$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          id = req.id;
          productId = req.params.id;
          _context3.prev = 2;
          _context3.next = 5;
          return regeneratorRuntime.awrap(Saved.findOne({
            where: {
              productId: productId,
              userId: id
            }
          }));

        case 5:
          foundedItem = _context3.sent;

          if (!foundedItem) {
            _context3.next = 12;
            break;
          }

          _context3.next = 9;
          return regeneratorRuntime.awrap(Saved.destroy({
            where: {
              productId: productId,
              userId: id
            }
          }));

        case 9:
          res.json(productId);
          _context3.next = 13;
          break;

        case 12:
          res.status(404).json({
            message: "saved item with product ID ".concat(productId, " Is Not Found!")
          });

        case 13:
          _context3.next = 18;
          break;

        case 15:
          _context3.prev = 15;
          _context3.t0 = _context3["catch"](2);
          res.status(400).json({
            message: _context3.t0
          });

        case 18:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[2, 15]]);
};

var clearSaved = function clearSaved(req, res) {
  var id;
  return regeneratorRuntime.async(function clearSaved$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          id = req.id;
          _context4.prev = 1;
          _context4.next = 4;
          return regeneratorRuntime.awrap(Saved.destroy({
            where: {
              userId: id
            }
          }));

        case 4:
          res.json({
            success: "Clear saved Successfolly!"
          });
          _context4.next = 10;
          break;

        case 7:
          _context4.prev = 7;
          _context4.t0 = _context4["catch"](1);
          res.status(400).json({
            message: _context4.t0
          });

        case 10:
        case "end":
          return _context4.stop();
      }
    }
  }, null, null, [[1, 7]]);
};

module.exports = {
  addToSaved: addToSaved,
  getSavedItems: getSavedItems,
  deleteFromSaved: deleteFromSaved,
  clearSaved: clearSaved
};