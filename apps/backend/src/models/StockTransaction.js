const mongoose = require('mongoose');
const Decimal = require('decimal.js'); // Import decimal.js

const stockTransactionSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialV2', required: true, index: true },
    type: { 
        type: String, 
        enum: ['Inward', 'Outward-Manual', 'Outward-OrderCut', 'Scrap', 'Correction', 'InitialStock'], 
        required: true 
    },
    length: { type: mongoose.Types.Decimal128 }, // Standard length affected (e.g., 12, 15, 16)
    lengthUnit: { type: String }, // Unit of the length (e.g., 'ft')
    quantityChange: { type: mongoose.Types.Decimal128, required: true }, // Change amount
    quantityUnit: { type: String, required: true }, // Unit of the quantityChange, e.g., 'pcs' for profile pipes, 'sqft' for glass, 'kg' for profile bulk, 'pcs' for hardware
    unitRateAtTransaction: { type: mongoose.Types.Decimal128 }, // Rate of the item at the time of transaction (per quantityUnit)
    totalValueChange: { type: mongoose.Types.Decimal128 }, // quantityChange * unitRateAtTransaction (for valuation)
    relatedDocumentType: String, // e.g., 'Order', 'PurchaseOrder', 'ManualAdjustment'
    relatedDocumentId: mongoose.Schema.Types.ObjectId,
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    transactionDate: { type: Date, default: Date.now },
}, { timestamps: { createdAt: 'transactionDate', updatedAt: false } }); // Using transactionDate as createdAt

stockTransactionSchema.pre('save', function(next) {
    // Recalculate totalValueChange if quantityChange or unitRateAtTransaction is modified or if totalValueChange is not set
    if (this.isModified('quantityChange') || this.isModified('unitRateAtTransaction') || this.totalValueChange === undefined) {
        if (this.quantityChange && this.unitRateAtTransaction) {
            try {
                const quantityChangeDecimal = new Decimal(this.quantityChange.toString()); // Convert to decimal.js Decimal
                const unitRateDecimal = new Decimal(this.unitRateAtTransaction.toString()); // Convert to decimal.js Decimal
                
                const totalValue = quantityChangeDecimal.times(unitRateDecimal); // Use decimal.js for multiplication
                
                // Convert result back to Mongoose Decimal128 for storage
                this.totalValueChange = mongoose.Types.Decimal128.fromString(totalValue.toString());
            } catch (error) {
                console.error('Error calculating totalValueChange in StockTransaction pre-save hook:', error);
                // Decide if you want to block saving or save without totalValueChange
                // For now, let's allow saving but log the error. Or, call next(error) to block.
                // next(new Error('Failed to calculate totalValueChange: ' + error.message)); 
                // return; 
            }
        } else {
            // If either quantity or rate is null/undefined, totalValueChange should probably be null or 0
            this.totalValueChange = mongoose.Types.Decimal128.fromString("0"); 
        }
    }
    next();
});

module.exports = mongoose.model('StockTransaction', stockTransactionSchema); 