const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { protect } = require('../controllers/authController');

// Any authenticated user (Admin, Manager, Staff) should be able to see the list of available roles.
// RBAC is not strictly necessary here as it's informational, but authentication is.
router.get('/', protect, roleController.getRoles);

module.exports = router; 