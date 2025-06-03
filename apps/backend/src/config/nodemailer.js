const nodemailer = require('nodemailer');

const createTransporter = () => {
    // Ensure environment variables are loaded (dotenv should handle this in server.js)
    const host = process.env.EMAIL_HOST;
    const port = process.env.EMAIL_PORT;
    const user = process.env.EMAIL_USER; // Your Gmail address
    const pass = process.env.EMAIL_PASSWORD; // Your Gmail password or App Password

    if (!host || !port || !user || !pass) {
        console.warn('Email configuration missing in environment variables. Email sending will be disabled.');
        return null; // Return null if configuration is incomplete
    }

    const transporter = nodemailer.createTransport({
        host: host, // e.g., smtp.gmail.com for Gmail
        port: parseInt(port, 10), // e.g., 587 for TLS, 465 for SSL
        secure: parseInt(port, 10) === 465, // true for 465, false for other ports (like 587 with STARTTLS)
        auth: {
            user: user,
            pass: pass,
        },
        // Optional: Add TLS options if needed (e.g., for self-signed certs, though not typical for Gmail)
        // tls: {
        //   rejectUnauthorized: false
        // }
    });

    // Verify connection configuration (optional, good for diagnostics)
    transporter.verify((error, success) => {
        if (error) {
            console.error('Nodemailer verification error:', error);
        } else {
            console.log('Nodemailer is ready to send emails');
        }
    });


    return transporter;
};

// Export a single instance or the creation function
// Exporting the function allows lazy creation if needed
module.exports = createTransporter(); // Create and export the instance immediately
// Alternatively: module.exports = createTransporter; // Export the function itself
