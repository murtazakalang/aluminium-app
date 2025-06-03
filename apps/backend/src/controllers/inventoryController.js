const MaterialV2 = require('../models/MaterialV2');
const StockTransaction = require('../models/StockTransaction');
const ProductType = require('../models/ProductType');
const mongoose = require('mongoose');
const inventoryService = require('../services/inventoryService');
const Decimal = require('decimal.js');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Helper function for error responses
const handleError = (res, error, statusCode = 500) => {
    console.error(error);
    // If it's a mongoose validation error, it has an 'errors' object
    if (error.name === 'ValidationError' && error.errors) {
        const messages = Object.values(error.errors).map(e => e.message);
        return res.status(400).json({ message: 'Validation Error', errors: messages });
    }
    res.status(statusCode).json({ message: error.message || 'Server Error' });
};

// Get MaterialV2 Categories
exports.getMaterialCategories = async (req, res) => {
    try {
        // As per PRD: return a static list
        const categories = ["Profile","Glass","Hardware","Accessories","Consumables"];
        res.status(200).json(categories);
    } catch (error) {
        handleError(res, error);
    }
};

// Add a new material
exports.addMaterial = async (req, res) => {
    try {
        const { companyId, _id: userId } = req.user;
        const materialData = { ...req.body, companyId, createdBy: userId, updatedBy: userId };

        console.log('[addMaterial] Received material data:', {
            name: materialData.name,
            category: materialData.category,
            stockByLength: materialData.stockByLength?.map(s => ({
                length: s.length,
                gauge: s.gauge,
                unitRate: s.unitRate,
                unitRateType: typeof s.unitRate
            }))
        });

        // Check if an ACTIVE material with the same name already exists for this company
        const existingActiveMaterial = await MaterialV2.findOne({
            name: materialData.name,
            companyId: companyId,
            isActive: true 
        });

        if (existingActiveMaterial) {
            return handleError(res, { message: 'An active material with this name already exists for your company.' }, 400);
        }

        // Category-specific logic for saving stock fields
        if (materialData.category === 'Profile') {
            console.log('[addMaterial] Processing Profile category...');
            
            // Convert numeric fields to Decimal128 for proper storage
            if (materialData.stockByLength) {
                console.log('[addMaterial] Converting stockByLength fields...');
                materialData.stockByLength.forEach((stockItem, index) => {
                    console.log(`[addMaterial] Processing stock item ${index + 1}:`, {
                        before: {
                            length: stockItem.length,
                            quantity: stockItem.quantity,
                            unitRate: stockItem.unitRate,
                            unitRateType: typeof stockItem.unitRate,
                            gauge: stockItem.gauge
                        }
                    });
                    
                    // Convert numeric fields to Decimal128 for proper storage
                    if (stockItem.length !== undefined) {
                        stockItem.length = mongoose.Types.Decimal128.fromString(String(stockItem.length));
                    }
                    if (stockItem.quantity !== undefined) {
                        stockItem.quantity = mongoose.Types.Decimal128.fromString(String(stockItem.quantity));
                    }
                    if (stockItem.lowStockThreshold !== undefined) {
                        stockItem.lowStockThreshold = mongoose.Types.Decimal128.fromString(String(stockItem.lowStockThreshold));
                    }
                    if (stockItem.unitRate !== undefined && stockItem.unitRate !== null && stockItem.unitRate !== '') {
                        const originalValue = stockItem.unitRate;
                        stockItem.unitRate = mongoose.Types.Decimal128.fromString(String(stockItem.unitRate));
                        console.log(`[addMaterial] Converting unitRate: ${originalValue} → ${stockItem.unitRate} (Decimal128: ${stockItem.unitRate instanceof mongoose.Types.Decimal128})`);
                    } else {
                        console.log(`[addMaterial] WARNING: unitRate is undefined, null, or empty for stock item ${index + 1}:`, stockItem.unitRate);
                    }
                    
                    // Calculate and set actualWeight for initial stock entries
                    if (stockItem.gauge && materialData.gaugeSpecificWeights) {
                        const gaugeWeight = materialData.gaugeSpecificWeights.find(gw => gw.gauge === stockItem.gauge);
                        if (gaugeWeight && stockItem.length && stockItem.quantity) {
                            const lengthValue = parseFloat(String(stockItem.length));
                            const quantityValue = parseFloat(String(stockItem.quantity));
                            const weightPerUnitLength = parseFloat(String(gaugeWeight.weightPerUnitLength));
                            
                            if (lengthValue > 0 && quantityValue > 0 && weightPerUnitLength > 0) {
                                const calculatedWeight = lengthValue * quantityValue * weightPerUnitLength;
                                stockItem.actualWeight = mongoose.Types.Decimal128.fromString(String(calculatedWeight));
                                console.log(`[addMaterial] Calculated actualWeight for stock item ${index + 1}: ${quantityValue} pieces × ${lengthValue}ft × ${weightPerUnitLength}kg/ft = ${calculatedWeight}kg`);
                            }
                        }
                    }
                    
                    // Ensure stockItem.unit is correct
                    if (!stockItem.unit) {
                        const matchingStandardLength = materialData.standardLengths?.find(sl => sl.length && stockItem.length && sl.length.toString() === stockItem.length.toString());
                        stockItem.unit = matchingStandardLength ? matchingStandardLength.unit : 'ft';
                    }
                    
                    console.log(`[addMaterial] After conversion for stock item ${index + 1}:`, {
                        after: {
                            length: stockItem.length,
                            quantity: stockItem.quantity,
                            unitRate: stockItem.unitRate,
                            unitRateType: typeof stockItem.unitRate,
                            unitRateIsDecimal128: stockItem.unitRate instanceof mongoose.Types.Decimal128,
                            gauge: stockItem.gauge,
                            actualWeight: stockItem.actualWeight ? stockItem.actualWeight.toString() : undefined
                        }
                    });
                });
            }
            
            // Convert gaugeSpecificWeights numeric fields to Decimal128
            if (materialData.gaugeSpecificWeights) {
                materialData.gaugeSpecificWeights.forEach(gaugeWeight => {
                    if (gaugeWeight.weightPerUnitLength !== undefined) {
                        gaugeWeight.weightPerUnitLength = mongoose.Types.Decimal128.fromString(String(gaugeWeight.weightPerUnitLength));
                    }
                    if (gaugeWeight.unitLength !== undefined && typeof gaugeWeight.unitLength === 'number') {
                        gaugeWeight.unitLength = String(gaugeWeight.unitLength);
                    }
                });
            }
            
            // Convert standardLengths numeric fields to Decimal128
            if (materialData.standardLengths) {
                materialData.standardLengths.forEach(standardLength => {
                    if (standardLength.length !== undefined) {
                        standardLength.length = mongoose.Types.Decimal128.fromString(String(standardLength.length));
                    }
                });
            }
            
            // Clear out fields not relevant to Profile if they were sent
            delete materialData.totalStockQuantity;
            delete materialData.unitRateForStockUnit;
            delete materialData.lowStockThresholdForStockUnit;
        } else {
            // Convert non-profile numeric fields to Decimal128
            if (materialData.totalStockQuantity !== undefined) {
                materialData.totalStockQuantity = mongoose.Types.Decimal128.fromString(String(materialData.totalStockQuantity));
            }
            if (materialData.unitRateForStockUnit !== undefined) {
                materialData.unitRateForStockUnit = mongoose.Types.Decimal128.fromString(String(materialData.unitRateForStockUnit));
            }
            if (materialData.lowStockThresholdForStockUnit !== undefined) {
                materialData.lowStockThresholdForStockUnit = mongoose.Types.Decimal128.fromString(String(materialData.lowStockThresholdForStockUnit));
            }
            
            // For other categories, clear out profile-specific stock fields
            delete materialData.standardLengths;
            delete materialData.stockByLength;
            delete materialData.gaugeSpecificWeights;
            // weightUnit might still be relevant if stockUnit is 'kg' for other items, but typically not.
            // delete materialData.weightUnit; 
        }

        console.log('[addMaterial] Final materialData before save:', {
            name: materialData.name,
            stockByLength: materialData.stockByLength?.map(s => ({
                length: s.length ? s.length.toString() : s.length,
                gauge: s.gauge,
                unitRate: s.unitRate ? s.unitRate.toString() : s.unitRate,
                unitRateType: typeof s.unitRate,
                unitRateIsDecimal128: s.unitRate instanceof mongoose.Types.Decimal128
            }))
        });

        const newMaterial = new MaterialV2(materialData);
        
        console.log('[addMaterial] After creating MaterialV2 instance:', {
            name: newMaterial.name,
            stockByLength: newMaterial.stockByLength?.map(s => ({
                length: s.length ? s.length.toString() : s.length,
                gauge: s.gauge,
                unitRate: s.unitRate ? s.unitRate.toString() : s.unitRate,
                unitRateType: typeof s.unitRate,
                unitRateIsDecimal128: s.unitRate instanceof mongoose.Types.Decimal128
            }))
        });
        
        await newMaterial.save();
        
        console.log('[addMaterial] After save:', {
            name: newMaterial.name,
            stockByLength: newMaterial.stockByLength?.map(s => ({
                length: s.length ? s.length.toString() : s.length,
                gauge: s.gauge,
                unitRate: s.unitRate ? s.unitRate.toString() : s.unitRate,
                unitRateType: typeof s.unitRate,
                unitRateIsDecimal128: s.unitRate instanceof mongoose.Types.Decimal128
            }))
        });
        
        res.status(201).json(newMaterial);
    } catch (error) {
        if (error.code === 11000) {
            return handleError(res, { message: 'MaterialV2 with this name already exists for your company.' }, 400);
        }
        handleError(res, error, 400);
    }
};

// List all materials for the company
exports.listMaterials = async (req, res) => {
    try {
        const { companyId } = req.user;
        const materials = await MaterialV2.find({ companyId }).sort({ name: 1 });

        // Customize response based on category
        const customizedMaterials = materials.map(material => {
            const matObject = material.toObject();
            if (matObject.category === 'Profile') {
                delete matObject.totalStockQuantity;
                delete matObject.unitRateForStockUnit;
                delete matObject.lowStockThresholdForStockUnit;
            } else {
                delete matObject.standardLengths;
                delete matObject.stockByLength;
                delete matObject.gaugeSpecificWeights;
                // delete matObject.weightUnit; // Keep if non-profiles might have it.
            }
            return matObject;
        });
        res.status(200).json(customizedMaterials);
    } catch (error) {
        handleError(res, error);
    }
};

// Get material details
exports.getMaterialDetails = async (req, res) => {
    try {
        const { companyId } = req.user;
        const { materialId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(materialId)) {
            return res.status(400).json({ message: 'Invalid MaterialV2 ID format' });
        }

        const material = await MaterialV2.findOne({ _id: materialId, companyId });
        if (!material) {
            return res.status(404).json({ message: 'MaterialV2 not found' });
        }

        // Customize response based on category
        const matObject = material.toObject();
        if (matObject.category === 'Profile') {
            delete matObject.totalStockQuantity;
            delete matObject.unitRateForStockUnit;
            delete matObject.lowStockThresholdForStockUnit;
        } else {
            delete matObject.standardLengths;
            delete matObject.stockByLength;
            delete matObject.gaugeSpecificWeights;
            // delete matObject.weightUnit;
        }
        res.status(200).json(matObject);
    } catch (error) {
        handleError(res, error);
    }
};

// Update material details
exports.updateMaterial = async (req, res) => {
    try {
        const { companyId, _id: userId } = req.user;
        const { materialId } = req.params;
        let updatePayload = req.body; // Use a mutable copy for request body

        if (!mongoose.Types.ObjectId.isValid(materialId)) {
            return res.status(400).json({ message: 'Invalid MaterialV2 ID format' });
        }

        const materialToUpdate = await MaterialV2.findOne({ _id: materialId, companyId });
        if (!materialToUpdate) {
            return res.status(404).json({ message: 'MaterialV2 not found to update.' });
        }
        
        const category = updatePayload.category || materialToUpdate.category;

        // Directly apply updates from payload to the document instance
        // Fields not in updatePayload will remain untouched on materialToUpdate
        for (const key in updatePayload) {
            if (Object.prototype.hasOwnProperty.call(updatePayload, key)) {
                materialToUpdate[key] = updatePayload[key];
            }
        }

        if (category === 'Profile') {
            if (materialToUpdate.stockByLength) {
                materialToUpdate.stockByLength.forEach(stockItem => {
                    // Convert numeric fields to Decimal128 for proper storage
                    if (stockItem.length !== undefined) {
                        stockItem.length = mongoose.Types.Decimal128.fromString(String(stockItem.length));
                    }
                    if (stockItem.quantity !== undefined) {
                        stockItem.quantity = mongoose.Types.Decimal128.fromString(String(stockItem.quantity));
                    }
                    if (stockItem.lowStockThreshold !== undefined) {
                        stockItem.lowStockThreshold = mongoose.Types.Decimal128.fromString(String(stockItem.lowStockThreshold));
                    }
                    if (stockItem.unitRate !== undefined) {
                        stockItem.unitRate = mongoose.Types.Decimal128.fromString(String(stockItem.unitRate));
                        console.log(`[updateMaterial] Converting unitRate ${stockItem.unitRate} to Decimal128 for stock item`);
                    }
                    
                    // Ensure stockItem.unit is correct, handling 'lengthUnit' if sent
                    if (stockItem.lengthUnit && !stockItem.unit) {
                        stockItem.unit = stockItem.lengthUnit;
                        delete stockItem.lengthUnit; // Clean up temporary field
                    }
                    // Fallback if unit is still missing (e.g. from older data or incomplete payload)
                    if (!stockItem.unit) {
                        const matchingStandardLength = materialToUpdate.standardLengths.find(
                            sl => sl.length && stockItem.length && sl.length.toString() === stockItem.length.toString()
                        );
                        stockItem.unit = matchingStandardLength ? matchingStandardLength.unit : 'ft';
                    }
                });
            }
            
            // Convert gaugeSpecificWeights numeric fields to Decimal128
            if (materialToUpdate.gaugeSpecificWeights) {
                materialToUpdate.gaugeSpecificWeights.forEach(gaugeWeight => {
                    if (gaugeWeight.weightPerUnitLength !== undefined) {
                        gaugeWeight.weightPerUnitLength = mongoose.Types.Decimal128.fromString(String(gaugeWeight.weightPerUnitLength));
                    }
                    if (gaugeWeight.unitLength !== undefined && typeof gaugeWeight.unitLength === 'number') {
                        gaugeWeight.unitLength = String(gaugeWeight.unitLength);
                    }
                });
            }
            
            // Convert standardLengths numeric fields to Decimal128
            if (materialToUpdate.standardLengths) {
                materialToUpdate.standardLengths.forEach(standardLength => {
                    if (standardLength.length !== undefined) {
                        standardLength.length = mongoose.Types.Decimal128.fromString(String(standardLength.length));
                    }
                });
            }

            // Explicitly remove current calculated values from the instance 
            // so pre-save hook recalculates them based on (potentially) modified inputs.
            // Using delete ensures they are undefined on the instance before save.
            delete materialToUpdate.totalStockQuantity;
            delete materialToUpdate.unitRateForStockUnit;
            delete materialToUpdate.lowStockThresholdForStockUnit;
            
            // Mark paths as modified if they were in payload, to help pre-save hook if needed,
            // though direct update to instance fields should make them appear modified anyway.
            if (updatePayload.stockByLength) materialToUpdate.markModified('stockByLength');
            if (updatePayload.gaugeSpecificWeights) materialToUpdate.markModified('gaugeSpecificWeights');

        } else { // For other categories, ensure profile-specific fields are cleared if category changes
            // Convert non-profile numeric fields to Decimal128
            if (materialToUpdate.totalStockQuantity !== undefined) {
                materialToUpdate.totalStockQuantity = mongoose.Types.Decimal128.fromString(String(materialToUpdate.totalStockQuantity));
            }
            if (materialToUpdate.unitRateForStockUnit !== undefined) {
                materialToUpdate.unitRateForStockUnit = mongoose.Types.Decimal128.fromString(String(materialToUpdate.unitRateForStockUnit));
            }
            if (materialToUpdate.lowStockThresholdForStockUnit !== undefined) {
                materialToUpdate.lowStockThresholdForStockUnit = mongoose.Types.Decimal128.fromString(String(materialToUpdate.lowStockThresholdForStockUnit));
            }
            
            if (materialToUpdate.isModified('category')) {
                delete materialToUpdate.standardLengths;
                delete materialToUpdate.stockByLength;
                delete materialToUpdate.gaugeSpecificWeights;
                // delete materialToUpdate.weightUnit; // Decide if this should be cleared
            }
        }

        materialToUpdate.updatedBy = userId;
        
        const savedMaterial = await materialToUpdate.save();
        res.status(200).json(savedMaterial);

    } catch (error) {
         if (error.code === 11000) {
            return handleError(res, { message: 'Another material with this name already exists for your company.' }, 400);
        }
        handleError(res, error, 400);
    }
};

// Delete a material (hard delete)
exports.deleteMaterial = async (req, res) => {
    try {
        const { companyId } = req.user;
        const { materialId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(materialId)) {
            return res.status(400).json({ message: 'Invalid MaterialV2 ID format' });
        }

        // Check if the material is used in any ProductType
        const productUsingMaterial = await ProductType.findOne({
            companyId,
            'materials.materialId': materialId
        });

        if (productUsingMaterial) {
            return res.status(400).json({ message: 'This inventory item is used in one or more product types. Please remove it from all associated products before deletion.' });
        }

        // Perform hard delete
        const material = await MaterialV2.findOneAndDelete(
            { _id: materialId, companyId }
        );

        if (!material) {
            return res.status(404).json({ message: 'MaterialV2 not found or you do not have permission to delete it.' });
        }

        // Handle related references: Delete StockTransactions for this materialId
        try {
            const deleteTransactionsResult = await StockTransaction.deleteMany(
                { materialId: material._id, companyId: companyId }
            );
            console.log(`Deleted ${deleteTransactionsResult.deletedCount} stock transactions for material ${material._id}`);
        } catch (transactionError) {
            // Log the error but don't let it fail the material deletion itself
            // Alternatively, you might want to make this transactional or re-throw
            console.error(`Error deleting stock transactions for material ${material._id}:`, transactionError);
            // Potentially return a partial success or a warning to the client here
        }

        // TODO: Further handling for references in Products if necessary

        res.status(200).json({ message: 'MaterialV2 deleted successfully', deletedMaterialId: material._id });
    } catch (error) {
        handleError(res, error);
    }
};

// NEW: Profile Stock Inward
exports.profileStockInward = async (req, res) => {
    try {
        const { companyId, _id: userId } = req.user;
        const data = req.body;

        // Validate required fields for profile stock inward
        const { materialId, name, gauge, standardLength, pieces, totalWeight, totalCost, stockUnit, usageUnit, weightUnit } = data;
        
        if (!materialId && !name) {
             throw new Error('Either materialId or name (for new material) must be provided.');
        }
        if (!gauge || !standardLength || !standardLength.length || !standardLength.unit || pieces === undefined || !totalWeight || totalWeight.weight === undefined || !totalWeight.unit || totalCost === undefined ) {
            throw new Error('Missing required fields for profile stock inward (gauge, standardLength object, pieces, totalWeight object, totalCost).');
        }
        if (!materialId && (!stockUnit || !usageUnit || !weightUnit)) { // Required if new material
             throw new Error('stockUnit, usageUnit, and weightUnit are required for a new profile material.');
        }

        // Pass undefined for session if not using transactions
        const result = await inventoryService.recordProfileStockInward(companyId, userId, data /*, { session: undefined }*/);
        
        res.status(201).json({ message: 'Profile stock inward recorded successfully', ...result });
    } catch (error) {
        handleError(res, error, 400); // Bad request for validation or operational errors
    }
};

// UPDATED: Adjust stock (generic for all categories)
exports.adjustStock = async (req, res) => {
    try {
        const { companyId, _id: userId } = req.user;
        const { 
            materialId, 
            quantityChange, 
            notes, 
            type, 
            relatedDocumentId, 
            relatedDocumentType,
            length,
            lengthUnit,
            quantityUnit
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(materialId)) {
            return res.status(400).json({ message: 'Invalid MaterialV2 ID format' });
        }
        if (quantityChange === undefined || !type) {
            return res.status(400).json({ message: 'quantityChange and type are required for stock adjustment.' });
        }
        
        const material = await MaterialV2.findOne({ _id: materialId, companyId });
        if (!material) {
            return res.status(404).json({ message: 'MaterialV2 not found' });
        }

        let finalQuantityUnit = quantityUnit;
        let transactionLength = length ? mongoose.Types.Decimal128.fromString(String(length)) : undefined;
        let transactionLengthUnit = lengthUnit;
        let unitRateAtTransaction;

        const quantityChange_Decimal = new Decimal(String(quantityChange));

        if (material.category === 'Profile') {
            if (length !== undefined && lengthUnit !== undefined && String(length).trim() !== '') { // Adjusting specific length of profile
                const stockItem = material.stockByLength.find(
                    item => item.length.toString() === String(length) && item.unit === lengthUnit
                );
                if (!stockItem) {
                    throw new Error(`Stock for length ${length} ${lengthUnit} not defined for this profile material.`);
                }
                
                const currentItemQuantity_Decimal = new Decimal(stockItem.quantity.toString() || "0");
                let newItemQuantity_Decimal;

                if (type === 'Inward' || type === 'Inward-Manual') {
                    newItemQuantity_Decimal = currentItemQuantity_Decimal.plus(quantityChange_Decimal);
                } else if (type === 'Outward-Manual' || type === 'Scrap') {
                    newItemQuantity_Decimal = currentItemQuantity_Decimal.minus(quantityChange_Decimal);
                } else if (type === 'Correction') {
                    // Assuming quantityChange_Decimal for Correction is the signed amount of adjustment
                    // If form sends positive for increase, negative for decrease.
                    // If form always sends positive for Correction, this needs specific business rule.
                    newItemQuantity_Decimal = currentItemQuantity_Decimal.plus(quantityChange_Decimal);
                } else {
                    throw new Error(`Unsupported adjustment type: ${type}`);
                }

                if (newItemQuantity_Decimal.isNegative()) {
                    throw new Error('Stock quantity for this length cannot go below zero.');
                }
                stockItem.quantity = mongoose.Types.Decimal128.fromString(newItemQuantity_Decimal.toString());
                finalQuantityUnit = 'pcs'; 
                unitRateAtTransaction = stockItem.unitRate;
            } else { // Adjusting total/bulk quantity of a profile
                if (!finalQuantityUnit || finalQuantityUnit === 'pcs') {
                    throw new Error(`For bulk adjustment of Profile material, quantityUnit (e.g., material.stockUnit like 'kg') must be specified and cannot be 'pcs'.`);
                }
                const currentTotalStock_Decimal = new Decimal(material.totalStockQuantity ? material.totalStockQuantity.toString() : "0");
                let newTotalStock_Decimal;

                if (type === 'Inward' || type === 'Inward-Manual') {
                    newTotalStock_Decimal = currentTotalStock_Decimal.plus(quantityChange_Decimal);
                } else if (type === 'Outward-Manual' || type === 'Scrap') {
                    newTotalStock_Decimal = currentTotalStock_Decimal.minus(quantityChange_Decimal);
                } else if (type === 'Correction') {
                    newTotalStock_Decimal = currentTotalStock_Decimal.plus(quantityChange_Decimal);
                } else {
                    throw new Error(`Unsupported adjustment type: ${type}`);
                }

                if (newTotalStock_Decimal.isNegative()) {
                   throw new Error('Total stock quantity for this profile cannot go below zero.');
                }
                material.totalStockQuantity = mongoose.Types.Decimal128.fromString(newTotalStock_Decimal.toString());
                unitRateAtTransaction = material.unitRateForStockUnit; 
                transactionLength = undefined;
                transactionLengthUnit = undefined;
            }
        } else { // For Non-Profile categories
            const currentTotalStock_Decimal = new Decimal(material.totalStockQuantity ? material.totalStockQuantity.toString() : "0");
            let newTotalStock_Decimal;

            if (type === 'Inward' || type === 'Inward-Manual') {
                newTotalStock_Decimal = currentTotalStock_Decimal.plus(quantityChange_Decimal);
            } else if (type === 'Outward-Manual' || type === 'Scrap') {
                newTotalStock_Decimal = currentTotalStock_Decimal.minus(quantityChange_Decimal);
            } else if (type === 'Correction') {
                newTotalStock_Decimal = currentTotalStock_Decimal.plus(quantityChange_Decimal);
            } else {
                throw new Error(`Unsupported adjustment type: ${type}`);
            }

            if (newTotalStock_Decimal.isNegative()) {
                 throw new Error('Total stock quantity cannot go below zero.');
            }
            material.totalStockQuantity = mongoose.Types.Decimal128.fromString(newTotalStock_Decimal.toString());
            finalQuantityUnit = quantityUnit || material.stockUnit;
            unitRateAtTransaction = material.unitRateForStockUnit;
            transactionLength = undefined; 
            transactionLengthUnit = undefined;
        }
        
        material.updatedBy = userId;
        await material.save();

        const stockTxData = {
            companyId,
            materialId: material._id,
            type,
            quantityChange: mongoose.Types.Decimal128.fromString(quantityChange_Decimal.toString()),
            quantityUnit: finalQuantityUnit, 
            notes,
            relatedDocumentId: relatedDocumentId ? mongoose.Types.ObjectId(relatedDocumentId) : undefined,
            relatedDocumentType,
            createdBy: userId,
            transactionDate: new Date(),
            unitRateAtTransaction, 
        };
        if (transactionLength && transactionLengthUnit) {
            stockTxData.length = transactionLength;
            stockTxData.lengthUnit = transactionLengthUnit;
        }

        const transaction = new StockTransaction(stockTxData);
        await transaction.save();

        res.status(200).json({ message: 'Stock adjusted successfully', material: material.toObject(), transaction: transaction.toObject() });
    } catch (error) {
        let statusCode = 500;
        if (error.message.includes('not defined for this material') || 
            error.message.includes('cannot go below zero') || 
            error.message.includes('must be specified')) {
            statusCode = 400;
        }
        handleError(res, error, statusCode);
    }
};

// Get stock transaction history for a material
exports.getStockHistory = async (req, res) => {
    try {
        const { companyId } = req.user;
        const { materialId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(materialId)) {
            return res.status(400).json({ message: 'Invalid MaterialV2 ID format' });
        }

        // Ensure all relevant fields are returned, including length/lengthUnit for profiles
        const transactions = await StockTransaction.find({ companyId, materialId })
            .sort({ transactionDate: -1 })
            .populate('createdBy', 'firstName lastName email'); 
            
        res.status(200).json(transactions.map(t => t.toObject())); // Ensure Decimal128 is converted
    } catch (error) {
        handleError(res, error);
    }
}; 

// NEW: Glass Materials API
/**
 * Get filtered glass category materials for glass type selection
 * GET /api/inventory/materials/glass
 */
exports.getGlassMaterials = async (req, res) => {
    try {
        const { companyId } = req.user;
        
        // Filter for active Glass category materials only
        const glassMaterials = await MaterialV2.find({ 
            companyId,
            category: 'Glass',
            isActive: true
        }).select('name _id unitRateForStockUnit stockUnit totalStockQuantity usageUnit category isActive')
          .sort({ name: 1 });

        // Transform response to include relevant fields for glass selection
        const transformedMaterials = glassMaterials.map(material => ({
            _id: material._id,
            name: material.name,
            unitRateForStockUnit: material.unitRateForStockUnit ? material.unitRateForStockUnit.toString() : '0.00',
            stockUnit: material.stockUnit,
            usageUnit: material.usageUnit,
            totalStockQuantity: material.totalStockQuantity ? material.totalStockQuantity.toString() : '0.00',
            category: material.category,
            isActive: material.isActive
        }));

        res.status(200).json({
            status: 'success',
            count: transformedMaterials.length,
            data: transformedMaterials
        });

    } catch (error) {
        console.error('Error in getGlassMaterials:', error);
        handleError(res, error);
    }
}; 

// Add a utility endpoint to recalculate material rates (for debugging/fixing existing data)
exports.recalculateMaterialRates = catchAsync(async (req, res) => {
    const { materialId } = req.params;
    const companyId = req.user.companyId;
    
    const material = await MaterialV2.findOne({ _id: materialId, companyId });
    if (!material) {
        throw new AppError('MaterialV2 not found', 404);
    }
    
    console.log('=== BEFORE RECALCULATION ===');
    console.log(`MaterialV2: ${material.name}`);
    console.log(`unitRateForStockUnit: ${material.unitRateForStockUnit}`);
    console.log(`totalStockQuantity: ${material.totalStockQuantity}`);
    
    // Trigger recalculation by marking as modified and saving
    material.markModified('stockByLength');
    material.markModified('gaugeSpecificWeights');
    await material.save();
    
    console.log('=== AFTER RECALCULATION ===');
    console.log(`unitRateForStockUnit: ${material.unitRateForStockUnit}`);
    console.log(`totalStockQuantity: ${material.totalStockQuantity}`);
    
    res.json({
        message: 'MaterialV2 rates recalculated successfully',
        material: {
            _id: material._id,
            name: material.name,
            unitRateForStockUnit: material.unitRateForStockUnit,
            totalStockQuantity: material.totalStockQuantity,
            lowStockThresholdForStockUnit: material.lowStockThresholdForStockUnit
        }
    });
}); 

// Add an endpoint to fix mixed gauge data (specific to the current issue)
exports.fixMixedGaugeData = catchAsync(async (req, res) => {
    const { materialId } = req.params;
    const companyId = req.user.companyId;
    
    const material = await MaterialV2.findOne({ _id: materialId, companyId });
    if (!material) {
        throw new AppError('MaterialV2 not found', 404);
    }
    
    console.log('=== BEFORE GAUGE DATA FIX ===');
    console.log('Current stockByLength:', material.stockByLength.map(s => ({
        length: s.length.toString(),
        quantity: s.quantity.toString(),
        unitRate: s.unitRate.toString()
    })));
    console.log('Current gaugeSpecificWeights:', material.gaugeSpecificWeights.map(g => ({
        gauge: g.gauge,
        weightPerUnitLength: g.weightPerUnitLength.toString()
    })));
    
    // Based on your description:
    // - First inward: 15ft, 20G, 3kg at ₹330/kg = ₹990 (1 pipe)
    // - Second inward: 15ft, 18G, 4.5kg at ₹330/kg = ₹1485 (1 pipe)
    
    // Fix the gauge weights
    const gauge20G = material.gaugeSpecificWeights.find(g => g.gauge === '20G');
    const gauge18G = material.gaugeSpecificWeights.find(g => g.gauge === '18G');
    
    if (gauge20G) {
        // 20G: 3kg / 15ft = 0.2 kg/ft ✅ (this is correct)
        gauge20G.weightPerUnitLength = mongoose.Types.Decimal128.fromString('0.2');
    }
    
    if (gauge18G) {
        // 18G: 4.5kg / 15ft = 0.3 kg/ft (not 0.15!)
        gauge18G.weightPerUnitLength = mongoose.Types.Decimal128.fromString('0.3');
    }
    
    // Fix the stock data - we can't separate them in current model, 
    // but we can at least calculate correct totals
    const stock15ft = material.stockByLength.find(s => 
        s.length.toString() === '15' && s.unit === 'ft'
    );
    
    if (stock15ft) {
        // Keep quantity as 2 (1 pipe 20G + 1 pipe 18G)
        stock15ft.quantity = mongoose.Types.Decimal128.fromString('2');
        
        // Calculate weighted average rate: (990 + 1485) / 2 = 1237.5
        // This is the only way in current model
        stock15ft.unitRate = mongoose.Types.Decimal128.fromString('1237.5');
    }
    
    // Fix total calculations
    // Total weight: 3kg (20G) + 4.5kg (18G) = 7.5kg
    material.totalStockQuantity = mongoose.Types.Decimal128.fromString('7.5');
    
    // Average rate per kg: (990 + 1485) / 7.5 = ₹330/kg
    material.unitRateForStockUnit = mongoose.Types.Decimal128.fromString('330');
    
    await material.save();
    
    console.log('=== AFTER GAUGE DATA FIX ===');
    console.log('Fixed stockByLength:', material.stockByLength.map(s => ({
        length: s.length.toString(),
        quantity: s.quantity.toString(),
        unitRate: s.unitRate.toString()
    })));
    console.log('Fixed gaugeSpecificWeights:', material.gaugeSpecificWeights.map(g => ({
        gauge: g.gauge,
        weightPerUnitLength: g.weightPerUnitLength.toString()
    })));
    console.log('Fixed totals:', {
        totalStockQuantity: material.totalStockQuantity.toString(),
        unitRateForStockUnit: material.unitRateForStockUnit.toString()
    });
    
    res.json({
        message: 'Mixed gauge data fixed successfully',
        material: {
            _id: material._id,
            name: material.name,
            gaugeSpecificWeights: material.gaugeSpecificWeights.map(g => ({
                gauge: g.gauge,
                weightPerUnitLength: g.weightPerUnitLength.toString()
            })),
            stockByLength: material.stockByLength.map(s => ({
                length: s.length.toString(),
                quantity: s.quantity.toString(),
                unitRate: s.unitRate.toString()
            })),
            totalStockQuantity: material.totalStockQuantity.toString(),
            unitRateForStockUnit: material.unitRateForStockUnit.toString()
        }
    });
}); 