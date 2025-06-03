const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
// const authenticate = require('../middleware/auth'); // To be replaced
const { protect } = require('../controllers/authController'); // Using protect from authController
const rbac = require('../middleware/rbac');

// Define roles based on PRD
const ADMIN_ONLY = ['Admin'];
const ADMIN_MANAGER = ['Admin', 'Manager'];

// GET /api/staff: List staff for the company (Admin/Manager)
router.get('/', protect, rbac(ADMIN_MANAGER), staffController.listStaff);

// POST /api/staff: Create staff manually (Admin)
router.post('/', protect, rbac(ADMIN_ONLY), staffController.createStaff);

// POST /api/staff/invite: Invite staff via email (Admin)
router.post('/invite', protect, rbac(ADMIN_ONLY), staffController.inviteStaff);

// GET /api/staff/{userId}: Get specific staff details (Admin/Manager)
router.get('/:userId', protect, rbac(ADMIN_MANAGER), staffController.getStaffMember);

// PUT /api/staff/{userId}: Update staff details/role (Admin)
router.put('/:userId', protect, rbac(ADMIN_ONLY), staffController.updateStaffMember);

// PUT /api/staff/{userId}/status: Activate/Deactivate staff (Admin)
router.put('/:userId/status', protect, rbac(ADMIN_ONLY), staffController.updateStaffStatus);

// DELETE /api/staff/{userId}: Deactivate/delete staff (Admin)
router.delete('/:userId', protect, rbac(ADMIN_ONLY), staffController.deleteStaffMember);

module.exports = router; 