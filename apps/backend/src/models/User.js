const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true // Index for faster lookups scoped to a company
    },
    email: {
        type: String,
        required: [true, 'Email is required.'],
        lowercase: true,
        trim: true,
        match: [/\S+@\S+\.\S+/, 'Please fill a valid email address'],
        index: true // Index for faster lookups within a company
    },
    password: {
        type: String,
        required: [true, 'Password is required.'],
        minlength: [6, 'Password must be at least 6 characters long.'],
        select: false // Do not return password by default
    },
    firstName: {
        type: String,
        trim: true,
    },
    lastName: {
        type: String,
        trim: true,
    },
    phone: {
        type: String,
        trim: true,
    },
    role: {
        type: String,
        enum: ['Admin', 'Manager', 'Staff'],
        required: true,
        default: 'Staff'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // For email verification / invitations (optional for now)
    // verificationToken: String,
    // verificationExpires: Date,
    // isVerified: { type: Boolean, default: false },

    // For password reset
    passwordResetToken: String,
    passwordResetExpires: Date,

    invitationToken: String,
    invitationExpires: Date,

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },

}, {
    timestamps: true
});

// Ensure email is unique within the scope of a company
userSchema.index({ companyId: 1, email: 1 }, { unique: true });

// --- Middleware ---

// Hash password before saving
userSchema.pre('save', async function(next) {
    // Only run this function if password was actually modified
    if (!this.isModified('password')) return next();

    // Hash the password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);

    // Delete passwordConfirm field if you were using one
    // this.passwordConfirm = undefined;
    next();
});

// Remove reset token fields after password is changed via reset
userSchema.pre('save', function(next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordResetToken = undefined;
  this.passwordResetExpires = undefined;
  next();
});


// --- Instance Methods ---

// Method to check if password is correct
userSchema.methods.comparePassword = async function(candidatePassword) {
    // this.password refers to the password stored in the DB (which is selected via .select('+password'))
    return await bcrypt.compare(candidatePassword, this.password);
};

// Method to create password reset token
userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Hash the token before saving to DB for security
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set token expiration (e.g., 10 minutes)
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes in milliseconds

  // Return the unhashed token to be sent via email
  return resetToken;
};


module.exports = mongoose.model('User', userSchema);
