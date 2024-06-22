"use strict";

var db = require("../models");

var Social = db.social;

var getSocialItems = function getSocialItems(req, res) {
  var SocialItems;
  return regeneratorRuntime.async(function getSocialItems$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _context.next = 3;
          return regeneratorRuntime.awrap(Social.findAll({
            attributes: ["name", "value"]
          }));

        case 3:
          SocialItems = _context.sent;
          res.status(200).json(SocialItems);
          _context.next = 10;
          break;

        case 7:
          _context.prev = 7;
          _context.t0 = _context["catch"](0);
          res.status(400).json({
            message: _context.t0
          });

        case 10:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 7]]);
};

var updateSocial = function updateSocial(req, res) {
  var _req$body, name, value;

  return regeneratorRuntime.async(function updateSocial$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _req$body = req.body, name = _req$body.name, value = _req$body.value;
          _context2.prev = 1;
          _context2.next = 4;
          return regeneratorRuntime.awrap(Social.update({
            name: name,
            value: value
          }, {
            where: {
              name: name
            }
          }));

        case 4:
          res.sendStatus(200);
          _context2.next = 10;
          break;

        case 7:
          _context2.prev = 7;
          _context2.t0 = _context2["catch"](1);
          res.status(400).json({
            message: _context2.t0
          });

        case 10:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[1, 7]]);
};

module.exports = {
  getSocialItems: getSocialItems,
  updateSocial: updateSocial
};