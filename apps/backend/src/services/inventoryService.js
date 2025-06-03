const mongoose = require('mongoose');
// const { Decimal128 } = require('bson'); // No longer using bson Decimal128 for math
const Decimal = require('decimal.js'); // Import decimal.js
const MaterialV2 = require('../models/MaterialV2');
const StockTransaction = require('../models/StockTransaction');
const { getWeight: calculateWeightUtil } = require('../utils/weightUtils'); // Renamed to avoid conflict

/**
 * Records the inward stock for a profile material.
 * - Adds/merges standardLengths & gaugeSpecificWeights.
 * - Updates stockByLength entries.
 * - Creates a StockTransaction (type=InitialStock or Inward).
 */
async function recordProfileStockInward(companyId, userId, data) {
    // TODO: Implement actual logic as per PRD and DevelopmentTaskUnpdated.md
    // Destructure data: { materialId, gauge, standardLength, pieces, totalWeight, totalCost, ...other MaterialV2 fields if new }
    console.log('recordProfileStockInward called with:', { companyId, userId, data });

    const { 
        materialId, 
        gauge, 
        standardLength, // object: { length, unit }
        pieces, 
        totalWeight, // object: { weight, unit }
        totalCost,
        supplier,
        brand,
        hsnCode,
        description,
        name, // if creating a new material
        category, // should be 'Profile'
        stockUnit, // e.g. 'pipe'
        usageUnit, // e.g. 'ft'
        weightUnit // e.g. 'kg'
    } = data;

    // Convert necessary inputs to Decimal instances early for precision
    let decPieces, decStandardLengthValue, decTotalWeightValue, decTotalCostValue;
    try {
        decPieces = new Decimal(String(pieces));
        decStandardLengthValue = new Decimal(String(standardLength.length));
        decTotalWeightValue = new Decimal(String(totalWeight.weight));
        decTotalCostValue = new Decimal(String(totalCost));
    } catch (e) {
        throw new Error(`Invalid numeric input for inward stock: ${e.message}`);
    }

    if (decPieces.isNegative() || decPieces.isZero()) {
        throw new Error('Number of pieces for inward stock must be positive.');
    }

    let material;
    let isNewMaterial = false;

    // Basic placeholder logic, full implementation is complex
    if (materialId) {
        material = await MaterialV2.findById(materialId);
        if (!material) {
            throw new Error('MaterialV2 not found');
        }
        if (material.category !== 'Profile') {
            throw new Error('Stock inward for profiles can only be done for materials of category Profile.');
        }
    } else {
        // Simplified: create new material if ID not provided (actual flow might be different)
        if (!name || !category || category !== 'Profile' || !stockUnit || !usageUnit || !weightUnit) {
            throw new Error('Missing required fields for new profile material.');
        }
        material = new MaterialV2({
            companyId,
            name,
            category: 'Profile',
            stockUnit,
            usageUnit,
            weightUnit,
            supplier,
            brand,
            hsnCode,
            description,
            standardLengths: [],
            stockByLength: [],
            gaugeSpecificWeights: [],
            createdBy: userId,
            updatedBy: userId,
        });
        isNewMaterial = true;
    }

    // 1. Add/merge standardLengths (storage uses Mongoose Decimal128)
    const mongooseSlDecimal = mongoose.Types.Decimal128.fromString(String(standardLength.length));
    const existingStandardLength = material.standardLengths.find(
        sl => sl.length.toString() === mongooseSlDecimal.toString() && sl.unit === standardLength.unit
    );
    if (!existingStandardLength) {
        material.standardLengths.push({ length: mongooseSlDecimal, unit: standardLength.unit });
    }

    // 2. Gauge-specific weights: Each gauge should have its own separate weightPerUnitLength
    if (gauge) {
        const newBatchTotalLength = decStandardLengthValue.times(decPieces);
        if (newBatchTotalLength.isZero()) {
            throw new Error('Total length of new stock batch cannot be zero for WUL calculation.');
        }
        const newBatchWUL = decTotalWeightValue.div(newBatchTotalLength); // WUL for this specific batch

        let existingGaugeWeight = material.gaugeSpecificWeights.find(gsw => gsw.gauge === gauge);

        if (!existingGaugeWeight) {
            // New gauge entry - just add it with its own weight
            material.gaugeSpecificWeights.push({
                gauge,
                weightPerUnitLength: mongoose.Types.Decimal128.fromString(newBatchWUL.toString()),
                unitLength: standardLength.unit,
            });
            console.log(`[InventoryService] Added new gauge ${gauge} with weight ${newBatchWUL} ${standardLength.unit}/kg`);
        } else {
            // Existing gauge entry - DON'T update the weightPerUnitLength
            // Each batch can have different actual weights, so we preserve the original gauge weight
            // The actual weight tracking is handled in the MaterialV2 pre-save hook and totalStockQuantity
            
            console.log(`[InventoryService] Preserving existing gauge ${gauge} weight ${existingGaugeWeight.weightPerUnitLength} (not updating to ${newBatchWUL})`);
            
            // Only update if the unit length is different
            if (existingGaugeWeight.unitLength !== standardLength.unit) {
                existingGaugeWeight.unitLength = standardLength.unit;
            }
        }
        
        if (material.weightUnit !== totalWeight.unit) {
            material.weightUnit = totalWeight.unit;
        }
    }

    // 3. Gauge-specific stockByLength handling
    const mongooseSlDecimalForSearch = mongoose.Types.Decimal128.fromString(decStandardLengthValue.toString());
    
    // Look for existing stock entry with same length, unit AND gauge (if gauge is specified)
    let stockLengthEntry = material.stockByLength.find(sbl => {
        const lengthMatch = sbl.length.toString() === mongooseSlDecimalForSearch.toString() && 
                           sbl.unit === standardLength.unit;
        
        if (!gauge) {
            // If no gauge specified, match entries without gauge
            return lengthMatch && !sbl.gauge;
        } else {
            // If gauge specified, match entries with the same gauge
            return lengthMatch && sbl.gauge === gauge;
        }
    });

    const newRateForThisBatch_Decimal = decTotalCostValue.div(decPieces); // Cost per piece for this batch

    if (isNewMaterial || !stockLengthEntry) { 
        const newQuantity_Decimal = decPieces;
        if (!stockLengthEntry) { 
            stockLengthEntry = {
                length: mongooseSlDecimalForSearch,
                unit: standardLength.unit,
                gauge: gauge || undefined, // Include gauge if specified
                quantity: mongoose.Types.Decimal128.fromString(newQuantity_Decimal.toString()),
                unitRate: mongoose.Types.Decimal128.fromString(newRateForThisBatch_Decimal.toString()),
                lowStockThreshold: mongoose.Types.Decimal128.fromString('0'), // Default threshold
                actualWeight: mongoose.Types.Decimal128.fromString(decTotalWeightValue.toString()), // Store actual weight
            };
            material.stockByLength.push(stockLengthEntry);
            console.log(`[InventoryService] Created new stock entry: ${standardLength.length}${standardLength.unit}${gauge ? ` ${gauge}` : ''} - ${pieces} pieces at ₹${newRateForThisBatch_Decimal}/piece, actual weight: ${decTotalWeightValue}kg`);
        } else { // For isNewMaterial = true, material.stockByLength was initialized as empty array.
                 // This path should ideally not be hit if !stockLengthEntry is true for a new material.
                 // However, to be safe, if stockLengthEntry was somehow pre-initialized for a new material:
            stockLengthEntry.quantity = mongoose.Types.Decimal128.fromString(newQuantity_Decimal.toString());
            stockLengthEntry.unitRate = mongoose.Types.Decimal128.fromString(newRateForThisBatch_Decimal.toString());
            stockLengthEntry.actualWeight = mongoose.Types.Decimal128.fromString(decTotalWeightValue.toString());
            if (gauge) stockLengthEntry.gauge = gauge;
        }
    } else { // Existing material and existing stock length entry
        const existingQty_Decimal = new Decimal(stockLengthEntry.quantity.toString());
        const existingRate_Decimal = new Decimal(stockLengthEntry.unitRate.toString());
        
        // Calculate existing actual weight if not already set
        let existingActualWeight_Decimal;
        if (stockLengthEntry.actualWeight) {
            existingActualWeight_Decimal = new Decimal(stockLengthEntry.actualWeight.toString());
        } else {
            // Calculate existing weight based on gauge weight
            const existingGaugeWeight = material.gaugeSpecificWeights.find(gsw => gsw.gauge === gauge);
            if (existingGaugeWeight && gauge) {
                const gaugeWeightValue = parseFloat(existingGaugeWeight.weightPerUnitLength.toString());
                const lengthValue = parseFloat(stockLengthEntry.length.toString());
                const qtyValue = parseFloat(stockLengthEntry.quantity.toString());
                existingActualWeight_Decimal = new Decimal(gaugeWeightValue * lengthValue * qtyValue);
                console.log(`[InventoryService] Calculated existing weight for ${gauge}: ${qtyValue} pieces × ${lengthValue}ft × ${gaugeWeightValue}kg/ft = ${existingActualWeight_Decimal}kg`);
            } else {
                existingActualWeight_Decimal = new Decimal(0);
                console.log(`[InventoryService] No gauge weight found for ${gauge}, using 0 for existing weight`);
            }
        }
        
        const newPcs_Decimal = decPieces; // Already a Decimal from start of function
        const combinedTotalQty_Decimal = existingQty_Decimal.plus(newPcs_Decimal);
        const combinedActualWeight_Decimal = existingActualWeight_Decimal.plus(decTotalWeightValue);

        if (combinedTotalQty_Decimal.isZero()) { 
            stockLengthEntry.unitRate = mongoose.Types.Decimal128.fromString(newRateForThisBatch_Decimal.toString());
            stockLengthEntry.actualWeight = mongoose.Types.Decimal128.fromString(decTotalWeightValue.toString());
        } else {
            const totalCostContributionExisting = existingQty_Decimal.times(existingRate_Decimal);
            // totalCostValue is the total cost of the new batch, which is newPcs_Decimal * newRateForThisBatch_Decimal
            const combinedTotalCost = totalCostContributionExisting.plus(decTotalCostValue);
            
            const newAverageRate_Decimal = combinedTotalCost.div(combinedTotalQty_Decimal);
            stockLengthEntry.unitRate = mongoose.Types.Decimal128.fromString(newAverageRate_Decimal.toString());
            stockLengthEntry.actualWeight = mongoose.Types.Decimal128.fromString(combinedActualWeight_Decimal.toString());
        }
        stockLengthEntry.quantity = mongoose.Types.Decimal128.fromString(combinedTotalQty_Decimal.toString());
        
        console.log(`[InventoryService] Updated existing stock entry: ${standardLength.length}${standardLength.unit}${gauge ? ` ${gauge}` : ''} - ${existingQty_Decimal} + ${newPcs_Decimal} = ${combinedTotalQty_Decimal} pieces at ₹${stockLengthEntry.unitRate}/piece, existing weight: ${existingActualWeight_Decimal}kg + new weight: ${decTotalWeightValue}kg = total actual weight: ${combinedActualWeight_Decimal}kg`);
    }
    
    material.updatedBy = userId;
    await material.save();

    // 4. Create a StockTransaction (storage uses Mongoose Decimal128)
    const mongooseRateForThisBatch = mongoose.Types.Decimal128.fromString(newRateForThisBatch_Decimal.toString());
    const mongoosePiecesForStock = mongoose.Types.Decimal128.fromString(decPieces.toString()); // Use decPieces

    const stockTransaction = new StockTransaction({
        companyId,
        materialId: material._id,
        type: 'Inward',
        length: mongooseSlDecimalForSearch, // Use the searched decimal
        lengthUnit: standardLength.unit,
        quantityChange: mongoosePiecesForStock,
        quantityUnit: material.stockUnit, // This should be pieces for profile pipes, e.g. 'pcs' or 'pipe'
        unitRateAtTransaction: mongooseRateForThisBatch, // Rate of THIS batch
        relatedDocumentType: 'ProfileInward',
        notes: `Profile stock inward: ${pieces} ${material.stockUnit}(s) of ${standardLength.length} ${standardLength.unit}, gauge ${gauge}${supplier ? `, from ${supplier}` : ''}`,
        createdBy: userId,
    });
    await stockTransaction.save();

    return { material, stockTransaction };
}

/**
 * Gets the weight of a material for a given gauge and cut length.
 * Wrapper around the utility function.
 */
async function getWeight(materialId, gauge, cutLength, cutLengthUnit) {
    return calculateWeightUtil(materialId, gauge, cutLength, cutLengthUnit);
}

module.exports = {
    recordProfileStockInward,
    getWeight,
}; 