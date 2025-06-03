const express = require('express');
const authController = require('../controllers/authController');
const { // Import validation rules and handler
    handleValidationErrors,
    registerValidationRules,
    loginValidationRules,
    forgotPasswordValidationRules,
    resetPasswordValidationRules
} = require('../middleware/validators');

const router = express.Router();

router.post(
    '/register',
    registerValidationRules, // Apply validation rules
    handleValidationErrors,  // Handle potential errors
    authController.register  // Proceed to controller if valid
);

router.post(
    '/login',
    loginValidationRules,
    handleValidationErrors,
    authController.login
);

router.post('/logout', authController.logout); // No input validation needed usually

router.post(
    '/forgot-password',
    forgotPasswordValidationRules,
    handleValidationErrors,
    authController.forgotPassword
);

router.patch(
    '/reset-password/:token',
    resetPasswordValidationRules,
    handleValidationErrors,
    authController.resetPassword
);

router.get('/me', authController.protect, (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      user: req.user
    }
  });
});

// Example protected route (add more as needed)
// router.get('/me', authController.protect, /* some other controller */);

module.exports = router;
