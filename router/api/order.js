const express = require('express');
const router = express.Router();
const {
  addOrder,
  deleteOrder,
  getOrder,
  getOrders,
  updateOrder,
  cancelOrder,
  createWhatsAppDraftHandler,
  getWhatsAppDraftHandler,
  cancelWhatsAppDraftHandler,
  adminUpdateStatusHandler,
} = require('../../controllers/orderController');
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');
const ROLES_LIST = require('../../config/roles_list');

// ========================================================
// 1. PUBLIC ROUTES (No JWT required)
// Allows guest WhatsApp stock reservation, resuming & canceling drafts
// ========================================================
router.post('/whatsapp-draft', createWhatsAppDraftHandler);
router.get('/whatsapp-draft/:id', getWhatsAppDraftHandler);
router.delete('/whatsapp-draft/:id', cancelWhatsAppDraftHandler);

// ========================================================
// 2. PROTECTED ROUTES (Require valid JWT)
// ========================================================
router.use(verifyJWT);

router.route('/')
  .get(getOrders)
  .post(addOrder);

router.route('/cancel/:id')
  .delete(cancelOrder);

router.route('/admin/:id/status')
  .put(verifyRoles(ROLES_LIST.EDITOR, ROLES_LIST.ADMIN), adminUpdateStatusHandler);

router.route('/:id')
  .get(getOrder)
  .put(verifyRoles(ROLES_LIST.EDITOR, ROLES_LIST.ADMIN), updateOrder)
  .delete(verifyRoles(ROLES_LIST.EDITOR, ROLES_LIST.ADMIN), deleteOrder);

module.exports = router;
