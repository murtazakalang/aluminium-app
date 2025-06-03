const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
    companyId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Company', 
        required: true, 
        unique: true, 
        index: true 
    },
    termsAndConditions: {
       quotation: { type: String, default: '' },
       invoice: { type: String, default: '' }
    },
    paymentTerms: {
       quotation: { type: String, default: '100% Advance payment required before commencement of work. Payment can be made via bank transfer, UPI, or cash.' },
       invoice: { type: String, default: 'Payment is due within 30 days of invoice date. Late payments may incur additional charges.' }
    },
    predefinedCharges: [{
        name: { type: String, required: true }, // Unique within the array for a company handled by application logic
        isDefault: { type: Boolean, default: false }
    }],
    gst: {
        enabled: { type: Boolean, default: false },
        percentage: { type: Number, default: 0 }
    },
    units: {
        dimension: { type: String, enum: ['inches', 'mm'], default: 'inches' },
        area: { type: String, enum: ['sqft', 'sqm'], default: 'sqft' }
    },
    notifications: {
        systemAlertsEnabled: { type: Boolean, default: true },
        emailSummaryEnabled: { type: Boolean, default: true }
    }
    // Note: 'updatedAt' is automatically handled by timestamps option.
    // The PRD had an explicit 'updatedAt' field, but it's redundant with the timestamps option below.
}, { 
    timestamps: { createdAt: false, updatedAt: true } 
});

// It's good practice to ensure predefinedCharges names are unique per company, 
// but this is typically enforced at the application/controller level when adding/updating charges,
// as Mongoose validation for uniqueness within an array of subdocuments is complex.

module.exports = mongoose.model('Setting', settingSchema); 