const express = require('express');
const router = express.Router();
const { protect } = require('../controllers/authController');
const rbac = require('../middleware/rbac');
const {
    getClientReport,
    getQuotationReport,
    getSalesOrderReport,
    getInventoryReport,
    getManufacturingReport,
    getDashboardOverview
} = require('../controllers/reportController');

/**
 * Report Routes
 * All routes require authentication and support various role-based access
 */

// Apply authentication middleware to all routes
router.use(protect);

/**
 * Dashboard overview endpoint
 * @route GET /api/reports/dashboard
 * @desc Get combined dashboard metrics from all reports
 * @access Private (Admin, Manager, Staff)
 */
router.get('/dashboard', rbac(['Admin', 'Manager', 'Staff']), getDashboardOverview);

/**
 * Client analytics endpoints
 * @route GET /api/reports/clients
 * @desc Get client analytics report with conversion rates, lead sources, etc.
 * @access Private (Admin, Manager, Staff)
 * @query {string} startDate - Start date filter (YYYY-MM-DD)
 * @query {string} endDate - End date filter (YYYY-MM-DD)
 * @query {string} status - Follow-up status filter
 * @query {string} leadSource - Lead source filter
 */
router.get('/clients', rbac(['Admin', 'Manager', 'Staff']), getClientReport);

/**
 * Quotation analytics endpoints
 * @route GET /api/reports/quotations
 * @desc Get quotation analytics with conversion rates, trends, product analysis
 * @access Private (Admin, Manager, Staff)
 * @query {string} startDate - Start date filter (YYYY-MM-DD)
 * @query {string} endDate - End date filter (YYYY-MM-DD)
 * @query {string} status - Quotation status filter
 * @query {string} clientId - Client ID filter
 */
router.get('/quotations', rbac(['Admin', 'Manager', 'Staff']), getQuotationReport);

/**
 * Sales order analytics endpoints
 * @route GET /api/reports/sales-orders
 * @desc Get sales order analytics with completion rates, production status, trends
 * @access Private (Admin, Manager, Staff)
 * @query {string} startDate - Start date filter (YYYY-MM-DD)
 * @query {string} endDate - End date filter (YYYY-MM-DD)
 * @query {string} status - Order status filter
 * @query {string} clientId - Client ID filter
 */
router.get('/sales-orders', rbac(['Admin', 'Manager', 'Staff']), getSalesOrderReport);

/**
 * Inventory analytics endpoints
 * @route GET /api/reports/inventory
 * @desc Get inventory analytics with stock levels by length, valuation, low stock alerts
 * @access Private (Admin, Manager, Staff)
 * @query {string} category - Material category filter (Profile, Glass, Hardware, etc.)
 * @query {boolean} lowStockOnly - Filter to show only low stock items
 */
router.get('/inventory', rbac(['Admin', 'Manager', 'Staff']), getInventoryReport);

/**
 * Manufacturing analytics endpoints
 * @route GET /api/reports/manufacturing
 * @desc Get manufacturing analytics with cutting efficiency, scrap analysis, material performance
 * @access Private (Admin, Manager, Staff)
 * @query {string} startDate - Start date filter (YYYY-MM-DD)
 * @query {string} endDate - End date filter (YYYY-MM-DD)
 * @query {string} materialId - Material ID filter for specific material analysis
 */
router.get('/manufacturing', rbac(['Admin', 'Manager', 'Staff']), getManufacturingReport);

module.exports = router; 