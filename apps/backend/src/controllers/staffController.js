const User = require('../models/User');
const Company = require('../models/Company');
const crypto = require('crypto');
const sendEmail = require('../utils/emailUtils');
const config = require('../config');

const mongoose = require('mongoose');

// --- Helper Functions ---
const generateInvitationToken = () => {
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    return { token, hashedToken, expires };
};

// --- Controller Methods ---

// GET /api/staff - List all staff for the company
const listStaff = async (req, res) => {
    try {
        // req.companyId is provided by the auth middleware
        const staff = await User.find({ companyId: req.companyId }).select('-password');
        res.json(staff);
    } catch (error) {
        console.error('Error listing staff:', error);
        res.status(500).json({ message: 'Error listing staff', error: error.message });
    }
};

// POST /api/staff - Create staff manually (Admin only)
const createStaff = async (req, res) => {
    const { email, password, firstName, lastName, phone, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ message: 'Email, password, and role are required.' });
    }

    if (req.user.role !== 'Admin' && role === 'Admin') {
        return res.status(403).json({ message: 'Only Admins can create other Admins.' });
    }

    try {
        // Check for duplicate email across ALL companies, not just the current one
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already in use. Each user must have a unique email address across the system.' });
        }

        const newUser = new User({
            companyId: req.companyId,
            email,
            password, // Password will be hashed by pre-save hook
            firstName,
            lastName,
            phone,
            role,
            isActive: true, // Manually created users are active by default
        });

        await newUser.save();
        const userToReturn = newUser.toObject();
        delete userToReturn.password; // Ensure password is not returned

        res.status(201).json(userToReturn);
    } catch (error) {
        console.error('Error creating staff:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error', errors: error.errors });
        }
        res.status(500).json({ message: 'Error creating staff', error: error.message });
    }
};

// POST /api/staff/invite - Invite staff via email (Admin only)
const inviteStaff = async (req, res) => {
    const { email, role } = req.body;
    if (!email || !role) {
        return res.status(400).json({ message: 'Email and role are required for invitation.' });
    }

    if (req.user.role !== 'Admin' && role === 'Admin') {
        return res.status(403).json({ message: 'Only Admins can invite other Admins.'});
    }

    try {
        const existingUser = await User.findOne({ email, companyId: req.companyId });
        if (existingUser) {
            return res.status(400).json({ message: 'A user with this email already exists in this company.' });
        }

        const { token, hashedToken, expires } = generateInvitationToken();

        const company = await Company.findById(req.companyId).lean();
        if (!company) {
            return res.status(404).json({ message: 'Company not found to associate invitation.'});
        }

        const invitedUser = new User({
            companyId: req.companyId,
            email,
            role,
            invitationToken: hashedToken,
            invitationExpires: expires,
            isActive: false, // Invited user is inactive until they accept and set password
            // A temporary or random password could be set here, or allow user to set on first login via token.
            // For simplicity, we'll require them to set it up via the invitation link.
            // Setting a placeholder that won't be used for login directly.
            password: `invited_user_${Date.now()}` 
        });
        await invitedUser.save();

        const invitationLink = `${config.frontendUrl}/accept-invitation?token=${token}&email=${encodeURIComponent(email)}`;

        await sendEmail({
            email: email,
            subject: `You've been invited to join ${company.name}`,
            message: `You have been invited to join ${company.name} as a ${role}. Click this link to accept: ${invitationLink}`,
            html: `<p>You have been invited to join <strong>${company.name}</strong> as a ${role}.</p><p>Click this link to accept your invitation and set up your account: <a href="${invitationLink}">${invitationLink}</a></p><p>This link will expire in 24 hours.</p>`
        });

        res.status(200).json({ message: `Invitation sent to ${email}.`, userId: invitedUser._id });

    } catch (error) {
        console.error('Error inviting staff:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error', errors: error.errors });
        }
        res.status(500).json({ message: 'Error inviting staff', error: error.message });
    }
};


// GET /api/staff/{userId} - Get specific staff details
const getStaffMember = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID format.' });
        }

        const staffMember = await User.findOne({ _id: userId, companyId: req.companyId }).select('-password');
        if (!staffMember) {
            return res.status(404).json({ message: 'Staff member not found in this company.' });
        }
        res.json(staffMember);
    } catch (error) {
        console.error('Error fetching staff member:', error);
        res.status(500).json({ message: 'Error fetching staff member', error: error.message });
    }
};

// PUT /api/staff/{userId} - Update staff details (Admin only)
const updateStaffMember = async (req, res) => {
    const { userId } = req.params;
    const { firstName, lastName, phone, role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid user ID format.' });
    }

    // Prevent non-Admins from elevating privileges or modifying Admins if they are not one themselves
    if (req.user.role !== 'Admin') {
        const targetUser = await User.findById(userId).lean();
        if (!targetUser) return res.status(404).json({ message: 'Staff member not found.'});
        
        if (targetUser.role === 'Admin') {
             return res.status(403).json({ message: 'Only Admins can modify other Admin users.' });
        }
        if (role && role === 'Admin') {
             return res.status(403).json({ message: 'You do not have permission to assign Admin role.' });
        }
        if (role && targetUser.role !== role) {
            return res.status(403).json({ message: 'You do not have permission to change user roles.'});
        }
    }

    try {
        const updateFields = {};
        if (firstName !== undefined) updateFields.firstName = firstName;
        if (lastName !== undefined) updateFields.lastName = lastName;
        if (phone !== undefined) updateFields.phone = phone;
        if (role !== undefined) {
            // If the current user is not an Admin, they cannot change the role to Admin.
            if (req.user.role !== 'Admin' && role === 'Admin') {
                return res.status(403).json({ message: 'Cannot assign Admin role.' });
            }
            updateFields.role = role;
        }

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ message: 'No fields to update provided.' });
        }

        const updatedStaffMember = await User.findOneAndUpdate(
            { _id: userId, companyId: req.companyId },
            { $set: updateFields },
            { new: true, runValidators: true, context: 'query' }
        ).select('-password');

        if (!updatedStaffMember) {
            return res.status(404).json({ message: 'Staff member not found in this company or no changes made.' });
        }
        res.json(updatedStaffMember);
    } catch (error) {
        console.error('Error updating staff member:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error', errors: error.errors });
        }
        res.status(500).json({ message: 'Error updating staff member', error: error.message });
    }
};

// PUT /api/staff/{userId}/status - Activate/Deactivate staff (Admin only)
const updateStaffStatus = async (req, res) => {
    const { userId } = req.params;
    const { isActive } = req.body; // Expecting { isActive: true/false }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid user ID format.' });
    }
    if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: 'isActive field must be a boolean.' });
    }
    
    // Prevent users from deactivating themselves if they are the one making the request
    if (req.user._id.toString() === userId && !isActive) {
        return res.status(400).json({ message: 'You cannot deactivate your own account.' });
    }

    try {
        const staffMember = await User.findOne({ _id: userId, companyId: req.companyId });

        if (!staffMember) {
            return res.status(404).json({ message: 'Staff member not found in this company.' });
        }

        // Only Admins can deactivate other Admins. Also, a company must have at least one active Admin.
        if (staffMember.role === 'Admin' && !isActive) {
            const activeAdmins = await User.countDocuments({ companyId: req.companyId, role: 'Admin', isActive: true });
            if (activeAdmins <= 1 && staffMember.isActive) { // If this is the last active admin
                return res.status(400).json({ message: 'Cannot deactivate the last active Admin of the company.' });
            }
        }

        staffMember.isActive = isActive;
        await staffMember.save();
        
        const userToReturn = staffMember.toObject();
        delete userToReturn.password;

        res.json(userToReturn);
    } catch (error) {
        console.error('Error updating staff status:', error);
        res.status(500).json({ message: 'Error updating staff status', error: error.message });
    }
};

// DELETE /api/staff/{userId} - Delete a staff member (Admin only)
const deleteStaffMember = async (req, res) => {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid user ID format.' });
    }

    // Prevent users from deleting themselves
    if (req.user._id.toString() === userId) {
        return res.status(400).json({ message: 'You cannot delete your own account. Consider deactivation or contact support.' });
    }

    try {
        const staffMemberToDelete = await User.findOne({ _id: userId, companyId: req.companyId });

        if (!staffMemberToDelete) {
            return res.status(404).json({ message: 'Staff member not found in this company.' });
        }

        // Prevent deletion of the last Admin if they are active
        if (staffMemberToDelete.role === 'Admin') {
            const adminCount = await User.countDocuments({ companyId: req.companyId, role: 'Admin' });
            if (adminCount <= 1) {
                return res.status(400).json({ message: 'Cannot delete the last Admin of the company.' });
            }
        }

        await User.deleteOne({ _id: userId, companyId: req.companyId });
        res.status(200).json({ message: 'Staff member deleted successfully.' });

    } catch (error) {
        console.error('Error deleting staff member:', error);
        res.status(500).json({ message: 'Error deleting staff member', error: error.message });
    }
};


module.exports = {
    listStaff,
    createStaff,
    inviteStaff,
    getStaffMember,
    updateStaffMember,
    updateStaffStatus,
    deleteStaffMember,
}; 