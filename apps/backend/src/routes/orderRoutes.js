const express = require('express');
const orderController = require('../controllers/orderController');
const { protect } = require('../controllers/authController'); // Correct import for protect
const rbac = require('../middleware/rbac'); // Corrected import for rbac

const router = express.Router();

// Protect all routes for this router
router.use(protect);

// Route to create an order from a quotation
router.post('/from-quotation/:quotationId', rbac(['Admin', 'Manager']), orderController.createOrderFromQuotation);

// Routes for listing orders and getting a specific order
router.get('/', rbac(['Admin', 'Manager', 'Staff']), orderController.listOrders);
router.get('/:orderId', rbac(['Admin', 'Manager', 'Staff']), orderController.getOrderById);

// Route to confirm measurements for an order
router.put('/:orderId/confirm-measurements', rbac(['Admin', 'Manager']), orderController.confirmMeasurements);

// Route to get required cuts for an order
router.get('/:orderId/required-cuts', rbac(['Admin', 'Manager', 'Staff']), orderController.getRequiredCuts);

// Route for basic stock check for an order
router.post('/:orderId/check-stock', rbac(['Admin', 'Manager', 'Staff']), orderController.checkStock);

// Route for generating stock availability check PDF
router.get('/:orderId/stock-check-pdf', rbac(['Admin', 'Manager', 'Staff']), orderController.generateStockAvailabilityPDF);

// Route to update the status of an order
router.put('/:orderId/status', rbac(['Admin', 'Manager']), orderController.updateOrderStatus);

// Route to get the history of an order
router.get('/:orderId/history', rbac(['Admin', 'Manager', 'Staff']), orderController.getOrderHistory);

module.exports = router; 