const express = require('express');
const router = express.Router();
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');
const ROLES_LIST = require('../../config/roles_list');
const {
  getOverview,
  getInventoryProducts,
  receiveStockHandler,
  adjustStockHandler,
  getStockMovementsHandler,
  getProfitabilityReportHandler,
} = require('../../controllers/inventoryController');

// All inventory and cost valuation routes require Admin or Editor roles
router.use(verifyJWT, verifyRoles(ROLES_LIST.EDITOR, ROLES_LIST.ADMIN));

router.get('/overview', getOverview);
router.get('/products', getInventoryProducts);
router.post('/receive', receiveStockHandler);
router.post('/adjust', adjustStockHandler);
router.get('/movements', getStockMovementsHandler);
router.get('/profitability', getProfitabilityReportHandler);

module.exports = router;
