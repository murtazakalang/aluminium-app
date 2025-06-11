const mongoose = require('mongoose');

const requiredMaterialCutSchema = new mongoose.Schema({
    materialId: { type: mongoose.Schema.Types.ObjectId },
    materialNameSnapshot: String,
    gaugeSnapshot: String,
    cutLengths: [mongoose.Types.Decimal128],
    lengthUnit: String,
    isCutRequired: Boolean,
    pipeBreakdown: [{
        length: { type: mongoose.Types.Decimal128, required: true },
        unit: { type: String, required: true },
        count: { type: Number, required: true, min: 1 },
        lengthInInches: { type: Number, required: true }
    }],
    totalQuantity: { type: mongoose.Types.Decimal128 },
    quantityUnit: { type: String },
    totalWeight: { type: mongoose.Types.Decimal128 },
    weightUnit: { type: String },
});

const orderItemSchema = new mongoose.Schema({
    productTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductType', required: true },
    productTypeNameSnapshot: String,
    originalWidth: { type: mongoose.Types.Decimal128 },
    finalWidth: { type: mongoose.Types.Decimal128, required: true },
    originalHeight: { type: mongoose.Types.Decimal128 },
    finalHeight: { type: mongoose.Types.Decimal128, required: true },
    originalQuantity: Number,
    finalQuantity: { type: Number, required: true },
    itemLabel: String,
    
    // NEW: Glass and frame information carried forward
    selectedGlassTypeId: { 
        type: mongoose.Schema.Types.ObjectId 
        // Removed ref to support both Material V1 and V2
    },
    selectedGlassTypeNameSnapshot: String,
    frameColour: { 
        type: String, 
        default: "" 
    },
    
    finalChargeableAreaPerItem: { type: mongoose.Types.Decimal128 },
    finalTotalChargeableArea: { type: mongoose.Types.Decimal128 },
    pricePerAreaUnit: { type: mongoose.Types.Decimal128, required: true },
    finalItemSubtotal: { type: mongoose.Types.Decimal128 },
    requiredMaterialCuts: [requiredMaterialCutSchema],
});

// New schema for globally aggregated material details
const aggregatedMaterialDetailSchema = new mongoose.Schema({
    materialId: { type: mongoose.Schema.Types.ObjectId, required: true },
    materialNameSnapshot: { type: String, required: true },
    materialCategory: { type: String, required: true }, // Storing category directly
    gaugeSnapshot: String, // The gauge used for this material in the order context
    isCutRequired: Boolean, // True for profiles, typically false for others
    usageUnit: String, // e.g., 'sqft', 'pcs', or the original unit of raw cuts for profiles before 'pipes'
    
    // For Profiles:
    pipeBreakdown: [{
        length: { type: mongoose.Types.Decimal128, required: true },
        unit: { type: String, required: true }, // Should be the unit of the length (e.g., 'ft', 'inches')
        count: { type: Number, required: true, min: 1 },
        lengthInInches: { type: Number, required: false } // Retaining for consistency if useful
    }],
    // totalQuantity for profiles will be the number of pipes
    // quantityUnit for profiles will be 'pipes'

    // For Non-Profiles (and could also apply to profiles for total raw quantity if needed elsewhere):
    // totalQuantity for non-profiles is the sum (e.g. total sqft of glass, total pcs of hardware)
    // quantityUnit for non-profiles is their usageUnit (e.g. 'sqft', 'pcs')
    totalQuantity: { type: mongoose.Types.Decimal128, required: true },
    quantityUnit: { type: String, required: true }, // e.g. 'pipes', 'sqft', 'pcs'

    totalWeight: { type: mongoose.Types.Decimal128, default: mongoose.Types.Decimal128.fromString('0.000') },
    weightUnit: { type: String, default: 'kg' },
    
    // Wire mesh items for individual optimization results
    wireMeshItems: [{
        width: { type: Number },
        height: { type: Number },
        unit: { type: String },
        quantity: { type: Number },
        optimization: {
            requiredWidth: { type: Number },
            requiredLength: { type: Number },
            selectedWidth: { type: Number },
            efficiency: { type: Number },
            wastagePercentage: { type: Number },
            optimizationType: { type: String }
        }
    }],
    
    // We might not need raw cutLengths here if pipeBreakdown is the source of truth for profiles
    // cutLengths: [mongoose.Types.Decimal128],
    // lengthUnit: String, // Unit for raw cutLengths if stored
});

const orderSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    orderIdDisplay: { type: String, required: true }, // e.g., SO-2024-001
    quotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', required: true, index: true },
    quotationIdDisplaySnapshot: String,
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    clientSnapshot: {
        clientName: String,
        contactPerson: String,
        contactNumber: String,
        email: String,
        billingAddress: String,
        siteAddress: String,
        gstin: String,
    },
    status: {
        type: String,
        enum: ['Pending', 'Measurement Confirmed', 'Ready for Optimization', 'Optimization Complete', 'Optimization Failed', 'In Production', 'Cutting', 'Assembly', 'QC', 'Packed', 'Ready for Dispatch', 'On Hold', 'Delivered', 'Completed', 'Cancelled'],
        default: 'Pending'
    },
    dimensionUnit: { type: String, enum: ['inches', 'mm'], required: true },
    areaUnit: { type: String, enum: ['sqft', 'sqm'], required: true },
    priceUnit: { type: String, enum: ['sqft', 'sqm'], required: true },
    items: [orderItemSchema],
    aggregatedOrderMaterials: [aggregatedMaterialDetailSchema],
    charges: [{
        description: String,
        amount: { type: mongoose.Types.Decimal128, required: true },
        isTax: { type: Boolean, default: false },
        isPredefined: { type: Boolean, default: false }
    }],
    discount: {
        type: { type: String, enum: ['percentage', 'fixed'], default: 'fixed' },
        value: { type: mongoose.Types.Decimal128, default: '0.00' }
    },
    finalSubtotal: { type: mongoose.Types.Decimal128 },
    finalTotalCharges: { type: mongoose.Types.Decimal128 },
    finalTotalTax: { type: mongoose.Types.Decimal128 },
    finalGrandTotal: { type: mongoose.Types.Decimal128 },
    cuttingPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'CuttingPlan', index: true },
    cuttingPlanStatus: { type: String, enum: ['Pending', 'Generated', 'Committed', 'Failed'], default: 'Pending' },
    
    // Material commitment tracking (for non-profile materials)
    materialsCommitted: { type: Boolean, default: false },
    materialsCommittedAt: { type: Date },
    measurementConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    measurementConfirmedAt: Date,
    history: [{
        status: String,
        notes: String,
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now }
    }],
    termsAndConditions: String,
    paymentTerms: String,
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { 
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            // Iterate over all keys in the returned object
            for (const key in ret) {
                if (ret[key] instanceof mongoose.Types.Decimal128) {
                    ret[key] = ret[key].toString();
                }
                // Handle arrays of objects (like items, charges, history)
                if (Array.isArray(ret[key])) {
                    ret[key].forEach((item, index) => {
                        if (typeof item === 'object' && item !== null) {
                            for (const itemKey in item) {
                                if (item[itemKey] instanceof mongoose.Types.Decimal128) {
                                    item[itemKey] = item[itemKey].toString();
                                }
                                // Deeply handle nested arrays like cutLengths within items
                                if (Array.isArray(item[itemKey])) {
                                    item[itemKey].forEach((nestedItem, nestedIndex) => {
                                        if (nestedItem instanceof mongoose.Types.Decimal128) {
                                            item[itemKey][nestedIndex] = nestedItem.toString();
                                        }
                                    });
                                }
                                // Deeply handle nested objects like clientSnapshot
                                if (typeof item[itemKey] === 'object' && item[itemKey] !== null && !(item[itemKey] instanceof mongoose.Types.ObjectId) && !(item[itemKey] instanceof Date) ) {
                                    for (const subItemKey in item[itemKey]) {
                                        if (item[itemKey][subItemKey] instanceof mongoose.Types.Decimal128) {
                                            item[itemKey][subItemKey] = item[itemKey][subItemKey].toString();
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
                 // Handle nested objects like clientSnapshot or discount directly under ret
                if (typeof ret[key] === 'object' && ret[key] !== null && !(ret[key] instanceof mongoose.Types.ObjectId) && !(ret[key] instanceof Date) && !Array.isArray(ret[key])) {
                    for (const subKey in ret[key]) {
                         if (ret[key][subKey] instanceof mongoose.Types.Decimal128) {
                            ret[key][subKey] = ret[key][subKey].toString();
                        }
                    }
                }
            }
            // Specifically transform fields in sub-documents if not covered above
            if (ret.items) {
                ret.items.forEach(orderItem => {
                    if (orderItem.requiredMaterialCuts) {
                        orderItem.requiredMaterialCuts.forEach(cut => {
                            if (cut.cutLengths) {
                                cut.cutLengths = cut.cutLengths.map(cl => cl instanceof mongoose.Types.Decimal128 ? cl.toString() : cl);
                            }
                        });
                    }
                });
            }
            return ret;
        }
    }
});

// Indexes for efficient queries and ensure orderIdDisplay is unique per company
orderSchema.index({ companyId: 1, status: 1 });
orderSchema.index({ companyId: 1, clientId: 1 });
orderSchema.index({ companyId: 1, createdAt: -1 });
// Compound unique index: orderIdDisplay should be unique per company
orderSchema.index({ companyId: 1, orderIdDisplay: 1 }, { unique: true });

// TODO: Add pre-save hook for calculations if needed
// TODO: Add logic for generating unique orderIdDisplay (e.g., using a counter collection)

module.exports = mongoose.model('Order', orderSchema); 