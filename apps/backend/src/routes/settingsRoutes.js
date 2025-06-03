const express = require('express');
const router = express.Router();
const {
    getSettings,
    updateSettings,
    getPredefinedCharges,
    addPredefinedCharge,
    updatePredefinedCharge,
    deletePredefinedCharge,
    getHelpContent,
    getChangelogContent
} = require('../controllers/settingsController');
const { protect } = require('../controllers/authController');
const rbac = require('../middleware/rbac');

// Get settings
router.get('/', 
    protect, 
    rbac(['Manager', 'Admin']), 
    getSettings
);

// Update settings
router.put('/', 
    protect, 
    rbac(['Manager', 'Admin']), 
    updateSettings
);

// Predefined Charges Routes
router.get('/charges', 
    protect, 
    rbac(['Manager', 'Admin']), 
    getPredefinedCharges
);

router.post('/charges', 
    protect, 
    rbac(['Manager', 'Admin']), 
    addPredefinedCharge
);

router.put('/charges/:chargeId', 
    protect, 
    rbac(['Manager', 'Admin']), 
    updatePredefinedCharge
);

router.delete('/charges/:chargeId', 
    protect, 
    rbac(['Manager', 'Admin']), 
    deletePredefinedCharge
);

// Help & Changelog Routes
router.get('/help', 
    protect, 
    rbac(['Manager', 'Admin']), 
    getHelpContent
);

router.get('/changelog', 
    protect, 
    rbac(['Manager', 'Admin']), 
    getChangelogContent
);

module.exports = router; 