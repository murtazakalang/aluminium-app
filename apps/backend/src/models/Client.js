const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const noteSchema = new Schema(
  {
    text: {
      type: String,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User', // Assuming you have a User model
      required: true,
    },
    reminderDate: {
      type: Date,
    },
  },
  { timestamps: true }
);

const clientSchema = new Schema(
  {
    clientName: {
      type: String,
      required: [true, 'Client name is required'],
      trim: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
      // Add validation for phone number format if needed, e.g., using a regex
      // match: [/^\+[1-9]\d{1,14}$/, 'Please fill a valid international phone number']
    },
    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
      // Add validation for email format
      match: [/\S+@\S+\.\S+/, 'Please fill a valid email address'],
      // Consider unique index per company if emails should be unique within a company
      // index: true, // If globally unique
    },
    billingAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    siteAddress: { // Can be multiple site addresses if needed, for now a single one
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    gstin: {
      type: String,
      trim: true,
    },
    leadSource: {
      type: String, // Free-form lead source (e.g., Website, Referral, etc.)
    },
    followUpStatus: {
      type: String,
      enum: [
        'New Lead',
        'In Discussion',
        'Quoted',
        'Negotiation',
        'Converted',
        'Dropped',
      ],
      default: 'New Lead',
    },
    notes: [noteSchema],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company', // Assuming you have a Company model
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Index for searching and filtering
clientSchema.index({ clientName: 'text', email: 'text', contactNumber: 'text' }); // For text search
clientSchema.index({ companyId: 1, followUpStatus: 1 });
clientSchema.index({ companyId: 1, isActive: 1 });
clientSchema.index({ companyId: 1, email: 1}, { unique: true, partialFilterExpression: { email: { $type: "string" } } }); // Unique email per company


// Pre-save hook for any modifications if needed, e.g. for siteAddress default
// clientSchema.pre('save', function(next) {
//   if (!this.siteAddress && this.billingAddress) {
//     this.siteAddress = this.billingAddress;
//   }
//   next();
// });

const Client = mongoose.model('Client', clientSchema);

module.exports = Client; 