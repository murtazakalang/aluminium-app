const mongoose = require('mongoose');

// Sub-schema for Profile/Pipe materials that need length/gauge tracking
const profileBatchSchema = new mongoose.Schema({
    batchId: { type: String, required: true },
    
    // Profile-specific physical properties (required for pipes)
    length: { type: mongoose.Types.Decimal128, required: true },
    lengthUnit: { type: String, required: true },
    gauge: { type: String, required: true },
    
    // Quantity tracking
    originalQuantity: { type: mongoose.Types.Decimal128, required: true },
    currentQuantity: { type: mongoose.Types.Decimal128, required: true },
    
    // Weight and cost data
    actualTotalWeight: { type: mongoose.Types.Decimal128 },
    actualWeightUnit: { type: String, default: 'kg' },
    totalCostPaid: { type: mongoose.Types.Decimal128, required: true },
    
    // Calculated rates
    ratePerPiece: { type: mongoose.Types.Decimal128, required: true },
    ratePerKg: { type: mongoose.Types.Decimal128 },
    
    // Purchase metadata
    supplier: String,
    purchaseDate: { type: Date, default: Date.now },
    invoiceNumber: String,
    lotNumber: String,
    notes: String,
    
    // Status
    isActive: { type: Boolean, default: true },
    isCompleted: { type: Boolean, default: false },
    lowStockThreshold: { type: mongoose.Types.Decimal128, default: '0' }
}, { _id: true });

// Sub-schema for non-Profile materials (Glass, Hardware, Consumables, Wire Mesh, etc.)
const simpleBatchSchema = new mongoose.Schema({
    batchId: { type: String, required: true },
    
    // Simple quantity tracking (no length/gauge needed for most materials)
    originalQuantity: { type: mongoose.Types.Decimal128, required: true },
    currentQuantity: { type: mongoose.Types.Decimal128, required: true },
    
    // Wire Mesh specific fields (optional, only for Wire Mesh category)
    selectedWidth: { type: mongoose.Types.Decimal128 }, // Selected width from standard widths
    widthUnit: { type: String }, // 'ft', 'm', etc.
    rollLength: { type: mongoose.Types.Decimal128 }, // Length of the roll
    rollLengthUnit: { type: String }, // 'ft', 'm', etc.
    areaPerRoll: { type: mongoose.Types.Decimal128 }, // Calculated area per roll (width × length)
    totalArea: { type: mongoose.Types.Decimal128 }, // Total area for all rolls in this batch
    areaUnit: { type: String }, // 'sqft', 'sqm', etc.
    ratePerArea: { type: mongoose.Types.Decimal128 }, // Rate per area unit (₹/sqft)
    
    // Cost data
    totalCostPaid: { type: mongoose.Types.Decimal128, required: true },
    ratePerUnit: { type: mongoose.Types.Decimal128, required: true }, // rate per stockUnit (per roll for Wire Mesh)
    
    // Purchase metadata
    supplier: String,
    purchaseDate: { type: Date, default: Date.now },
    invoiceNumber: String,
    lotNumber: String,
    notes: String,
    
    // Status
    isActive: { type: Boolean, default: true },
    isCompleted: { type: Boolean, default: false },
    lowStockThreshold: { type: mongoose.Types.Decimal128, default: '0' }
}, { _id: true });

const materialV2Schema = new mongoose.Schema({
    // Basic information
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true },
    category: { type: String, enum: ['Profile', 'Glass', 'Hardware', 'Accessories', 'Consumables', 'Wire Mesh'], required: true },
    
    // Unit definitions
    stockUnit: { type: String, required: true }, // 'piece', 'kg', 'sqft', etc.
    usageUnit: { type: String, required: true, enum: ['ft', 'inches', 'mm', 'sqft', 'sqm', 'pcs', 'kg'] },
    
    // Profile-specific configuration (only for category: 'Profile')
    standardLengths: [{ 
        length: { type: mongoose.Types.Decimal128, required: true },
        unit: { type: String, required: true, default: 'ft' }
    }],
    
    // Reference gauge weights (for quotation estimates only - NEVER updated, only for Profiles)
    referenceGaugeWeights: [{
        gauge: { type: String, required: true },
        referenceWeight: { type: mongoose.Types.Decimal128, required: true }, // kg per ft
        unitLength: { type: String, default: 'ft' }
    }],
    
    // CONDITIONAL STOCK BATCHES - Different schemas based on material type
    // For Profile materials: Use profileBatches
    profileBatches: [profileBatchSchema],
    
    // For non-Profile materials: Use simpleBatches
    simpleBatches: [simpleBatchSchema],
    
    // Aggregated totals (auto-calculated from active batches)
    aggregatedTotals: {
        totalCurrentStock: { type: mongoose.Types.Decimal128, default: '0' }, // Total pieces/units
        totalCurrentWeight: { type: mongoose.Types.Decimal128, default: '0' }, // Total kg (only for profiles)
        totalCurrentValue: { type: mongoose.Types.Decimal128, default: '0' }, // Total cost value
        averageRatePerPiece: { type: mongoose.Types.Decimal128, default: '0' },
        averageRatePerKg: { type: mongoose.Types.Decimal128, default: '0' }, // Only for profiles
        lastUpdated: { type: Date, default: Date.now }
    },
    
    // General material information
    supplier: String, // Default supplier
    brand: String,
    hsnCode: String,
    description: String,
    
    // System fields
    isActive: { type: Boolean, default: true },
    migrationStatus: { 
        type: String, 
        enum: ['pending', 'migrated', 'native'], 
        default: 'native' 
    },
    
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { 
    timestamps: true,
    collection: 'materials_v2'
});

// Virtual property to get the appropriate batches based on material type
materialV2Schema.virtual('activeBatches').get(function() {
    // Handle backward compatibility - check for old stockBatches field first
    if (this.stockBatches && this.stockBatches.length > 0) {
        console.warn(`[MaterialV2] WARNING: Material '${this.name}' still using old stockBatches structure. Please run migration.`);
        return this.stockBatches.filter(batch => batch.isActive && !batch.isCompleted);
    }
    
    // Use new structure
    if (this.category === 'Profile') {
        return this.profileBatches.filter(batch => batch.isActive && !batch.isCompleted);
    } else {
        return this.simpleBatches.filter(batch => batch.isActive && !batch.isCompleted);
    }
});

// Indexes for performance
materialV2Schema.index({ companyId: 1, name: 1 }, { unique: true });
materialV2Schema.index({ companyId: 1, category: 1 });
materialV2Schema.index({ 'profileBatches.batchId': 1 });
materialV2Schema.index({ 'simpleBatches.batchId': 1 });
materialV2Schema.index({ 'profileBatches.supplier': 1 });
materialV2Schema.index({ 'simpleBatches.supplier': 1 });

// Generate unique batch ID
materialV2Schema.statics.generateBatchId = function() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const time = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `BATCH_${date}_${time}_${random}`;
};

// Pre-save middleware to update aggregated totals
materialV2Schema.pre('save', function(next) {
    if (this.isModified('profileBatches') || this.isModified('simpleBatches') || this.isNew) {
        this.updateAggregatedTotals();
    }
    next();
});

// Method to update aggregated totals from active batches
materialV2Schema.methods.updateAggregatedTotals = function() {
    const activeBatches = this.activeBatches;
    
    let totalStock = 0;
    let totalWeight = 0;
    let totalValue = 0;
    let totalWeightValue = 0;
    
    for (const batch of activeBatches) {
        const currentQty = parseFloat(batch.currentQuantity.toString());
        let ratePerPiece;
        let stockToAdd = currentQty; // Default to quantity for most materials
        let valueToAdd;
        
        if (this.category === 'Profile') {
            ratePerPiece = parseFloat(batch.ratePerPiece.toString());
            
            // Add weight calculations for profiles
            if (batch.actualTotalWeight) {
                const batchWeight = parseFloat(batch.actualTotalWeight.toString());
                const originalQty = parseFloat(batch.originalQuantity.toString());
                const currentWeight = (batchWeight * currentQty / originalQty);
                totalWeight += currentWeight;
                
                if (batch.ratePerKg) {
                    const ratePerKg = parseFloat(batch.ratePerKg.toString());
                    totalWeightValue += (currentWeight * ratePerKg);
                }
            }
            
            valueToAdd = currentQty * ratePerPiece;
        } else if (this.category === 'Wire Mesh') {
            // For Wire Mesh, check stockUnit to determine what to track
            if (this.stockUnit === 'rolls' || this.stockUnit === 'pcs') {
                // Track by number of rolls/pieces
                stockToAdd = currentQty;
                ratePerPiece = parseFloat(batch.ratePerUnit.toString());
                valueToAdd = currentQty * ratePerPiece;
            } else if (batch.totalArea && batch.ratePerArea) {
                // Track by area (sqft, sqm, etc.)
                const currentArea = parseFloat(batch.totalArea.toString());
                const ratePerArea = parseFloat(batch.ratePerArea.toString());
                
                stockToAdd = currentArea;
                ratePerPiece = ratePerArea;
                valueToAdd = currentArea * ratePerArea;
            } else {
                // Fallback to quantity-based if area data is missing
                ratePerPiece = parseFloat(batch.ratePerUnit.toString());
                valueToAdd = currentQty * ratePerPiece;
            }
        } else {
            // Other non-Profile materials (Glass, Hardware, etc.)
            ratePerPiece = parseFloat(batch.ratePerUnit.toString());
            valueToAdd = currentQty * ratePerPiece;
        }
        
        totalStock += stockToAdd;
        totalValue += valueToAdd;
    }
    
    // Update aggregated totals
    this.aggregatedTotals.totalCurrentStock = mongoose.Types.Decimal128.fromString(String(totalStock));
    this.aggregatedTotals.totalCurrentWeight = mongoose.Types.Decimal128.fromString(String(totalWeight));
    this.aggregatedTotals.totalCurrentValue = mongoose.Types.Decimal128.fromString(String(totalValue));
    
    // Calculate average rates
    this.aggregatedTotals.averageRatePerPiece = totalStock > 0 ? 
        mongoose.Types.Decimal128.fromString(String(totalValue / totalStock)) : 
        mongoose.Types.Decimal128.fromString('0');
        
    this.aggregatedTotals.averageRatePerKg = totalWeight > 0 && totalWeightValue > 0 ? 
        mongoose.Types.Decimal128.fromString(String(totalWeightValue / totalWeight)) : 
        mongoose.Types.Decimal128.fromString('0');
        
    this.aggregatedTotals.lastUpdated = new Date();
    
    console.log(`[MaterialV2] Updated aggregated totals for '${this.name}' (${this.category}): Stock=${totalStock}, Weight=${totalWeight}kg, Value=₹${totalValue}`);
};

// Method to get stock summary by length/gauge combinations (for Profiles only)
materialV2Schema.methods.getStockSummary = function() {
    // Handle backward compatibility - check for old stockBatches field first
    if (this.stockBatches && this.stockBatches.length > 0) {
        console.warn(`[MaterialV2] WARNING: Material '${this.name}' still using old stockBatches structure. Please run migration.`);
        
        if (this.category !== 'Profile') {
            // For non-Profile materials with old structure, return simple summary
            const activeBatches = this.stockBatches.filter(b => b.isActive && !b.isCompleted);
            let totalQty = 0;
            let totalValue = 0;
            
            for (const batch of activeBatches) {
                const qty = parseFloat(batch.currentQuantity.toString());
                const rate = parseFloat(batch.ratePerPiece.toString());
                totalQty += qty;
                totalValue += (qty * rate);
            }
            
            return {
                simple: {
                    totalQuantity: totalQty,
                    totalValue: totalValue,
                    averageRate: totalQty > 0 ? (totalValue / totalQty) : 0,
                    batchCount: activeBatches.length
                }
            };
        }
        
        // For Profile materials with old structure, return detailed breakdown
        const summary = {};
        
        for (const batch of this.stockBatches.filter(b => b.isActive && !b.isCompleted)) {
            const key = `${batch.length}${batch.lengthUnit}${batch.gauge ? `_${batch.gauge}` : ''}`;
            
            if (!summary[key]) {
                summary[key] = {
                    length: batch.length ? batch.length.toString() : 'N/A',
                    lengthUnit: batch.lengthUnit || 'N/A',
                    gauge: batch.gauge || 'N/A',
                    totalQuantity: 0,
                    totalWeight: 0,
                    totalValue: 0,
                    averageRate: 0,
                    batches: []
                };
            }
            
            const currentQty = parseFloat(batch.currentQuantity.toString());
            const ratePerPiece = parseFloat(batch.ratePerPiece.toString());
            const batchValue = currentQty * ratePerPiece;
            
            summary[key].totalQuantity += currentQty;
            summary[key].totalValue += batchValue;
            
            // Calculate weight for this batch portion
            if (batch.actualTotalWeight) {
                const batchWeight = parseFloat(batch.actualTotalWeight.toString());
                const originalQty = parseFloat(batch.originalQuantity.toString());
                const currentWeight = (batchWeight * currentQty / originalQty);
                summary[key].totalWeight += currentWeight;
            }
            
            summary[key].batches.push({
                batchId: batch.batchId,
                quantity: currentQty,
                rate: ratePerPiece,
                supplier: batch.supplier,
                purchaseDate: batch.purchaseDate,
                invoiceNumber: batch.invoiceNumber
            });
        }
        
        // Calculate average rates for each combination
        Object.values(summary).forEach(item => {
            item.averageRate = item.totalQuantity > 0 ? (item.totalValue / item.totalQuantity) : 0;
        });
        
        return summary;
    }
    
    // Use new structure
    if (this.category !== 'Profile') {
        // For non-Profile materials, return simple summary
        const activeBatches = this.simpleBatches.filter(b => b.isActive && !b.isCompleted);
        let totalQty = 0;
        let totalValue = 0;
        
        for (const batch of activeBatches) {
            if (this.category === 'Wire Mesh') {
                // For Wire Mesh, check stockUnit to determine what to track
                if (this.stockUnit === 'rolls' || this.stockUnit === 'pcs') {
                    // Track by number of rolls/pieces
                    const qty = parseFloat(batch.currentQuantity.toString());
                    const rate = parseFloat(batch.ratePerUnit.toString());
                    totalQty += qty;
                    totalValue += (qty * rate);
                } else if (batch.totalArea && batch.ratePerArea) {
                    // Track by area (sqft, sqm, etc.)
                    const currentArea = parseFloat(batch.totalArea.toString());
                    const ratePerArea = parseFloat(batch.ratePerArea.toString());
                    totalQty += currentArea;
                    totalValue += (currentArea * ratePerArea);
                } else {
                    // Fallback to quantity-based if area data is missing
                    const qty = parseFloat(batch.currentQuantity.toString());
                    const rate = parseFloat(batch.ratePerUnit.toString());
                    totalQty += qty;
                    totalValue += (qty * rate);
                }
            } else {
                // Other non-Profile materials (Glass, Hardware, etc.)
                const qty = parseFloat(batch.currentQuantity.toString());
                const rate = parseFloat(batch.ratePerUnit.toString());
                totalQty += qty;
                totalValue += (qty * rate);
            }
        }
        
        return {
            simple: {
                totalQuantity: totalQty,
                totalValue: totalValue,
                averageRate: totalQty > 0 ? (totalValue / totalQty) : 0,
                batchCount: activeBatches.length
            }
        };
    }
    
    // For Profile materials, return detailed length/gauge breakdown
    const summary = {};
    
    for (const batch of this.profileBatches.filter(b => b.isActive && !b.isCompleted)) {
        const key = `${batch.length}${batch.lengthUnit}_${batch.gauge}`;
        
        if (!summary[key]) {
            summary[key] = {
                length: batch.length.toString(),
                lengthUnit: batch.lengthUnit,
                gauge: batch.gauge,
                totalQuantity: 0,
                totalWeight: 0,
                totalValue: 0,
                averageRate: 0,
                batches: []
            };
        }
        
        const currentQty = parseFloat(batch.currentQuantity.toString());
        const ratePerPiece = parseFloat(batch.ratePerPiece.toString());
        const batchValue = currentQty * ratePerPiece;
        
        summary[key].totalQuantity += currentQty;
        summary[key].totalValue += batchValue;
        
        // Calculate weight for this batch portion
        if (batch.actualTotalWeight) {
            const batchWeight = parseFloat(batch.actualTotalWeight.toString());
            const originalQty = parseFloat(batch.originalQuantity.toString());
            const currentWeight = (batchWeight * currentQty / originalQty);
            summary[key].totalWeight += currentWeight;
        }
        
        summary[key].batches.push({
            batchId: batch.batchId,
            quantity: currentQty,
            rate: ratePerPiece,
            supplier: batch.supplier,
            purchaseDate: batch.purchaseDate,
            invoiceNumber: batch.invoiceNumber
        });
    }
    
    // Calculate average rates for each combination
    Object.values(summary).forEach(item => {
        item.averageRate = item.totalQuantity > 0 ? (item.totalValue / item.totalQuantity) : 0;
    });
    
    return summary;
};

// Method to find available batches for consumption
materialV2Schema.methods.getAvailableBatches = function(filters = {}, sortOrder = 'FIFO') {
    const { length, lengthUnit, gauge, minQuantity = 0 } = filters;
    
    let availableBatches;
    
    // Handle backward compatibility - check for old stockBatches field first
    if (this.stockBatches && this.stockBatches.length > 0) {
        console.warn(`[MaterialV2] WARNING: Material '${this.name}' still using old stockBatches structure. Please run migration.`);
        availableBatches = this.stockBatches.filter(batch => {
            if (!batch.isActive || batch.isCompleted) return false;
            if (parseFloat(batch.currentQuantity.toString()) <= minQuantity) return false;
            
            // Apply filters
            if (length && batch.length && batch.length.toString() !== String(length)) return false;
            if (lengthUnit && batch.lengthUnit !== lengthUnit) return false;
            if (gauge && batch.gauge !== gauge) return false;
            
            return true;
        });
    } else if (this.category === 'Profile') {
        availableBatches = this.profileBatches.filter(batch => {
            if (!batch.isActive || batch.isCompleted) return false;
            if (parseFloat(batch.currentQuantity.toString()) <= minQuantity) return false;
            
            // Apply filters for profiles
            if (length && batch.length.toString() !== String(length)) return false;
            if (lengthUnit && batch.lengthUnit !== lengthUnit) return false;
            if (gauge && batch.gauge !== gauge) return false;
            
            return true;
        });
    } else {
        availableBatches = this.simpleBatches.filter(batch => {
            if (!batch.isActive || batch.isCompleted) return false;
            if (parseFloat(batch.currentQuantity.toString()) <= minQuantity) return false;
            
            return true;
        });
    }
    
    // Sort by date (FIFO/LIFO)
    if (sortOrder === 'FIFO') {
        availableBatches.sort((a, b) => a.purchaseDate - b.purchaseDate);
    } else if (sortOrder === 'LIFO') {
        availableBatches.sort((a, b) => b.purchaseDate - a.purchaseDate);
    }
    
    return availableBatches;
};

module.exports = mongoose.model('MaterialV2', materialV2Schema); 