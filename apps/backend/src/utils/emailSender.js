const config = require('../config');

// This is a mock email service for development.
// In a production environment, integrate with a real email service like SendGrid, Mailgun, or AWS SES using Nodemailer or similar.

const sendEmail = async (options) => {
    // options object should contain: to, subject, text, html
    console.log('---- MOCK EMAIL SEND ----');
    console.log(`To: ${options.to}`);
    console.log(`From: Mock Email Service <noreply@example.com> (using config: ${config.emailConfig.user || 'not-set'})`);
    console.log(`Subject: ${options.subject}`);
    if (options.text) {
        console.log(`Text Body: ${options.text}`);
    }
    if (options.html) {
        console.log(`HTML Body: ${options.html}`);
    }
    console.log('---- END MOCK EMAIL ----');
    // In a real scenario, this would return a promise that resolves upon successful email sending or rejects on failure.
    return Promise.resolve({ messageId: `mock_${Date.now()}` }); 
};

module.exports = sendEmail; 