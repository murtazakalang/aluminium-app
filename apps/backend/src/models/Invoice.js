const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    invoiceIdDisplay: { type: String, required: true }, // e.g., INV-2024-001
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderIdDisplaySnapshot: String,
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
        enum: ['Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Void'], 
        default: 'Draft' 
    },
    // Invoice details are based on the FINAL state of the Order
    items: [{
        productTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductType' },
        productTypeNameSnapshot: String,
        finalWidth: { type: mongoose.Types.Decimal128 },
        finalHeight: { type: mongoose.Types.Decimal128 },
        finalQuantity: Number,
        itemLabel: String,
        selectedGlassTypeNameSnapshot: String,
        frameColour: String,
        finalChargeableAreaPerItem: { type: mongoose.Types.Decimal128 },
        finalTotalChargeableArea: { type: mongoose.Types.Decimal128 },
        pricePerAreaUnit: { type: mongoose.Types.Decimal128 },
        finalItemSubtotal: { type: mongoose.Types.Decimal128 },
    }],
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
    subtotal: { type: mongoose.Types.Decimal128 }, // Final from Order
    totalCharges: { type: mongoose.Types.Decimal128 }, // Final from Order
    totalTax: { type: mongoose.Types.Decimal128 }, // Final from Order
    grandTotal: { type: mongoose.Types.Decimal128 }, // Final from Order - Amount Due
    // Payment Tracking
    amountPaid: { type: mongoose.Types.Decimal128, default: '0.00' },
    balanceDue: { type: mongoose.Types.Decimal128 }, // grandTotal - amountPaid
    payments: [{
        paymentDate: { type: Date, required: true },
        amount: { type: mongoose.Types.Decimal128, required: true },
        method: String, // e.g., 'Bank Transfer', 'Cash', 'Razorpay'
        reference: String,
        notes: String,
        recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        recordedAt: { type: Date, default: Date.now }
    }],
    // Metadata
    invoiceDate: { type: Date, default: Date.now },
    dueDate: Date,
    termsAndConditions: String, // Copied from Order/Settings
    paymentTerms: String, // Copied from Order/Settings
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // User who generated invoice
}, { 
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            // Transform Decimal128 to strings for JSON output
            for (const key in ret) {
                if (ret[key] instanceof mongoose.Types.Decimal128) {
                    ret[key] = ret[key].toString();
                }
                // Handle arrays of objects (like items, charges, payments)
                if (Array.isArray(ret[key])) {
                    ret[key].forEach((item) => {
                        if (typeof item === 'object' && item !== null) {
                            for (const itemKey in item) {
                                if (item[itemKey] instanceof mongoose.Types.Decimal128) {
                                    item[itemKey] = item[itemKey].toString();
                                }
                            }
                        }
                    });
                }
                // Handle nested objects like clientSnapshot or discount
                if (typeof ret[key] === 'object' && ret[key] !== null && !(ret[key] instanceof mongoose.Types.ObjectId) && !(ret[key] instanceof Date) && !Array.isArray(ret[key])) {
                    for (const subKey in ret[key]) {
                        if (ret[key][subKey] instanceof mongoose.Types.Decimal128) {
                            ret[key][subKey] = ret[key][subKey].toString();
                        }
                    }
                }
            }
            return ret;
        }
    }
});

// Compound unique index to ensure invoiceIdDisplay is unique per company
invoiceSchema.index({ companyId: 1, invoiceIdDisplay: 1 }, { unique: true });

// Prevent auto-indexing on invoiceIdDisplay field to avoid recreating global unique index
invoiceSchema.path('invoiceIdDisplay').index(false);

// Calculate balanceDue and update status before saving
invoiceSchema.pre('save', function(next) {
    try {
        // Calculate balance due
        const grandTotal = this.grandTotal || mongoose.Types.Decimal128.fromString('0.00');
        const amountPaid = this.amountPaid || mongoose.Types.Decimal128.fromString('0.00');
        this.balanceDue = mongoose.Types.Decimal128.fromString(
            (parseFloat(grandTotal.toString()) - parseFloat(amountPaid.toString())).toFixed(2)
        );

        // Update status based on payment
        const balanceValue = parseFloat(this.balanceDue.toString());
        const grandTotalValue = parseFloat(grandTotal.toString());
        const amountPaidValue = parseFloat(amountPaid.toString());

        if (balanceValue <= 0 && grandTotalValue > 0) {
            this.status = 'Paid';
        } else if (amountPaidValue > 0 && balanceValue > 0) {
            this.status = 'Partially Paid';
        } else if (this.dueDate && new Date() > this.dueDate && balanceValue > 0) {
            this.status = 'Overdue';
        }

        next();
    } catch (error) {
        next(error);
    }
});

// Utility function to generate unique invoiceIdDisplay
async function generateInvoiceIdDisplay(companyId) {
    const count = await mongoose.model('Invoice').countDocuments({ companyId });
    return `INV-${new Date().getFullYear()}-${(count + 1).toString().padStart(3, '0')}`;
}

// Static method to generate invoice from order
invoiceSchema.statics.createFromOrder = async function(order, userId, invoiceDate = new Date(), dueDate = null) {
    const invoiceIdDisplay = await generateInvoiceIdDisplay(order.companyId);
    
    // Calculate due date if not provided (30 days from invoice date)
    if (!dueDate) {
        dueDate = new Date(invoiceDate);
        dueDate.setDate(dueDate.getDate() + 30);
    }

    const invoiceData = {
        companyId: order.companyId,
        invoiceIdDisplay,
        orderId: order._id,
        orderIdDisplaySnapshot: order.orderIdDisplay,
        clientId: order.clientId,
        clientSnapshot: order.clientSnapshot,
        status: 'Draft',
        // Snapshot items from order
        items: order.items.map(item => ({
            productTypeId: item.productTypeId,
            productTypeNameSnapshot: item.productTypeNameSnapshot,
            finalWidth: item.finalWidth,
            finalHeight: item.finalHeight,
            finalQuantity: item.finalQuantity,
            itemLabel: item.itemLabel,
            selectedGlassTypeNameSnapshot: item.selectedGlassTypeNameSnapshot,
            frameColour: item.frameColour,
            finalChargeableAreaPerItem: item.finalChargeableAreaPerItem,
            finalTotalChargeableArea: item.finalTotalChargeableArea,
            pricePerAreaUnit: item.pricePerAreaUnit,
            finalItemSubtotal: item.finalItemSubtotal,
        })),
        charges: order.charges,
        discount: order.discount,
        subtotal: order.finalSubtotal,
        totalCharges: order.finalTotalCharges,
        totalTax: order.finalTotalTax,
        grandTotal: order.finalGrandTotal,
        invoiceDate,
        dueDate,
        termsAndConditions: order.termsAndConditions,
        paymentTerms: order.paymentTerms,
        notes: order.notes,
        createdBy: userId,
    };

    return await this.create(invoiceData);
};

module.exports = mongoose.model('Invoice', invoiceSchema); 