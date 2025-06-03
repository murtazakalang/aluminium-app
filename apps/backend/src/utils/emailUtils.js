// aluminium-app/apps/backend/src/utils/emailUtils.js
const transporter = require('../config/nodemailer'); // Import the configured transporter instance

const sendEmail = async options => {
    // 1. Check if transporter was created successfully
    if (!transporter) {
        console.error('Email not sent: Transporter configuration is missing or invalid.');
        // Optionally throw an error or return a specific status
        // throw new Error('Email configuration error.');
        return false; // Indicate failure
    }

    // 2. Define email options
    const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Aluminium App'}" <${process.env.EMAIL_USER}>`, // Sender address (use configured user)
        to: options.email, // List of receivers from function argument
        subject: options.subject, // Subject line from function argument
        text: options.message, // Plain text body from function argument
        // html: options.html // Optional HTML body
        attachments: options.attachments // Pass attachments to Nodemailer
    };

    // 3. Send the email
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: %s', info.messageId);
        // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info)); // Only available when using ethereal.email
        return true; // Indicate success
    } catch (error) {
        console.error('Error sending email:', error);
        // Rethrow error or handle it as needed
        // throw error;
        return false; // Indicate failure
    }
};

module.exports = sendEmail;
