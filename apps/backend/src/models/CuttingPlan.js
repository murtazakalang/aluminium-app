const mongoose = require('mongoose');

/**
 * Schema for Cutting Plan.
 * Stores the detailed plan for cutting materials for a specific order.
 */
const cuttingPlanSchema = new mongoose.Schema({
    companyId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Company', 
        required: true, 
        index: true 
    },
    orderId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Order', 
        required: true, 
        unique: true, 
        index: true 
    },
    generatedAt: { 
        type: Date, 
        default: Date.now 
    },
    generatedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    status: { 
        type: String, 
        enum: ['Generated', 'Committed'], 
        default: 'Generated' 
    },
    materialPlans: [{
        materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialV2' },
        materialNameSnapshot: String,
        gaugeSnapshot: String, // Gauge used for this material in this order
        usageUnit: String, // Unit of the cuts (e.g., 'inches')
        pipesUsed: [{
            standardLength: { 
                type: mongoose.Types.Decimal128 
            }, // e.g., 16
            standardLengthUnit: { 
                type: String 
            }, // e.g., 'ft'
            cutsMade: [{ // List of the required cuts placed on THIS pipe
                requiredLength: { 
                    type: mongoose.Types.Decimal128 
                },
                identifier: { type: String }, // e.g., "W1", "Item 3"
                // Optional: Link back to original OrderItem if needed
            }],
            totalCutLengthOnPipe: { 
                type: mongoose.Types.Decimal128 
            }, // Sum of cutsMade lengths (in usageUnit)
            scrapLength: { 
                type: mongoose.Types.Decimal128 
            }, // Standard Pipe Length (converted to usageUnit) - totalCutLengthOnPipe
            calculatedWeight: { 
                type: mongoose.Types.Decimal128 
            }, // Optional: Weight of this pipe based on gauge/length
        }],
        // Summary for this material (matches pipe-order-summary endpoint structure)
        totalPipesPerLength: [{ 
            length: Number, 
            unit: String, 
            quantity: Number, 
            totalScrap: mongoose.Types.Decimal128,
            scrapUnit: String // Unit for scrap values (material's usage unit)
        }],
        totalWeight: { 
            type: mongoose.Types.Decimal128 
        },
    }],
}, { timestamps: true });

module.exports = mongoose.model('CuttingPlan', cuttingPlanSchema); 