const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Company name is required.'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Company email is required.'],
        unique: true, // Ensure email is unique across all companies
        lowercase: true,
        trim: true,
        // Basic email format validation
        match: [/\S+@\S+\.\S+/, 'Please fill a valid email address'],
    },
    phone: {
        type: String,
        trim: true,
    },
    address: {
        type: String,
        trim: true,
    },
    industry: {
        type: String,
        default: 'Window Manufacturing',
    },
    logoUrl: String,
    // Subscription details from PRD
    subscriptionPlan: {
        type: String, // Could be ObjectId ref:'SubscriptionPlan' later
        default: 'free',
    },
    subscriptionStatus: {
        type: String,
        enum: ['active', 'inactive', 'trial', 'past_due'],
        default: 'trial',
    },
    razorpayCustomerId: String,
    // Default settings (can be moved to Settings model later if complex)
    defaultDimensionUnit: {
        type: String,
        enum: ['inches', 'mm'],
        default: 'inches',
    },
    defaultAreaUnit: {
        type: String,
        enum: ['sqft', 'sqm'],
        default: 'sqft',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true // Adds createdAt and updatedAt automatically
});

module.exports = mongoose.model('Company', companySchema);
