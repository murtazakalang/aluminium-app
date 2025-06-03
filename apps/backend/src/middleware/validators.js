const { body, param, validationResult } = require('express-validator');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Format errors for better readability if desired
        // const formattedErrors = errors.array().map(err => ({ field: err.param, message: err.msg }));
        return res.status(400).json({ status: 'fail', errors: errors.array() });
    }
    next();
};

// --- Validation Chains ---

const registerValidationRules = [
    body('companyName')
        .trim()
        .notEmpty().withMessage('Company name is required.'),
    body('companyEmail')
        .trim()
        .isEmail().withMessage('Please provide a valid company email.')
        .normalizeEmail(),
    body('adminFirstName')
        .trim()
        .notEmpty().withMessage('Admin first name is required.'),
    body('adminEmail')
        .trim()
        .isEmail().withMessage('Please provide a valid admin email.')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
    // Optional: Add password confirmation check if you have a passwordConfirm field
    // body('passwordConfirm').custom((value, { req }) => {
    //   if (value !== req.body.password) {
    //     throw new Error('Passwords do not match');
    //   }
    //   return true;
    // })
];

const loginValidationRules = [
    body('email')
        .trim()
        .isEmail().withMessage('Please provide a valid email.')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required.'),
    // Removed companyId validation as it's no longer required in the request body
    // body('companyId')
    //     .trim()
    //     .notEmpty().withMessage('Company identifier is required.')
    //     .isMongoId().withMessage('Invalid company identifier format.'),
];

const forgotPasswordValidationRules = [
    body('email')
        .trim()
        .isEmail().withMessage('Please provide a valid email.')
        .normalizeEmail(),
];

const resetPasswordValidationRules = [
    param('token') // Check the URL parameter 'token'
        .isHexadecimal().withMessage('Invalid token format.')
        .isLength({ min: 64, max: 64 }).withMessage('Invalid token length.'), // Assuming SHA256 hex token
    body('password')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
    // Optional: Add password confirmation check
];


module.exports = {
    handleValidationErrors,
    registerValidationRules,
    loginValidationRules,
    forgotPasswordValidationRules,
    resetPasswordValidationRules,
};
