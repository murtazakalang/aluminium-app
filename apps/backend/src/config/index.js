require('dotenv').config(); // For loading .env file variables

module.exports = {
    port: process.env.PORT || 3001,
    mongoURI: process.env.MONGO_URI || 'mongodb://localhost:27017/aluminium_app_dev',
    jwtSecret: process.env.JWT_SECRET || 'your_very_secret_jwt_key_please_change_this_in_production',
    // Frontend URL for constructing links like password reset or invitation
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    // Email settings (example for a mock or simple Nodemailer setup)
    emailConfig: {
        service: process.env.EMAIL_SERVICE || 'gmail', // e.g., 'gmail', or use SMTP
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE === 'true',
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS, // Your email password or app-specific password
    },
}; 