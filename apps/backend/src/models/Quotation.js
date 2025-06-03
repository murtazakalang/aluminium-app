const mongoose = require('mongoose');
const { calculateItemDetails, calculateQuotationTotals } = require('../utils/quotationCalculator');
const Company = require('./Company'); // Added for fetching company settings
const Setting = require('./Setting'); // Add Setting model for GST settings

// Quotation schema for managing formal quotations based on area pricing
const quotationSchema = new mongoose.Schema({
    companyId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Company', 
        required: true, 
        index: true 
    },
    quotationIdDisplay: { 
        type: String, 
        required: true, 
        unique: true
    }, // User-friendly ID like Q-2024-001
    clientId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Client', 
        required: true, 
        index: true 
    },
    
    // Store client details at time of creation for historical accuracy
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
        enum: ['Draft', 'Sent', 'Viewed', 'Accepted', 'Rejected', 'Expired', 'Converted'], 
        default: 'Draft',
        index: true
    },
    
    // Units configuration copied from settings or estimation
    dimensionUnit: { 
        type: String, 
        enum: ['inches', 'mm'], 
        required: true 
    },
    areaUnit: { 
        type: String, 
        enum: ['sqft', 'sqm'], 
        required: true 
    },
    priceUnit: { 
        type: String, 
        enum: ['sqft', 'sqm'], 
        required: true 
    },
    
    // Area calculation rules applied at time of creation
    areaRoundingRule: String, // e.g., 'nearest_0.25', 'nearest_0.5', 'nearest_0.023'
    minimumChargeableArea: mongoose.Types.Decimal128,
    
    // Quotation items with calculated values
    items: [{
        productTypeId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'ProductType', 
            required: true 
        },
        productTypeNameSnapshot: String,
        width: { 
            type: mongoose.Types.Decimal128, 
            required: true 
        },
        height: { 
            type: mongoose.Types.Decimal128, 
            required: true 
        },
        quantity: { 
            type: Number, 
            required: true, 
            default: 1 
        },
        itemLabel: String, // Optional description like "Living Room Window"
        
        // NEW: Glass and frame information for display
        selectedGlassTypeId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'MaterialV2' 
        },
        selectedGlassTypeNameSnapshot: String,
        frameColour: { 
            type: String, 
            default: "" 
        },
        
        // Calculated values stored per item
        rawAreaPerItem: { type: mongoose.Types.Decimal128 }, // W x H in dimensionUnit's square
        convertedAreaPerItem: { type: mongoose.Types.Decimal128 }, // rawAreaPerItem converted to areaUnit (e.g. sq.inches to sqft)
        roundedAreaPerItem: { type: mongoose.Types.Decimal128 }, // After rounding
        chargeableAreaPerItem: { type: mongoose.Types.Decimal128 }, // After minimum area rule
        totalChargeableArea: { type: mongoose.Types.Decimal128 }, // chargeableAreaPerItem * quantity
        pricePerAreaUnit: { 
            type: mongoose.Types.Decimal128, 
            required: true 
        },
        itemSubtotal: { type: mongoose.Types.Decimal128 }, // totalChargeableArea * pricePerAreaUnit
        
        // Material list snapshot for this item (optional, useful for later analysis/order conversion)
        materialsSnapshot: [{
            materialId: { 
                type: mongoose.Schema.Types.ObjectId, 
                ref: 'MaterialV2', 
                required: true 
            },
            materialName: String,
            quantity: mongoose.Types.Decimal128,
            unit: String
        }],
    }],
    
    // Additional charges (freight, custom charges, taxes)
    charges: [{
        description: String, // e.g., "Freight", "GST", "Custom Charge"
        amount: { 
            type: mongoose.Types.Decimal128, 
            required: true 
        },
        isTax: { 
            type: Boolean, 
            default: false 
        },
        isPredefined: { 
            type: Boolean, 
            default: false 
        } // Was this from settings?
    }],
    
    // Discount configuration
    discount: {
        type: { 
            type: String, 
            enum: ['percentage', 'fixed'], 
            default: 'fixed' 
        },
        value: { 
            type: mongoose.Types.Decimal128, 
            default: '0.00' 
        }
    },
    
    // Calculated Totals
    subtotal: { type: mongoose.Types.Decimal128 }, // Sum of itemSubtotals
    totalCharges: { type: mongoose.Types.Decimal128 },
    discountAmount: { type: mongoose.Types.Decimal128, default: '0.00' }, // Calculated discount amount
    totalTax: { type: mongoose.Types.Decimal128 },
    grandTotal: { type: mongoose.Types.Decimal128 },
    
    // Metadata
    termsAndConditions: String, // Copied from settings at time of creation
    paymentTerms: String, // Copied from settings at time of creation
    notes: String,
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    validUntil: Date,
    
    createdAt: { 
        type: Date, 
        default: Date.now,
        index: true
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    },
    history: [{
        status: String,
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        notes: String,
        timestamp: { type: Date, default: Date.now }
    }]
}, { 
    timestamps: true 
});

// Indexes for efficient queries
quotationSchema.index({ companyId: 1, status: 1 });
quotationSchema.index({ companyId: 1, clientId: 1 });
quotationSchema.index({ companyId: 1, createdAt: -1 });
// quotationSchema.index({ quotationIdDisplay: 1 });

// Pre-save hook to calculate totals
quotationSchema.pre('save', async function(next) {
    try {
        // Fetch company settings for GST configuration
        const settings = await Setting.findOne({ companyId: this.companyId }).select('gst');
        console.log('[Quotation Pre-save] GST Settings found:', JSON.stringify(settings?.gst, null, 2));
        
        // 1. Calculate details for each item
        this.items.forEach(item => {
            const itemInput = {
                width: item.width ? item.width.toString() : '0',
                height: item.height ? item.height.toString() : '0',
                quantity: item.quantity,
                pricePerAreaUnit: item.pricePerAreaUnit ? item.pricePerAreaUnit.toString() : '0',
            };

            // Call uses default applyMinimum = true, which is desired for DB storage
            const calculated = calculateItemDetails(
                itemInput, 
                this.dimensionUnit, 
                this.areaUnit
                // companySettingsForItems // This argument is removed
            );
            
            // Map new return values to schema fields
            item.rawAreaPerItem = mongoose.Types.Decimal128.fromString(calculated.rawAreaInDimUnits.toFixed(6));
            item.convertedAreaPerItem = mongoose.Types.Decimal128.fromString(calculated.convertedAreaBeforeRules.toFixed(6));
            item.roundedAreaPerItem = mongoose.Types.Decimal128.fromString(calculated.roundedArea.toFixed(6));
            item.chargeableAreaPerItem = mongoose.Types.Decimal128.fromString(calculated.finalChargeableAreaPerItem.toFixed(6)); // This is the 'finalArea'
            item.totalChargeableArea = mongoose.Types.Decimal128.fromString(calculated.totalFinalChargeableArea.toFixed(6));
            item.itemSubtotal = mongoose.Types.Decimal128.fromString(calculated.itemSubtotal.toFixed(2));
        });

        // 1.5. Apply GST logic before calculating final totals
        const preliminarySubtotalForGst = this.items.reduce((sum, item) => {
            return sum + (item.itemSubtotal ? parseFloat(item.itemSubtotal.toString()) : 0);
        }, 0);
        
        console.log('[Quotation Pre-save] Subtotal for GST calculation:', preliminarySubtotalForGst);

        const gstSettings = settings?.gst || { enabled: false, percentage: 0 };
        console.log('[Quotation Pre-save] GST Settings to apply:', gstSettings);

        // Ensure charges array exists
        if (!this.charges) {
            this.charges = [];
        }

        // Remove any existing predefined GST charge to avoid duplication on updates
        this.charges = this.charges.filter(charge => {
            const description = charge.description || '';
            return !(charge.isPredefined && charge.isTax && description.startsWith('GST'));
        });
        
        if (gstSettings.enabled && gstSettings.percentage > 0) {
            const gstAmount = (preliminarySubtotalForGst * gstSettings.percentage) / 100;
            console.log('[Quotation Pre-save] Calculated GST amount:', gstAmount);
            if (gstAmount > 0) { // Only add if GST amount is more than 0
                this.charges.push({
                    description: `GST (${gstSettings.percentage}%)`,
                    amount: mongoose.Types.Decimal128.fromString(gstAmount.toFixed(2)),
                    isTax: true,
                    isPredefined: true
                });
                console.log('[Quotation Pre-save] Added GST charge:', `GST (${gstSettings.percentage}%): ₹${gstAmount.toFixed(2)}`);
            }
        } else {
            console.log('[Quotation Pre-save] GST not applied - enabled:', gstSettings.enabled, 'percentage:', gstSettings.percentage);
        }

        // 2. Calculate overall quotation totals (subtotal, totalCharges, discountAmount, grandTotal)
        // This will now include the GST charge if it was added.
        const itemsForTotalCalculation = this.items.map(item => ({
            itemSubtotal: item.itemSubtotal ? item.itemSubtotal.toString() : '0'
        }));

        const chargesForTotalCalculation = (this.charges || []).map(charge => ({
            ...charge,
            amount: charge.amount ? charge.amount.toString() : '0'
        }));
        
        const discountForTotalCalculation = {
            type: this.discount ? this.discount.type : 'fixed',
            value: this.discount && this.discount.value ? this.discount.value.toString() : '0'
        };

        const totals = calculateQuotationTotals(
            itemsForTotalCalculation, 
            chargesForTotalCalculation, 
            discountForTotalCalculation
        );

        this.subtotal = mongoose.Types.Decimal128.fromString(totals.subtotal.toFixed(2));
        this.totalCharges = mongoose.Types.Decimal128.fromString(totals.totalChargesAmount.toFixed(2));
        this.discountAmount = mongoose.Types.Decimal128.fromString(totals.discountAmount.toFixed(2));
        this.grandTotal = mongoose.Types.Decimal128.fromString(totals.grandTotal.toFixed(2));

        // 3. Calculate totalTax (sum of charges marked as isTax)
        // This will correctly sum up all tax charges, including the newly added GST.
        let totalTaxSum = 0;
        (this.charges || []).forEach(charge => {
            if (charge.isTax) {
                const chargeAmountNumber = charge.amount ? parseFloat(charge.amount.toString()) : 0;
                totalTaxSum += chargeAmountNumber;
            }
        });
        this.totalTax = mongoose.Types.Decimal128.fromString(totalTaxSum.toFixed(2));
        
        console.log('[Quotation Pre-save] Final totals - Subtotal:', totals.subtotal, 'Charges:', totals.totalChargesAmount, 'Grand Total:', totals.grandTotal);

        next();
    } catch (error) {
        console.error('Error in Quotation pre-save hook:', error);
        next(error); // Pass error to Mongoose
    }
});

module.exports = mongoose.model('Quotation', quotationSchema); 