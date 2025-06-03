const express = require('express');
const invoiceController = require('../controllers/invoiceController');
const { protect } = require('../controllers/authController'); // Correct import for protect
const rbac = require('../middleware/rbac'); // Corrected import for rbac

const router = express.Router();

// Protect all routes for this router
router.use(protect);

// Create invoice from order - Admin/Manager only
router.post('/from-order/:orderId', rbac(['Admin', 'Manager']), invoiceController.createInvoiceFromOrder);

// List invoices - All roles can view
router.get('/', rbac(['Admin', 'Manager', 'Staff']), invoiceController.listInvoices);

// Get specific invoice - All roles can view
router.get('/:invoiceId', rbac(['Admin', 'Manager', 'Staff']), invoiceController.getInvoiceById);

// Generate PDF for invoice - All roles can generate
router.get('/:invoiceId/pdf', rbac(['Admin', 'Manager', 'Staff']), invoiceController.getInvoicePDF);

// Record payment - Admin/Manager only
router.post('/:invoiceId/payments', rbac(['Admin', 'Manager']), invoiceController.recordPayment);

// Update invoice status - Admin/Manager only
router.put('/:invoiceId/status', rbac(['Admin', 'Manager']), invoiceController.updateInvoiceStatus);

// Delete/void invoice - Admin only
router.delete('/:invoiceId', rbac(['Admin']), invoiceController.deleteInvoice);

module.exports = router; 