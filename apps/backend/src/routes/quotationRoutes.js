const express = require('express');
const router = express.Router();
const {
    createQuotation,
    getQuotations,
    getQuotationById,
    updateQuotation,
    deleteQuotation,
    sendQuotation,
    updateQuotationStatus,
    generateQuotationPDF,
    generateItemSVG,
    generateAllItemsSVG,
    generateQuotationLayoutSVG,
    sendQuotationByEmail
} = require('../controllers/quotationController');

// Import middleware
const { protect } = require('../controllers/authController'); // For JWT/session authentication
const rbac = require('../middleware/rbac'); // For enforcing role permissions

// Apply authentication middleware globally to all quotation routes
router.use(protect);

// PDF generation route - now protected
router.route('/:id/pdf')
    .get(rbac(['Admin', 'Manager', 'Staff']), generateQuotationPDF);

// Routes with RBAC
// Multi-tenancy is handled within controllers using req.user.companyId

// Quotation CRUD
router.route('/')
    .get(rbac(['Admin', 'Manager', 'Staff']), getQuotations) // All roles can view
    .post(rbac(['Admin', 'Manager', 'Staff']), createQuotation); // All roles can create

router.route('/:quotationId')
    .get(rbac(['Admin', 'Manager', 'Staff']), getQuotationById) // All roles can view
    .put(rbac(['Admin', 'Manager', 'Staff']), updateQuotation) // All roles can edit draft
    .delete(rbac(['Admin', 'Manager']), deleteQuotation); // Only Admin/Manager can delete

// Quotation workflow actions
router.route('/:quotationId/send')
    .post(rbac(['Admin', 'Manager', 'Staff']), sendQuotation); // All roles can send

router.route('/:quotationId/status')
    .put(rbac(['Admin', 'Manager']), updateQuotationStatus); // Only Admin/Manager can update status

// Email Quotation
router.route('/:id/send-email')
    .post(rbac(['Admin', 'Manager', 'Staff']), sendQuotationByEmail); // All roles can send email

// Document generation
// router.route('/:id/pdf')
//     .get(rbac(['Admin', 'Manager', 'Staff']), generateQuotationPDF); // All roles can generate PDF

// SVG generation routes
router.route('/:quotationId/svg')
    .get(rbac(['Admin', 'Manager', 'Staff']), generateAllItemsSVG); // All roles can generate all items SVG

router.route('/:quotationId/svg/layout')
    .get(rbac(['Admin', 'Manager', 'Staff']), generateQuotationLayoutSVG); // All roles can generate layout SVG

router.route('/:quotationId/svg/:itemId')
    .get(rbac(['Admin', 'Manager', 'Staff']), generateItemSVG); // All roles can generate individual item SVG

module.exports = router; 