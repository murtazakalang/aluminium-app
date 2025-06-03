const express = require('express');
const router = express.Router();
const { protect } = require('../controllers/authController');
const rbac = require('../middleware/rbac');
const batchInventoryController = require('../controllers/batchInventoryController');
const wireMeshController = require('../controllers/wireMeshController');

// Apply authentication to all routes
router.use(protect);

/**
 * Stock Inward Routes
 */

// Record new stock inward (create new batch)
router.post('/stock-inward', 
    rbac(['Admin', 'Manager', 'Staff']), 
    batchInventoryController.recordStockInward
);

/**
 * Stock Consumption Routes
 */

// Consume stock from batches
router.post('/consume-stock', 
    rbac(['Admin', 'Manager', 'Staff']), 
    batchInventoryController.consumeStock
);

/**
 * Stock Reporting Routes
 */

// Get detailed stock report for a material
router.get('/stock-report/:materialId', 
    rbac(['Admin', 'Manager', 'Staff']), 
    batchInventoryController.getStockReport
);

// Get batch history for a material
router.get('/batch-history/:materialId', 
    rbac(['Admin', 'Manager', 'Staff']), 
    batchInventoryController.getBatchHistory
);

// Get consumption history with order details for a material
router.get('/consumption-history/:materialId', 
    rbac(['Admin', 'Manager', 'Staff']), 
    batchInventoryController.getConsumptionHistory
);

// Get available batches for consumption
router.get('/available-batches/:materialId', 
    rbac(['Admin', 'Manager', 'Staff']), 
    batchInventoryController.getAvailableBatches
);

/**
 * Material Management Routes
 */

// Create new material with predefined lengths and gauges
router.post('/create-simplified-material', 
    rbac(['Admin', 'Manager']), 
    batchInventoryController.createSimplifiedMaterial
);

// List all materials with batch summary
router.get('/materials', 
    rbac(['Admin', 'Manager', 'Staff']), 
    batchInventoryController.getMaterialsList
);

// Delete a material (only if no active batches)
router.delete('/materials/:materialId', 
    rbac(['Admin', 'Manager']), 
    batchInventoryController.deleteMaterial
);

/**
 * Wire Mesh Optimization Routes
 */

// Test Wire Mesh width optimization
router.post('/wire-mesh/test-optimization', 
    rbac(['Admin', 'Manager', 'Staff']), 
    wireMeshController.testWireMeshOptimization
);

// Get Wire Mesh efficiency analysis
router.get('/wire-mesh/:materialId/efficiency', 
    rbac(['Admin', 'Manager', 'Staff']), 
    wireMeshController.getWireMeshEfficiencyAnalysis
);

// Calculate Wire Mesh for window
router.post('/wire-mesh/calculate-window', 
    rbac(['Admin', 'Manager', 'Staff']), 
    wireMeshController.calculateWireMeshForWindow
);

// Test Wire Mesh consumption for manufacturing
router.post('/wire-mesh/test-consumption', 
    rbac(['Admin', 'Manager', 'Staff']), 
    wireMeshController.testWireMeshConsumption
);

module.exports = router; 