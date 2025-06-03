const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { protect } = require('../controllers/authController');
const rbac = require('../middleware/rbac');
// const productValidationMiddleware = require('../middleware/productValidationMiddleware'); // Placeholder for specific product validations

// Protect all routes
router.use(protect);

router.route('/')
    .get(
        rbac(['Admin', 'Manager', 'Staff']), 
        productController.getAllProducts
    )
    .post(
        rbac(['Admin', 'Manager']), 
        productController.createProduct
    );

router.route('/:productId')
    .get(
        rbac(['Admin', 'Manager', 'Staff']), 
        productController.getProductById
    )
    .put(
        rbac(['Admin', 'Manager']), 
        productController.updateProduct
    )
    .delete(
        rbac(['Admin', 'Manager']), 
        productController.deleteProduct
    );

// New route for formula validation
router.post('/validate-formula', 
    rbac(['Admin', 'Manager']), 
    productController.validateFormula
);

// NEW: Glass formula validation route
router.post('/validate-glass-formula', 
    rbac(['Admin', 'Manager']), 
    productController.validateGlassFormula
);

// Route for product cost calculation
router.post('/calculate-cost', 
    rbac(['Admin', 'Manager', 'Staff']), 
    productController.calculateProductCost
);

// NEW: Glass formula management routes
router.route('/:productId/glass-formula')
    .get(
        rbac(['Admin', 'Manager', 'Staff']), 
        productController.getGlassFormula
    )
    .put(
        rbac(['Admin', 'Manager']), 
        productController.updateGlassFormula
    );

// NEW: Glass placement sheet generation
router.get('/glass-placement/:estimationId',
    rbac(['Admin', 'Manager', 'Staff']),
    productController.generateGlassPlacementSheet
);

// SVG Technical Drawing routes
router.route('/:productId/generate-svg')
    .post(
        rbac(['Admin', 'Manager']), 
        productController.generateSVG
    );

router.route('/:productId/technical-drawing')
    .put(
        rbac(['Admin', 'Manager']), 
        productController.updateTechnicalDrawing
    );

// Placeholder route for cost calculation if needed, as per PRD Module 4
// router.post('/:productId/calculate-cost', productController.calculateProductCost);

module.exports = router; 