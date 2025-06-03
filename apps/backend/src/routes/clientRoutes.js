const express = require('express');
const router = express.Router();
const {
  getClients,
  createClient,
  getClientById,
  updateClient,
  deleteClient,
  addClientNote,
  getClientHistory,
  updateClientFollowUpStatus
} = require('../controllers/clientController');

// Actual middleware imports
const { protect } = require('../controllers/authController'); // For JWT/session authentication
const rbac = require('../middleware/rbac'); // For enforcing role permissions

// Apply authentication middleware globally to all client routes
router.use(protect);

// Routes with RBAC
// Multi-tenancy is handled within controllers using req.user.companyId
router.route('/')
  .get(rbac(['Admin', 'Manager', 'Staff']), getClients)
  .post(rbac(['Admin', 'Manager', 'Staff']), createClient);

router.route('/:clientId')
  .get(rbac(['Admin', 'Manager', 'Staff']), getClientById)
  .put(rbac(['Admin', 'Manager', 'Staff']), updateClient)
  .delete(rbac(['Admin']), deleteClient); // Only Admin can delete

router.route('/:clientId/notes')
  .post(rbac(['Admin', 'Manager', 'Staff']), addClientNote);

router.route('/:clientId/history')
  .get(rbac(['Admin', 'Manager', 'Staff']), getClientHistory);

router.route('/:clientId/status')
  .put(rbac(['Admin', 'Manager', 'Staff']), updateClientFollowUpStatus);

module.exports = router; 