const Company = require('../models/Company');
const catchAsync = require('../utils/catchAsync');
const path = require('path');
const fs = require('fs');

// Helper function to delete old logo file
const deleteOldLogo = (logoUrl) => {
    if (logoUrl && logoUrl.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, '../../', logoUrl);
        fs.unlink(filePath, (err) => {
            if (err && err.code !== 'ENOENT') {
                console.error('Error deleting old logo:', err);
            }
        });
    }
};

// Define as constants
const getMyCompany = catchAsync(async (req, res) => {
    // req.user.companyId should be populated by your 'protect' middleware
    if (!req.user || !req.user.companyId) {
        return res.status(401).json({
            status: 'fail',
            message: 'User or company information not found. Please log in again.'
        });
    }
    const company = await Company.findById(req.user.companyId);
    
    if (!company) {
        return res.status(404).json({
            status: 'fail',
            message: 'Company not found'
        });
    }
    
    // Consistent response structure
    res.status(200).json({
        status: 'success',
        data: {
            company // Or just company if you prefer the direct object
        }
    });
});

// Upload company logo
const uploadLogo = catchAsync(async (req, res) => {
    if (!req.user || !req.user.companyId) {
        return res.status(401).json({
            status: 'fail',
            message: 'User or company information not found. Please log in again.'
        });
    }

    if (!req.file) {
        return res.status(400).json({
            status: 'fail',
            message: 'No logo file provided'
        });
    }

    const company = await Company.findById(req.user.companyId);
    
    if (!company) {
        return res.status(404).json({
            status: 'fail',
            message: 'Company not found'
        });
    }

    // Delete old logo if exists
    if (company.logoUrl) {
        deleteOldLogo(company.logoUrl);
    }

    // Update company with new logo URL
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    company.logoUrl = logoUrl;
    await company.save();

    res.status(200).json({
        status: 'success',
        data: {
            company,
            message: 'Logo uploaded successfully'
        }
    });
});

// Remove company logo
const removeLogo = catchAsync(async (req, res) => {
    if (!req.user || !req.user.companyId) {
        return res.status(401).json({
            status: 'fail',
            message: 'User or company information not found. Please log in again.'
        });
    }

    const company = await Company.findById(req.user.companyId);
    
    if (!company) {
        return res.status(404).json({
            status: 'fail',
            message: 'Company not found'
        });
    }

    // Delete old logo file
    if (company.logoUrl) {
        deleteOldLogo(company.logoUrl);
    }

    // Remove logo URL from company
    company.logoUrl = null;
    await company.save();

    res.status(200).json({
        status: 'success',
        data: {
            company,
            message: 'Logo removed successfully'
        }
    });
});

// Define as constants
const updateMyCompany = catchAsync(async (req, res) => {
    if (!req.user || !req.user.companyId) {
        return res.status(401).json({
            status: 'fail',
            message: 'User or company information not found. Please log in again.'
        });
    }

    // Basic filtering: prevent updating sensitive or unchangeable fields like email or _id via this route
    const filteredBody = { ...req.body };
    delete filteredBody.email; // Example: prevent email changes here
    delete filteredBody._id;   // Prevent changing the ID
    delete filteredBody.logoUrl; // Prevent direct logoUrl changes (use upload endpoint)

    const company = await Company.findByIdAndUpdate(
        req.user.companyId,
        filteredBody, // Use the filtered body
        { new: true, runValidators: true }
    );

    if (!company) { // Check if company was actually found and updated
        return res.status(404).json({
            status: 'fail',
            message: 'No company found with that ID to update.'
        });
    }
    
    // Consistent response structure
    res.status(200).json({
        status: 'success',
        data: {
            company // Or just company
        }
    });
});

module.exports = {
    getMyCompany,
    updateMyCompany,
    uploadLogo,
    removeLogo,
}; 