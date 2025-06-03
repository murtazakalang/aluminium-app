const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { protect } = require('../controllers/authController');
const rbac = require('../middleware/rbac');

// Protect all inventory routes
router.use(protect);

// Material Categories
router.get('/categories', 
    rbac(['Admin', 'Manager', 'Staff', 'Workshop']), 
    inventoryController.getMaterialCategories
);

// Material CRUD
router.post('/materials', 
    rbac(['Admin', 'Manager']), 
    inventoryController.addMaterial
);
router.get('/materials', 
    rbac(['Admin', 'Manager', 'Staff', 'Workshop']), 
    inventoryController.listMaterials
);

// NEW: Glass materials endpoint for glass type selection
router.get('/materials/glass', 
    rbac(['Admin', 'Manager', 'Staff']), 
    inventoryController.getGlassMaterials
);
router.get('/materials/:materialId', 
    rbac(['Admin', 'Manager', 'Staff', 'Workshop']), 
    inventoryController.getMaterialDetails
);
router.put('/materials/:materialId', 
    rbac(['Admin', 'Manager']), 
    inventoryController.updateMaterial
);
router.delete('/materials/:materialId', 
    rbac(['Admin', 'Manager']), 
    inventoryController.deleteMaterial
);

// Stock Management
router.post('/stock/inward-profile', 
    rbac(['Admin', 'Manager', 'Staff']), 
    inventoryController.profileStockInward 
);

router.post('/stock/adjust', 
    rbac(['Admin', 'Manager']), 
    inventoryController.adjustStock
);

router.get('/stock/history/:materialId', 
    rbac(['Admin', 'Manager', 'Staff', 'Workshop']), 
    inventoryController.getStockHistory
);

// Utility endpoint to recalculate material rates
router.post('/materials/:materialId/recalculate', 
    rbac(['Admin', 'Manager']), 
    inventoryController.recalculateMaterialRates
);

// Utility endpoint to fix mixed gauge data
router.post('/materials/:materialId/fix-gauge-data', 
    rbac(['Admin', 'Manager']), 
    inventoryController.fixMixedGaugeData
);

module.exports = router; 