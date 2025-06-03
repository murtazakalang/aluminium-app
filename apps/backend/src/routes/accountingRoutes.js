const express = require('express');
const accountingController = require('../controllers/accountingController');
const { protect } = require('../controllers/authController'); // Correct import for protect
const rbac = require('../middleware/rbac'); // Corrected import for rbac

const router = express.Router();

// Protect all routes for this router
router.use(protect);

// Sales ledger - Admin/Manager can view, Staff has limited access
router.get('/sales-ledger', rbac(['Admin', 'Manager', 'Staff']), accountingController.getSalesLedger);

// P&L Simple - Admin/Manager only (financial data is sensitive)
router.get('/pnl-simple', rbac(['Admin', 'Manager']), accountingController.getPnLSimple);

// Payment summary - Admin/Manager only
router.get('/payment-summary', rbac(['Admin', 'Manager']), accountingController.getPaymentSummary);

module.exports = router; 