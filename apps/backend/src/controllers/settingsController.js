const Setting = require('../models/Setting');
const mongoose = require('mongoose');

// @desc    Get company settings
// @route   GET /api/settings
// @access  Private
const getSettings = async (req, res) => {
    try {
        // Ensure companyId is available from the authenticated user
        if (!req.user || !req.user.companyId) {
            return res.status(401).json({ message: 'Unauthorized: Company ID not found' });
        }

        let settings = await Setting.findOne({ companyId: req.user.companyId });

        if (!settings) {
            // Create default settings if they don't exist
            settings = new Setting({
                companyId: req.user.companyId,
                // Default values are taken from the schema definition
            });
            await settings.save();
        }
        res.status(200).json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ 
            message: 'Server error while fetching settings.', 
            error: error.message 
        });
    }
};

// @desc    Update company settings
// @route   PUT /api/settings
// @access  Private
const updateSettings = async (req, res) => {
    const { termsAndConditions, paymentTerms, units, gst, notifications } = req.body;
    const companyId = req.user.companyId;

    try {
        // Validate user and company
        if (!companyId) {
            return res.status(401).json({ message: 'Unauthorized: Company ID not found' });
        }

        let settings = await Setting.findOne({ companyId });

        if (!settings) {
            return res.status(404).json({ message: 'Settings not found for this company. Cannot update.' });
        }

        // Validations
        if (gst) {
            if (gst.percentage !== undefined && (typeof gst.percentage !== 'number' || gst.percentage < 0)) {
                return res.status(400).json({ message: 'GST percentage must be a non-negative number.' });
            }
        }
        if (units) {
            if (units.dimension && !['inches', 'mm'].includes(units.dimension)) {
                return res.status(400).json({ message: 'Invalid dimension unit. Allowed: inches, mm.' });
            }
            if (units.area && !['sqft', 'sqm'].includes(units.area)) {
                return res.status(400).json({ message: 'Invalid area unit. Allowed: sqft, sqm.' });
            }
        }

        // Update fields
        if (termsAndConditions) settings.termsAndConditions = { ...settings.termsAndConditions, ...termsAndConditions };
        if (paymentTerms) settings.paymentTerms = { ...settings.paymentTerms, ...paymentTerms };
        if (units) settings.units = { ...settings.units, ...units };
        if (gst) settings.gst = { ...settings.gst, ...gst };
        if (notifications) settings.notifications = { ...settings.notifications, ...notifications };

        console.log('[updateSettings] Saving settings with paymentTerms:', JSON.stringify(settings.paymentTerms, null, 2));
        const updatedSettings = await settings.save();
        console.log('[updateSettings] Settings saved successfully');
        res.status(200).json(updatedSettings);
    } catch (error) {
        console.error('Error updating settings:', error);
        // Mongoose validation errors can be caught here as well
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation Error', errors: error.errors });
        }
        res.status(500).json({ 
            message: 'Server error while updating settings.', 
            error: error.message 
        });
    }
};

// @desc    Get all predefined charges for the company
// @route   GET /api/settings/charges
// @access  Private
const getPredefinedCharges = async (req, res) => {
    try {
        const settings = await Setting.findOne({ companyId: req.user.companyId }).select('predefinedCharges');
        if (!settings) {
            // This case should ideally not happen if GET /api/settings ensures settings document creation
            return res.status(200).json([]); // Return empty array if no settings/charges found
        }
        res.status(200).json(settings.predefinedCharges || []);
    } catch (error) {
        console.error('Error fetching predefined charges:', error);
        res.status(500).json({ message: 'Server error while fetching predefined charges.', error: error.message });
    }
};

// @desc    Add a new predefined charge
// @route   POST /api/settings/charges
// @access  Private
const addPredefinedCharge = async (req, res) => {
    const { name, isDefault } = req.body;
    const companyId = req.user.companyId;

    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ message: 'Charge name is required and must be a non-empty string.' });
    }

    try {
        const settings = await Setting.findOne({ companyId });
        if (!settings) {
            // Should be created by GET /api/settings, but as a fallback:
            // Log this, as it's unexpected if GET /api/settings is called first.
            console.warn(`Settings document not found for company ${companyId} when adding charge. Creating one.`);
            const newSettings = new Setting({
                companyId: companyId,
                predefinedCharges: [{ name: name.trim(), isDefault: !!isDefault }]
            });
            await newSettings.save();
            return res.status(201).json(newSettings.predefinedCharges[0]);
        }

        const existingCharge = settings.predefinedCharges.find(charge => charge.name.toLowerCase() === name.trim().toLowerCase());
        if (existingCharge) {
            return res.status(400).json({ message: `A predefined charge with the name '${name.trim()}' already exists.` });
        }

        const newCharge = { name: name.trim(), isDefault: !!isDefault };
        settings.predefinedCharges.push(newCharge);
        await settings.save();
        
        // Return the newly added charge, which now has an _id
        res.status(201).json(settings.predefinedCharges[settings.predefinedCharges.length - 1]);
    } catch (error) {
        console.error('Error adding predefined charge:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation Error', errors: error.errors });
        }
        res.status(500).json({ message: 'Server error while adding predefined charge.', error: error.message });
    }
};

// @desc    Update a predefined charge
// @route   PUT /api/settings/charges/:chargeId
// @access  Private
const updatePredefinedCharge = async (req, res) => {
    const { chargeId } = req.params;
    const { name, isDefault } = req.body;
    const companyId = req.user.companyId;

    if (!mongoose.Types.ObjectId.isValid(chargeId)) {
        return res.status(400).json({ message: 'Invalid charge ID format.' });
    }
    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
        return res.status(400).json({ message: 'Charge name must be a non-empty string if provided.' });
    }

    try {
        const settings = await Setting.findOne({ companyId });
        if (!settings || !settings.predefinedCharges) {
            return res.status(404).json({ message: 'Settings or predefined charges not found for this company.' });
        }

        const chargeToUpdate = settings.predefinedCharges.id(chargeId);
        if (!chargeToUpdate) {
            return res.status(404).json({ message: 'Predefined charge not found.' });
        }

        // Check for name uniqueness if name is being changed and is different from current
        if (name !== undefined && name.trim().toLowerCase() !== chargeToUpdate.name.toLowerCase()) {
            const existingChargeWithNewName = settings.predefinedCharges.find(
                charge => charge.name.toLowerCase() === name.trim().toLowerCase() && charge._id.toString() !== chargeId
            );
            if (existingChargeWithNewName) {
                return res.status(400).json({ message: `Another charge with the name '${name.trim()}' already exists.` });
            }
            chargeToUpdate.name = name.trim();
        }

        if (isDefault !== undefined) {
            chargeToUpdate.isDefault = !!isDefault;
        }

        await settings.save();
        res.status(200).json(chargeToUpdate);
    } catch (error) {
        console.error('Error updating predefined charge:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation Error', errors: error.errors });
        }
        res.status(500).json({ message: 'Server error while updating predefined charge.', error: error.message });
    }
};

// @desc    Delete a predefined charge
// @route   DELETE /api/settings/charges/:chargeId
// @access  Private
const deletePredefinedCharge = async (req, res) => {
    const { chargeId } = req.params;
    const companyId = req.user.companyId;

    if (!mongoose.Types.ObjectId.isValid(chargeId)) {
        return res.status(400).json({ message: 'Invalid charge ID format.' });
    }

    try {
        const settings = await Setting.findOne({ companyId });
        if (!settings || !settings.predefinedCharges) {
            return res.status(404).json({ message: 'Settings or predefined charges not found.' });
        }

        const chargeIndex = settings.predefinedCharges.findIndex(charge => charge._id.toString() === chargeId);
        if (chargeIndex === -1) {
            return res.status(404).json({ message: 'Predefined charge not found.' });
        }

        settings.predefinedCharges.splice(chargeIndex, 1);
        // Alternative using Mongoose's subdocument remove:
        // const chargeToRemove = settings.predefinedCharges.id(chargeId);
        // if (chargeToRemove) chargeToRemove.remove(); 
        // else return res.status(404).json({ message: 'Predefined charge not found.' });

        await settings.save();
        res.status(200).json({ message: 'Predefined charge deleted successfully.' });
    } catch (error) {
        console.error('Error deleting predefined charge:', error);
        res.status(500).json({ message: 'Server error while deleting predefined charge.', error: error.message });
    }
};

// Placeholder for Help & Changelog Controllers
// @desc    Get help content
// @route   GET /api/settings/help
// @access  Private (or public depending on requirements)
const getHelpContent = async (req, res) => {
    res.status(200).json({ 
        title: "Help Center", 
        content: "This is mock help content. Please refer to our documentation for more details.",
        link: "/docs/help" 
    });
};

// @desc    Get changelog content
// @route   GET /api/settings/changelog
// @access  Private (or public depending on requirements)
const getChangelogContent = async (req, res) => {
    res.status(200).json({ 
        title: "Changelog", 
        versions: [
            { version: "1.0.0", date: "2023-10-27", notes: "Initial release of Settings module." },
            { version: "0.9.0", date: "2023-10-20", notes: "Beta features added." }
        ]
    });
};

module.exports = {
    getSettings,
    updateSettings,
    getPredefinedCharges,
    addPredefinedCharge,
    updatePredefinedCharge,
    deletePredefinedCharge,
    getHelpContent,
    getChangelogContent
}; 