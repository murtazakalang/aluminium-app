const express = require('express');
const router = express.Router();
const estimationController = require('../controllers/estimationController');
const { protect } = require('../controllers/authController');
const rbac = require('../middleware/rbac');

/**
 * Estimation Routes
 * Provides RESTful endpoints for material estimation management
 */

// Protect all routes
router.use(protect);

// Create a new estimation
router.post('/', 
    rbac(['Manager', 'Admin']), 
    estimationController.createEstimation
);

// List estimations
router.get('/', 
    rbac(['Manager', 'Admin']), 
    estimationController.listEstimations
);

// Get a specific estimation
router.get('/:id', 
    rbac(['Manager', 'Admin']), 
    estimationController.getEstimation
);

// Update an estimation
router.put('/:id', 
    rbac(['Manager', 'Admin']), 
    estimationController.updateEstimation
);

// Delete an estimation
router.delete('/:id', 
    rbac(['Manager', 'Admin']), 
    estimationController.deleteEstimation
);

// Calculate materials for an estimation
router.post('/:id/calculate', 
    rbac(['Manager', 'Admin']), 
    estimationController.calculateEstimationMaterials
);

// Generate PDF for an estimation
router.get('/:id/pdf', 
    rbac(['Manager', 'Admin']), 
    estimationController.generateEstimationPDF
);

// Convert an estimation to a quotation
router.post('/:id/to-quotation',
    rbac(['Manager', 'Admin']),
    estimationController.convertToQuotation
);

// NEW: Calculate glass for specific estimation item
router.get('/:id/calculate-glass',
    rbac(['Manager', 'Admin', 'Staff']),
    estimationController.calculateGlassForItem
);

module.exports = router; 