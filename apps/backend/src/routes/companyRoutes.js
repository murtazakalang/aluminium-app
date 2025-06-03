const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { protect } = require('../controllers/authController');
const { uploadLogo, handleUploadError } = require('../middleware/upload');

const rbac = require('../middleware/rbac');

// According to PRD User Roles:
// Tenant Admin: Manages company settings...
// Manager: ...cannot manage company settings.
// So, only 'Admin' role can access these company profile routes.
const ADMIN_ROLE = ['Admin'];

router.get('/my', protect, rbac(ADMIN_ROLE), companyController.getMyCompany);
router.put('/my', protect, rbac(ADMIN_ROLE), companyController.updateMyCompany);

// Logo upload routes
router.post('/my/logo', protect, rbac(ADMIN_ROLE), uploadLogo, handleUploadError, companyController.uploadLogo);
router.delete('/my/logo', protect, rbac(ADMIN_ROLE), companyController.removeLogo);

module.exports = router; 