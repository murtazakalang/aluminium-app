const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { promisify } = require('util'); // To promisify jwt.verify
const mongoose = require('mongoose'); // Added mongoose import

const Company = require('../models/Company');
const User = require('../models/User');
const sendEmail = require('../utils/emailUtils'); // Dummy email sender

// Helper function to sign JWT
const signToken = (id, companyId) => {
    return jwt.sign({ id, companyId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });
};

// Helper function to create and send token response
const createSendToken = (user, statusCode, res) => {
    const token = signToken(user._id, user.companyId);

    // Cookie options
    const cookieOptions = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000), // days * 24h * 60m * 60s * 1000ms
        httpOnly: true, // Prevent XSS attacks
        secure: process.env.NODE_ENV === 'production' // Only send over HTTPS in production
    };

    res.cookie('jwt', token, cookieOptions);

    // Remove password from output
    user.password = undefined;

    // Create response data
    const responseData = {
        status: 'success',
        token,
        data: {
            user
        }
    };

    console.log('Sending authentication response:', JSON.stringify({
        status: responseData.status,
        token: 'JWT_TOKEN', // Don't log the actual token
        user: responseData.data.user._id
    }));

    res.status(statusCode).json(responseData);
};

// --- Registration ---
exports.register = async (req, res, next) => {
    try {
        console.log('Registration request received:', JSON.stringify(req.body, null, 2));
        const { companyName, companyEmail, adminFirstName, adminLastName, adminEmail, password } = req.body;

        // 1) Validate input (basic check, add more robust validation later)
        if (!companyName || !companyEmail || !adminFirstName || !adminEmail || !password) {
            console.log('Missing required fields:', { 
                companyName: !!companyName, 
                companyEmail: !!companyEmail, 
                adminFirstName: !!adminFirstName, 
                adminEmail: !!adminEmail, 
                password: !!password 
            });
            return res.status(400).json({ status: 'fail', message: 'Missing required registration fields.' });
        }

        // 2) Check if company email already exists
        const existingCompany = await Company.findOne({ email: companyEmail });
        if (existingCompany) {
            console.log('Company email already exists:', companyEmail);
            return res.status(400).json({ status: 'fail', message: 'Company email already registered.' });
        }

        // 3) Create the new company (without transaction)
        try {
            // Create the company
            console.log('Creating new company:', { name: companyName, email: companyEmail });
            const newCompany = await Company.create({
                name: companyName,
                email: companyEmail,
                // Add other company fields if provided
            });
            console.log('Company created successfully:', newCompany._id);

            // 4) Create the admin user linked to the company
            console.log('Creating admin user for company:', { 
                email: adminEmail,
                companyId: newCompany._id,
                role: 'Admin'
            });
            const newAdmin = await User.create({
                companyId: newCompany._id,
                firstName: adminFirstName,
                lastName: adminLastName,
                email: adminEmail,
                password: password, // Password will be hashed by pre-save middleware
                role: 'Admin', // First user is always Admin
                isActive: true, // Assuming admin is active by default
                // isVerified: true // Optional: Auto-verify the initial admin
            });
            console.log('Admin user created successfully:', newAdmin._id);

            // 5) Log in the new admin user immediately (send JWT)
            createSendToken(newAdmin, 201, res);

        } catch (error) {
            console.error("Registration Error:", error);
            console.error("Error details:", error.name, error.code);
            if (error.keyPattern) {
                console.error("Key pattern:", error.keyPattern);
            }
            if (error.keyValue) {
                console.error("Key value:", error.keyValue);
            }
            
            // Check for MongoDB duplicate key errors (error code 11000)
            if (error.code === 11000) {
                // Check which field caused the duplicate key error
                if (error.keyPattern && error.keyPattern.email) {
                    return res.status(400).json({ 
                        status: 'fail', 
                        message: 'Company email already registered. Please try a different email.'
                    });
                }
                
                if (error.keyPattern && error.keyPattern.companyId && error.keyPattern.email) {
                    return res.status(400).json({ 
                        status: 'fail', 
                        message: 'Admin email already exists. Please try a different email for the admin.'
                    });
                }
                
                // Generic duplicate key error
                return res.status(400).json({ 
                    status: 'fail', 
                    message: 'A duplicate value was detected. Please check your inputs and try again.'
                });
            }
            
            // If we get here, it's some other error
            return res.status(500).json({ 
                status: 'fail', 
                message: 'Registration failed. Please try again.'
            });
        }
    } catch (error) {
        console.error("Registration General Error:", error);
        // Handle potential validation errors from Mongoose schemas
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(el => el.message);
            return res.status(400).json({ status: 'fail', message: `Invalid input data: ${messages.join('. ')}` });
        }
        res.status(500).json({ status: 'error', message: 'An unexpected error occurred during registration.' });
    }
};


// --- Login (Modified to remove companyId requirement) ---
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body; // Remove companyId from destructuring

        // 1) Check if email and password exist
        if (!email || !password) {
            return res.status(400).json({ status: 'fail', message: 'Please provide email and password.' }); // Updated message
        }

        // 2) Check if user exists & password is correct
        // Find user by email only and select the password
        const user = await User.findOne({
            email: email
         }).select('+password').populate('companyId'); // Populate company info if needed

        // Check user existence and password correctness
        if (!user || !(await user.comparePassword(password))) {
             return res.status(401).json({ status: 'fail', message: 'Incorrect email or password.' }); // Updated message
        }

        // 3) Check if user is active
        if (!user.isActive) {
            return res.status(403).json({ status: 'fail', message: 'Your account has been deactivated.' });
        }

        // 4) If everything ok, send token to client
        createSendToken(user, 200, res);

    } catch (error) {
        console.error("Login Error:", error);
         // Remove the specific CastError check for companyId as it's no longer expected
        // if (error.name === 'CastError' && error.path === 'companyId') {
        //      return res.status(400).json({ status: 'fail', message: 'Invalid company identifier format.' });
        // }
        res.status(500).json({ status: 'error', message: 'An unexpected error occurred during login.' });
    }
};

// --- Logout ---
exports.logout = (req, res) => {
    // To logout, we just clear the cookie on the client side
    res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000), // Expire in 10 seconds
        httpOnly: true
    });
    res.status(200).json({ status: 'success', message: 'Logged out successfully.' });
};


// --- Forgot Password ---
exports.forgotPassword = async (req, res, next) => {
    try {
        // 1) Get user based on POSTed email
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            // Don't reveal if user exists or not for security
            return res.status(404).json({ status: 'fail', message: 'If an account with that email exists, a password reset link has been sent.' });
        }

        // 2) Generate the random reset token (using method on User model)
        const resetToken = user.createPasswordResetToken();
        await user.save({ validateBeforeSave: false }); // Save the user with the hashed token and expiry date. Disable validation temporarily.

        // 3) Send the token back to the user's email
        // Use config.frontendUrl to construct reset URL that points to the frontend reset page
        const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const resetURL = `${frontendBaseUrl}/reset-password?token=${resetToken}`;

        const message = `Forgot your password? Click on the following link to reset your password: ${resetURL}\nIf you didn't request this, please ignore this email. This link is valid for 10 minutes.`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Your password reset token (valid for 10 min)',
                message
            });

            // Log the reset URL for development/debugging (remove in production)
            console.log('Reset URL:', resetURL);

            res.status(200).json({
                status: 'success',
                message: 'Password reset token sent to email!'
            });
        } catch (err) {
            console.error("Email Sending Error:", err);
            // If email fails, reset the token fields in the DB so user can try again
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save({ validateBeforeSave: false });

            return res.status(500).json({ status: 'error', message: 'There was an error sending the email. Try again later.' });
        }
    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).json({ status: 'error', message: 'An unexpected error occurred.' });
    }
};

// --- Reset Password ---
exports.resetPassword = async (req, res, next) => {
    try {
        // 1) Get user based on the token
        // Hash the incoming token from the URL params to match the one stored in DB
        const hashedToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        // Find user by the hashed token and check if it hasn't expired
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() } // Check if expiry date is greater than now
        });

        // 2) If token has not expired, and there is user, set the new password
        if (!user) {
            return res.status(400).json({ status: 'fail', message: 'Token is invalid or has expired.' });
        }

        // Check if new password is provided
        if (!req.body.password) {
             return res.status(400).json({ status: 'fail', message: 'Please provide a new password.' });
        }

        // Update password on the user object (pre-save middleware will hash it)
        user.password = req.body.password;
        // Optional: Add passwordConfirm field check here if needed
        // user.passwordConfirm = req.body.passwordConfirm;

        // The pre-save middleware will also clear the reset token fields
        await user.save(); // This triggers validation and hashing

        // 3) Log the user in, send JWT
        createSendToken(user, 200, res);

    } catch (error) {
        console.error("Reset Password Error:", error);
         // Handle potential validation errors from Mongoose schemas (e.g., password too short)
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(el => el.message);
            return res.status(400).json({ status: 'fail', message: `Invalid input data: ${messages.join('. ')}` });
        }
        res.status(500).json({ status: 'error', message: 'An unexpected error occurred while resetting password.' });
    }
};


// --- Middleware to Protect Routes (Example) ---
exports.protect = async (req, res, next) => {
    try {
        // 1) Getting token and check if it's there
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies.jwt) {
            token = req.cookies.jwt;
        }

        if (!token || token === 'loggedout') {
            return res.status(401).json({ status: 'fail', message: 'You are not logged in. Please log in to get access.' });
        }

        // 2) Verification token
        const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

        // 3) Check if user still exists
        const currentUser = await User.findById(decoded.id);
        if (!currentUser) {
            return res.status(401).json({ status: 'fail', message: 'The user belonging to this token no longer exists.' });
        }

        // 4) Check if user changed password after the token was issued
        //    (Requires a 'passwordChangedAt' field in the User model - add if needed)
        // if (currentUser.changedPasswordAfter(decoded.iat)) {
        //   return next(new AppError('User recently changed password! Please log in again.', 401));
        // }

        // Check if user is active
         if (!currentUser.isActive) {
            return res.status(403).json({ status: 'fail', message: 'Your account has been deactivated.' });
        }

        // GRANT ACCESS TO PROTECTED ROUTE
        // Add user and companyId to the request object for use in subsequent middleware/controllers
        req.user = currentUser;
        req.companyId = currentUser.companyId; // Ensure companyId is available for multi-tenancy checks

        next();
    } catch (error) {
        console.error("Auth Protect Error:", error);
         if (error.name === 'JsonWebTokenError') {
             return res.status(401).json({ status: 'fail', message: 'Invalid token. Please log in again.' });
         }
         if (error.name === 'TokenExpiredError') {
             return res.status(401).json({ status: 'fail', message: 'Your token has expired. Please log in again.' });
         }
        res.status(401).json({ status: 'fail', message: 'Authentication failed. Please log in.' });
    }
};

// --- Middleware for Role-Based Access Control (RBAC) ---
// Example: Allow access only to users with specific roles
// This is now handled by middleware/rbac.js and can be removed.
/*
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['Admin', 'Manager']. req.user.role='Admin'
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ status: 'fail', message: 'You do not have permission to perform this action.' });
    }
    next();
  };
};
*/
