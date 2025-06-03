const mongoose = require('mongoose');

const materialSubSchema = new mongoose.Schema({
    materialId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MaterialV2',
        required: true
    },
    materialNameSnapshot: {
        type: String
    },
    materialCategorySnapshot: {
        type: String,
        enum: ['Profile', 'Glass', 'Hardware', 'Accessories', 'Consumables', 'Wire Mesh'],
        // required: true // Implied by its usage, but let's keep it per PRD for now
    },
    formulas: {
        type: [String],
        default: []
    },
    formulaInputUnit: {
        type: String,
        enum: ['inches', 'mm', 'ft', 'm'],
        required: true
    },
    quantityUnit: {
        type: String,
        enum: ['ft', 'inches', 'mm', 'sqft', 'sqm', 'pcs', 'kg'],
        required: true
    },
    isCutRequired: {
        type: Boolean,
        default: false
    },
    defaultGauge: {
        type: String
    }
}, { _id: false });

const productTypeSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    imageUrl: {
        type: String
    },
    isActive: {
        type: Boolean,
        default: true
    },
    materials: [materialSubSchema],
    
    // Glass area calculation formula using separate width/height formulas for precise cutting
    glassAreaFormula: {
        // Separate width and height formulas with quantity for optimal glass cutting
        widthFormula: {
            type: String,
            default: ""
        },
        heightFormula: {
            type: String,
            default: ""
        },
        glassQuantity: {
            type: Number,
            default: 1,
            min: 1
        },
        
        formulaInputUnit: { 
            type: String, 
            enum: ['inches', 'mm', 'ft', 'm'], 
            default: 'inches' 
        },
        outputUnit: { 
            type: String, 
            enum: ['sqft', 'sqm'], 
            default: 'sqft' 
        },
        description: { 
            type: String, 
            default: "" 
        }
    },
    
    labourCost: {
        type: {
            type: String,
            enum: ['fixed', 'perSqft', 'perSqm', 'percentage'],
            default: 'fixed'
        },
        value: {
            type: mongoose.Schema.Types.Decimal128,
            default: '0.00'
        }
    },
    
    // SVG Technical Drawing
    technicalDrawing: {
        svgContent: {
            type: String, // Store the SVG XML content
            default: ''
        },
        prompt: {
            type: String, // Store the AI prompt used to generate the SVG
            default: ''
        },
        generatedAt: {
            type: Date
        },
        generatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        isActive: {
            type: Boolean,
            default: true
        }
    }
}, { timestamps: true });

productTypeSchema.index({ companyId: 1, name: 1 }, { unique: true });

// Helper function to transform Decimal128 to string for an object
const transformDecimalToString = (obj) => {
    for (const key in obj) {
        if (obj[key] instanceof mongoose.Types.Decimal128) {
            obj[key] = obj[key].toString();
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            transformDecimalToString(obj[key]); // Recurse for nested objects
        }
    }
};

// Apply toJSON transform to convert Decimal128 to string
productTypeSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        // Transform top-level Decimal128 fields
        transformDecimalToString(ret);
        return ret;
    }
});

module.exports = mongoose.model('ProductType', productTypeSchema); 