const mongoose = require('mongoose');
const Order = require('../models/Order');
const Quotation = require('../models/Quotation');
const ProductType = require('../models/ProductType');
const AppError = require('../utils/appError');
const unitConverter = require('../utils/unitConverter');const MaterialV2 = require('../models/MaterialV2');
 // For unit conversions
const formulaEvaluator = require('../utils/formulaEvaluator'); // For formula evaluation
// Import the profile cutting utility
const { calculateProfileConsumption, ProfileCuttingError, SCRAP_THRESHOLD_FT } = require('../utils/profileCuttingUtil');
// Import Wire Mesh optimization service
const WireMeshOptimizationService = require('./wireMeshOptimizationService');

// Helper utility to robustly convert values to Mongoose Decimal128
// (Similar to the one in estimationService, ensure it's consistent)
const toDecimal128 = (value, defaultValue = '0.00') => {
    if (value === null || value === undefined) {
        return mongoose.Types.Decimal128.fromString(defaultValue);
    }
    if (value instanceof mongoose.Types.Decimal128) {
        return value;
    }
    if (typeof value === 'number') {
        // Use toFixed to ensure correct decimal representation from number
        // Default to 2 decimal places, but allow more for weights, etc.
        const numStr = value.toString();
        const decimalPlaces = (numStr.split('.')[1] || '').length;
        return mongoose.Types.Decimal128.fromString(value.toFixed(Math.max(2, decimalPlaces)));
    }
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        if (isNaN(parsed)) {
            return mongoose.Types.Decimal128.fromString(defaultValue);
        }
        const numStr = parsed.toString();
        const decimalPlaces = (numStr.split('.')[1] || '').length;
        return mongoose.Types.Decimal128.fromString(parsed.toFixed(Math.max(2, decimalPlaces)));
    }
    if (typeof value === 'object' && value.$numberDecimal !== undefined) {
         const parsed = parseFloat(value.$numberDecimal);
         if (isNaN(parsed)) {
            return mongoose.Types.Decimal128.fromString(defaultValue);
        }
        const numStr = parsed.toString();
        const decimalPlaces = (numStr.split('.')[1] || '').length;
        return mongoose.Types.Decimal128.fromString(parsed.toFixed(Math.max(2, decimalPlaces)));
    }
    console.warn(`[toDecimal128 in OrderService] Unexpected value type: ${typeof value}, value: ${JSON.stringify(value)}. Defaulting.`);
    return mongoose.Types.Decimal128.fromString(defaultValue);
};

class OrderService {
    // Helper function to find material in both V2 and V1 systems
    async findMaterialById(materialId, companyId) {
        try {
            // First try to find in V2 system
            const materialV2 = await MaterialV2.findOne({ 
                _id: materialId, 
                companyId: companyId 
            });
            
            if (materialV2) {
                // Convert V2 material to V1-like structure for backward compatibility
                return {
                    _id: materialV2._id,
                    name: materialV2.name,
                    category: materialV2.category,
                    stockUnit: materialV2.stockUnit,
                    usageUnit: materialV2.usageUnit,
                    unitRateForStockUnit: materialV2.aggregatedTotals?.averageRatePerPiece || '0',
                    supplier: materialV2.supplier,
                    brand: materialV2.brand,
                    isActive: true, // V2 only contains active materials
                    isV2: true, // Flag to identify V2 materials
                    companyId: materialV2.companyId, // Needed for cutting util validation
                    
                    // CRITICAL: Copy profile-specific fields for cutting optimization
                    standardLengths: materialV2.standardLengths || [], // Standard pipe lengths
                    gaugeSpecificWeights: materialV2.referenceGaugeWeights?.map(refGauge => ({
                        gauge: refGauge.gauge,
                        weightPerUnitLength: refGauge.referenceWeight, // Map referenceWeight to weightPerUnitLength
                        unitLength: refGauge.unitLength
                    })) || [], // Map referenceGaugeWeights to gaugeSpecificWeights
                    weightUnit: materialV2.weightUnit || 'kg', // Default weight unit
                    defaultGauge: materialV2.defaultGauge || null, // Default gauge if any
                    
                    // Additional fields that might be needed for order processing
                    purchaseUnit: materialV2.stockUnit, // Use stockUnit as purchaseUnit
                    unitRate: materialV2.aggregatedTotals?.averageRatePerPiece || '0', // Fallback rate
                    
                    // Stock tracking fields that might be needed
                    stockByLength: (() => {
                        const consolidatedStock = {};
                        (materialV2.profileBatches || []).forEach(batch => {
                            const lengthKey = `${batch.length.toString()}_${batch.lengthUnit}`;
                            if (!consolidatedStock[lengthKey]) {
                                consolidatedStock[lengthKey] = {
                                    length: batch.length,
                                    unit: batch.lengthUnit,
                                    quantity: toDecimal128('0')
                                };
                            }
                            // Add the current batch quantity to the consolidated total
                            const currentQty = parseFloat(consolidatedStock[lengthKey].quantity.toString());
                            const batchQty = parseFloat(batch.currentQuantity.toString());
                            consolidatedStock[lengthKey].quantity = toDecimal128((currentQty + batchQty).toString());
                        });
                        return Object.values(consolidatedStock);
                    })(), // Map profile batches to consolidated stock by length
                    totalStockQuantity: materialV2.aggregatedTotals?.totalCurrentStock || '0',
                    
                    // CRITICAL: Copy simpleBatches for Wire Mesh stock calculations
                    simpleBatches: materialV2.simpleBatches || [] // Wire Mesh batch tracking
                };
            }
            
            // If not found in V2, try V1 system
            const materialV1 = await MaterialV2.findOne({ 
                _id: materialId, 
                companyId: companyId 
            });
            
            return materialV1;
            
        } catch (error) {
            console.error(`[OrderService] Error finding material ${materialId}:`, error);
            throw new AppError(`Failed to find material: ${error.message}`, 500);
        }
    }

    /**
     * Prepares the initial order data from an accepted quotation.
     * @param {Object} quotation - The Mongoose Quotation document.
     * @param {String} companyId - The ID of the company.
     * @param {String} userId - The ID of the user creating the order.
     * @param {String} orderIdDisplay - The display ID for the new order.
     * @returns {Object} The prepared order data object.
     */
    async prepareOrderDataFromQuotation(quotation, companyId, userId, orderIdDisplay) {
        const orderItems = [];
        const aggregatedRawProfileCutsFt = {}; // { materialId: { materialDoc, gaugeSnapshot, cuts: [] } }
        const processedNonProfileMaterials = {}; // { materialId: { materialDoc, totalQuantityDecimal, totalWeightDecimal, usageUnit, gaugeSnapshot } }

        for (const qItem of quotation.items) {
            let productType = qItem.productTypeId; 
            if (!productType || !productType.materials) { 
                 productType = await ProductType.findById(qItem.productTypeId._id || qItem.productTypeId).lean(); 
            }
            if (!productType) {
                throw new AppError(`ProductType not found for item: ${qItem.productTypeNameSnapshot}`, 404);
            }

            const materialDetailsForItem = await this.calculateOrderMaterialDetails(
                productType,
                qItem.width, 
                qItem.height, 
                qItem.quantity, 
                quotation.dimensionUnit, 
                companyId,
                quotation.gauge 
            );

            const itemRequiredMaterialCuts = []; // To store requiredMaterialCuts for the current qItem

            for (const matDetail of materialDetailsForItem) {
                const materialIdStr = matDetail.materialId.toString();
                const materialDoc = matDetail.materialDoc || await this.findMaterialById(matDetail.materialId, companyId);
                if (!materialDoc) {
                    console.warn(`[prepareOrderData] MaterialV2 ${materialIdStr} not found during item processing. Skipping.`);
                    continue;
                }

                console.log(`[OrderService Debug - prepareOrderData] Processing MaterialV2: ${materialDoc.name} (ID: ${materialIdStr}), Category: "${materialDoc.category}", CalcValues Count: ${matDetail.calculatedValues ? matDetail.calculatedValues.length : 0}`);

                if (materialDoc.category === 'Profile') {
                    let displayCutLengths = matDetail.calculatedValues; // These are Decimal128, originally in matDetail.usageUnit
                    let displayLengthUnit = matDetail.usageUnit;

                    const targetDisplayUnitForCuts = (quotation.dimensionUnit === 'mm') ? 'mm' : 'inches';

                    if (displayLengthUnit.toLowerCase() !== targetDisplayUnitForCuts.toLowerCase()) {
                        displayCutLengths = matDetail.calculatedValues.map(cutValDecimal => {
                            const conversion = unitConverter.convertUnit(
                                parseFloat(cutValDecimal.toString()),
                                displayLengthUnit, // Original unit
                                targetDisplayUnitForCuts // Target display unit
                            );
                            if (conversion.error) {
                                console.error(`[prepareOrderData] Profile raw cut conversion error: ${conversion.error} (From ${displayLengthUnit} to ${targetDisplayUnitForCuts}, Value: ${cutValDecimal.toString()})`);
                                throw new AppError(`Error converting profile raw cut for display: ${conversion.error}. Please check material setup and formulas.`, 500);
                            }
                            if (conversion.result === null || isNaN(conversion.result)) {
                                console.error(`[prepareOrderData] Profile raw cut conversion resulted in null/NaN (From ${displayLengthUnit} to ${targetDisplayUnitForCuts}, Value: ${cutValDecimal.toString()})`);
                                throw new AppError(`Profile raw cut conversion resulted in invalid value. Please check material setup and formulas.`, 500);
                            }
                            return toDecimal128(conversion.result.toString());
                        });
                        displayLengthUnit = targetDisplayUnitForCuts;
                    }

                    itemRequiredMaterialCuts.push({
                        materialId: matDetail.materialId,
                        materialNameSnapshot: matDetail.materialNameSnapshot,
                        gaugeSnapshot: matDetail.gaugeSnapshot,
                        cutLengths: displayCutLengths, 
                        lengthUnit: displayLengthUnit, 
                        isCutRequired: true,
                        pipeBreakdown: [], 
                        totalQuantity: toDecimal128(displayCutLengths.length.toString()), 
                        quantityUnit: 'cuts',
                        totalWeight: toDecimal128('0'), 
                        weightUnit: materialDoc.weightUnit || 'kg'
                    });

                    // Aggregate for global optimization (aggregatedRawProfileCutsFt)
                    if (!aggregatedRawProfileCutsFt[materialIdStr]) {
                        aggregatedRawProfileCutsFt[materialIdStr] = {
                            materialDoc: materialDoc,
                            gaugeSnapshot: matDetail.gaugeSnapshot,
                            cuts: [],
                            materialNameSnapshot: materialDoc.name,
                            usageUnit: materialDoc.usageUnit,
                            weightUnit: materialDoc.weightUnit || 'kg'
                        };
                    }
                    aggregatedRawProfileCutsFt[materialIdStr].cuts.push(...matDetail.rawCutsFt);
                } else { // Non-Profile MaterialV2
                    itemRequiredMaterialCuts.push({
                        materialId: matDetail.materialId,
                        materialNameSnapshot: matDetail.materialNameSnapshot,
                        gaugeSnapshot: matDetail.gaugeSnapshot,
                        cutLengths: [], // Non-profiles don't have linear cuts for display here
                        lengthUnit: matDetail.usageUnit, // Unit of the total quantity
                        isCutRequired: false,
                        pipeBreakdown: [],
                        totalQuantity: matDetail.totalQuantity, // Already calculated in calculateOrderMaterialDetails
                        quantityUnit: matDetail.quantityUnit,   // From calculateOrderMaterialDetails
                        totalWeight: matDetail.totalWeight,     // From calculateOrderMaterialDetails
                        weightUnit: matDetail.weightUnit
                    });

                    // Aggregate non-profile materials for `processedNonProfileMaterials`
                    if (!processedNonProfileMaterials[materialIdStr]) {
                        processedNonProfileMaterials[materialIdStr] = {
                            materialDoc: materialDoc,
                            materialId: matDetail.materialId,
                            materialNameSnapshot: matDetail.materialNameSnapshot,
                            materialCategory: matDetail.materialCategory,
                            gaugeSnapshot: matDetail.gaugeSnapshot,
                            totalQuantityDecimal: toDecimal128('0'),
                            totalWeightDecimal: toDecimal128('0', '0.000'),
                            usageUnit: matDetail.usageUnit,
                            quantityUnit: matDetail.quantityUnit,
                            weightUnit: matDetail.weightUnit,
                            // Store individual wire mesh items instead of aggregating dimensions
                            wireMeshItems: matDetail.wireMeshDimensions ? [{
                                width: matDetail.wireMeshDimensions.width,
                                height: matDetail.wireMeshDimensions.height,
                                unit: matDetail.wireMeshDimensions.unit,
                                quantity: matDetail.wireMeshDimensions.quantity,
                                optimization: matDetail.wireMeshDimensions.optimization || null
                            }] : []
                        };
                        console.log(`[Wire Mesh Debug Aggregation] Creating new entry for ${matDetail.materialNameSnapshot}, wireMeshItems: ${JSON.stringify(processedNonProfileMaterials[materialIdStr].wireMeshItems)}`);
                    } else {
                        // Add individual wire mesh item instead of combining dimensions
                        if (matDetail.wireMeshDimensions) {
                            processedNonProfileMaterials[materialIdStr].wireMeshItems.push({
                                width: matDetail.wireMeshDimensions.width,
                                height: matDetail.wireMeshDimensions.height,
                                unit: matDetail.wireMeshDimensions.unit,
                                quantity: matDetail.wireMeshDimensions.quantity,
                                optimization: matDetail.wireMeshDimensions.optimization || null
                            });
                            console.log(`[Wire Mesh Debug Aggregation] Added wire mesh item to existing entry: ${JSON.stringify(matDetail.wireMeshDimensions)}`);
                        }
                    }
                    const currentTotalQuantity = parseFloat(processedNonProfileMaterials[materialIdStr].totalQuantityDecimal.toString());
                    const itemAggQuantity = parseFloat(matDetail.totalQuantity.toString());
                    processedNonProfileMaterials[materialIdStr].totalQuantityDecimal = toDecimal128((currentTotalQuantity + itemAggQuantity).toFixed(4));
                    
                    const currentTotalWeight = parseFloat(processedNonProfileMaterials[materialIdStr].totalWeightDecimal.toString());
                    const itemAggWeight = parseFloat(matDetail.totalWeight.toString());
                    processedNonProfileMaterials[materialIdStr].totalWeightDecimal = toDecimal128((currentTotalWeight + itemAggWeight).toFixed(3), '0.000');
                    
                    // Wire mesh items are now stored individually, no need for accumulation
                }
            }
            
            orderItems.push({
                productTypeId: productType._id,
                productTypeNameSnapshot: qItem.productTypeNameSnapshot,
                originalWidth: qItem.width,
                finalWidth: qItem.width, 
                originalHeight: qItem.height,
                finalHeight: qItem.height, 
                originalQuantity: qItem.quantity,
                finalQuantity: qItem.quantity, 
                itemLabel: qItem.itemLabel,
                
                // NEW: Carry forward glass and frame information from quotation
                selectedGlassTypeId: qItem.selectedGlassTypeId,
                selectedGlassTypeNameSnapshot: qItem.selectedGlassTypeNameSnapshot,
                frameColour: qItem.frameColour || "",
                
                finalChargeableAreaPerItem: qItem.chargeableAreaPerItem, 
                finalTotalChargeableArea: qItem.totalChargeableArea, 
                pricePerAreaUnit: qItem.pricePerAreaUnit,
                finalItemSubtotal: qItem.itemSubtotal,
                requiredMaterialCuts: itemRequiredMaterialCuts // Populate with item-specific raw data
            });
        } // End loop over quotation.items

        // Now, process aggregated profile materials for global optimization
        const finalAggregatedOrderMaterials = [];

        for (const materialIdStr in aggregatedRawProfileCutsFt) {
            const profileData = aggregatedRawProfileCutsFt[materialIdStr];
            const material = profileData.materialDoc;
            const allCutsInFt = profileData.cuts;
            let consumptionResult = { pipesTakenPerStandardLength: [], totalPipesFromStock: 0, totalScrapLength: 0 };

            if (allCutsInFt.length > 0) {
                try {
                    consumptionResult = await calculateProfileConsumption(
                        material, 
                        companyId.toString(),
                        allCutsInFt,
                        SCRAP_THRESHOLD_FT
                    );
                } catch (error) {
                    console.error(`Error in global calculateProfileConsumption for order material ${material.name} (ID: ${materialIdStr}):`, error);
                    throw new AppError(`Cutting planning error for ${material.name}: ${error.message}`, error instanceof ProfileCuttingError ? 400 : 500);
                }
            }
            
            let totalWeightForProfile = 0;
            let weightUnitForProfile = material.weightUnit || 'kg';
            let weightCalcPossible = true;
            let determinedWeightPerFoot = 0;
            const gaugeToUseForWeight = quotation.gauge || profileData.gaugeSnapshot; 

            if (gaugeToUseForWeight && material.gaugeSpecificWeights && material.gaugeSpecificWeights.length > 0) {
                const gaugeWeight = material.gaugeSpecificWeights.find(gw => gw.gauge && gw.gauge.toString() === gaugeToUseForWeight.toString());
                if (gaugeWeight && gaugeWeight.weightPerUnitLength != null) {
                    determinedWeightPerFoot = parseFloat(gaugeWeight.weightPerUnitLength.toString());
                }
            }
            if (determinedWeightPerFoot === 0 && material.weightPerUnitLength != null) { 
                determinedWeightPerFoot = parseFloat(material.weightPerUnitLength.toString());
            }
            if (isNaN(determinedWeightPerFoot) || determinedWeightPerFoot <= 0) {
                weightCalcPossible = false;
            } else {
                const weightPerInch = determinedWeightPerFoot / 12.0;
                (consumptionResult.pipesTakenPerStandardLength || []).forEach(pipeInfo => {
                    totalWeightForProfile += (pipeInfo.count || 0) * (pipeInfo.lengthInInches || 0) * weightPerInch;
                });
            }

            finalAggregatedOrderMaterials.push({
                materialId: material._id,
                materialNameSnapshot: material.name,
                materialCategory: material.category,
                gaugeSnapshot: gaugeToUseForWeight, 
                isCutRequired: true, 
                usageUnit: material.usageUnit, 
                pipeBreakdown: (consumptionResult.pipesTakenPerStandardLength || []).map(p => ({ 
                    length: toDecimal128(p.length), 
                    unit: p.unit, 
                    count: p.count,
                    lengthInInches: p.lengthInInches 
                })),
                totalQuantity: toDecimal128(consumptionResult.totalPipesFromStock.toString()),
                quantityUnit: 'pipes',
                totalWeight: weightCalcPossible ? toDecimal128(totalWeightForProfile.toFixed(3), '0.000') : toDecimal128('0', '0.000'),
                weightUnit: weightCalcPossible ? weightUnitForProfile : 'N/A',
            });
        }

        // Add processed non-profile materials to the final aggregated list
        for (const materialIdStr in processedNonProfileMaterials) {
            const nonProfileData = processedNonProfileMaterials[materialIdStr];
            console.log(`[Wire Mesh Debug Final Aggregation] Processing ${nonProfileData.materialNameSnapshot}, wireMeshItems: ${JSON.stringify(nonProfileData.wireMeshItems)}`);
            finalAggregatedOrderMaterials.push({
                materialId: nonProfileData.materialId,
                materialNameSnapshot: nonProfileData.materialNameSnapshot,
                materialCategory: nonProfileData.materialCategory,
                gaugeSnapshot: nonProfileData.gaugeSnapshot,
                isCutRequired: false, 
                usageUnit: nonProfileData.usageUnit,
                pipeBreakdown: [], 
                totalQuantity: nonProfileData.totalQuantityDecimal,
                quantityUnit: nonProfileData.quantityUnit,
                totalWeight: nonProfileData.totalWeightDecimal,
                weightUnit: nonProfileData.weightUnit,
                // Store individual wire mesh items for proper display
                wireMeshItems: nonProfileData.wireMeshItems
            });
            console.log(`[Wire Mesh Debug Final Aggregation] Added to final list with wireMeshItems: ${JSON.stringify(nonProfileData.wireMeshItems)}`);
        }
        // Sort finalAggregatedOrderMaterials by name for consistent display/storage
        finalAggregatedOrderMaterials.sort((a, b) => (a.materialNameSnapshot || '').localeCompare(b.materialNameSnapshot || ''));

        return {
            companyId,
            orderIdDisplay,
            quotationId: quotation._id,
            quotationIdDisplaySnapshot: quotation.quotationIdDisplay,
            clientId: quotation.clientId,
            clientSnapshot: quotation.clientSnapshot,
            status: 'Pending', 
            dimensionUnit: quotation.dimensionUnit,
            areaUnit: quotation.areaUnit,
            priceUnit: quotation.priceUnit,
            items: orderItems,
            aggregatedOrderMaterials: finalAggregatedOrderMaterials, 
            charges: quotation.charges.map(c => ({ ...c.toObject() })),
            discount: quotation.discount.toObject(),
            finalSubtotal: quotation.subtotal,
            finalTotalCharges: quotation.totalCharges,
            finalTotalTax: quotation.totalTax,
            finalGrandTotal: quotation.grandTotal,
            termsAndConditions: quotation.termsAndConditions,
            paymentTerms: quotation.paymentTerms,
            notes: quotation.notes,
            createdBy: userId,
            history: [{
                status: 'Pending',
                notes: 'Order created from quotation.',
                updatedBy: userId,
                timestamp: Date.now(),
            }],
        };
    }

    /**
     * Updates order items with final measurements and recalculates required material cuts.
     * @param {Object} order - The Mongoose Order document.
     * @param {Array} updatedItemsData - Array of items with finalWidth, finalHeight, finalQuantity.
     * @param {String} companyId - The ID of the company.
     * @param {String} userId - The ID of the user confirming measurements.
     * @returns {Object} The updated Mongoose Order document (not yet saved).
     */
    async updateAndRecalculateOrderItems(order, updatedItemsData, companyId, userId) {
        const aggregatedRawProfileCutsFt = {}; 
        const processedNonProfileMaterials = {}; 
        let newFinalSubtotalAsNumber = 0;

        for (const updatedItemData of updatedItemsData) {
            const orderItem = order.items.find(i => i._id.toString() === updatedItemData.itemId);
            if (!orderItem) {
                throw new AppError(`Item with ID ${updatedItemData.itemId} not found in order.`, 404);
            }

            const pTypeDoc = await ProductType.findById(orderItem.productTypeId._id || orderItem.productTypeId).lean(); 
            if (!pTypeDoc) {
                 throw new AppError(`ProductType not found for item ${orderItem.productTypeNameSnapshot}`, 404);
            }

            orderItem.finalWidth = toDecimal128(updatedItemData.finalWidth.toString());
            orderItem.finalHeight = toDecimal128(updatedItemData.finalHeight.toString());
            orderItem.finalQuantity = parseInt(updatedItemData.finalQuantity, 10);

            const materialDetailsForItem = await this.calculateOrderMaterialDetails(
                pTypeDoc, 
                orderItem.finalWidth,
                orderItem.finalHeight,
                orderItem.finalQuantity,
                order.dimensionUnit,
                companyId,
                order.gauge 
            );
            
            const newItemRequiredMaterialCuts = []; // For this specific updated orderItem

            for (const matDetail of materialDetailsForItem) {
                const materialIdStr = matDetail.materialId.toString();
                const materialDoc = matDetail.materialDoc || await this.findMaterialById(matDetail.materialId, companyId); 
                if (!materialDoc) {
                    console.warn(`[updateAndRecalculate] MaterialV2 ${materialIdStr} not found. Skipping.`);
                    continue;
                }

                // Populate newItemRequiredMaterialCuts for display for this orderItem
                if (matDetail.materialCategory === 'Profile') {
                    // Convert raw cuts (matDetail.calculatedValues) to the order-level display unit for cuts
                    let displayCutLengths = matDetail.calculatedValues; // These are Decimal128
                    let displayLengthUnit = matDetail.usageUnit;     // This is the original unit of calculatedValues

                    // Determine target display unit: inches for sqft orders, mm for sqm/mm orders
                    // order.dimensionUnit is the key here
                    const targetDisplayUnitForCuts = (order.dimensionUnit === 'mm') ? 'mm' : 'inches';

                    if (displayLengthUnit.toLowerCase() !== targetDisplayUnitForCuts.toLowerCase()) {
                        displayCutLengths = matDetail.calculatedValues.map(cutValDecimal => {
                            const conversion = unitConverter.convertUnit(
                                parseFloat(cutValDecimal.toString()),
                                displayLengthUnit, // Original unit
                                targetDisplayUnitForCuts // Target display unit
                            );
                            if (conversion.error) {
                                console.error(`[updateAndRecalculate] Profile raw cut conversion error: ${conversion.error} (From ${displayLengthUnit} to ${targetDisplayUnitForCuts}, Value: ${cutValDecimal.toString()})`);
                                throw new AppError(`Error converting profile raw cut for display: ${conversion.error}. Please check material setup and formulas.`, 500);
                            }
                            if (conversion.result === null || isNaN(conversion.result)) {
                                 console.error(`[updateAndRecalculate] Profile raw cut conversion resulted in null/NaN (From ${displayLengthUnit} to ${targetDisplayUnitForCuts}, Value: ${cutValDecimal.toString()})`);
                                throw new AppError(`Profile raw cut conversion resulted in invalid value. Please check material setup and formulas.`, 500);
                            }
                            return toDecimal128(conversion.result.toString());
                        });
                        displayLengthUnit = targetDisplayUnitForCuts;
                    }

                    newItemRequiredMaterialCuts.push({
                        materialId: matDetail.materialId,
                        materialNameSnapshot: matDetail.materialNameSnapshot,
                        gaugeSnapshot: matDetail.gaugeSnapshot,
                        cutLengths: displayCutLengths, 
                        lengthUnit: displayLengthUnit,
                        isCutRequired: true,
                        pipeBreakdown: [], 
                        totalQuantity: toDecimal128(displayCutLengths.length.toString()),
                        quantityUnit: 'cuts',
                        totalWeight: toDecimal128('0'),
                        weightUnit: materialDoc.weightUnit || 'kg'
                    });

                    // Aggregate for global optimization
                    if (!aggregatedRawProfileCutsFt[materialIdStr]) {
                        aggregatedRawProfileCutsFt[materialIdStr] = {
                            materialDoc: materialDoc,
                            gaugeSnapshot: matDetail.gaugeSnapshot,
                            cuts: [],
                            materialNameSnapshot: materialDoc.name,
                            usageUnit: materialDoc.usageUnit,
                            weightUnit: materialDoc.weightUnit || 'kg'
                        };
                    }
                    aggregatedRawProfileCutsFt[materialIdStr].cuts.push(...matDetail.rawCutsFt);
                } else { // Non-Profile
                    newItemRequiredMaterialCuts.push({
                        materialId: matDetail.materialId,
                        materialNameSnapshot: matDetail.materialNameSnapshot,
                        gaugeSnapshot: matDetail.gaugeSnapshot,
                        cutLengths: [],
                        lengthUnit: matDetail.usageUnit,
                        isCutRequired: false,
                        pipeBreakdown: [],
                        totalQuantity: matDetail.totalQuantity,
                        quantityUnit: matDetail.quantityUnit,
                        totalWeight: matDetail.totalWeight,
                        weightUnit: matDetail.weightUnit
                    });

                    // Aggregate for global sums
                    if (!processedNonProfileMaterials[materialIdStr]) {
                        processedNonProfileMaterials[materialIdStr] = {
                            materialDoc: materialDoc,
                            materialId: matDetail.materialId,
                            materialNameSnapshot: matDetail.materialNameSnapshot,
                            materialCategory: matDetail.materialCategory,
                            gaugeSnapshot: matDetail.gaugeSnapshot,
                            totalQuantityDecimal: toDecimal128('0'),
                            totalWeightDecimal: toDecimal128('0', '0.000'),
                            usageUnit: matDetail.usageUnit,
                            quantityUnit: matDetail.quantityUnit,
                            weightUnit: matDetail.weightUnit,
                            // Store individual wire mesh items instead of aggregating dimensions
                            wireMeshItems: matDetail.wireMeshDimensions ? [{
                                width: matDetail.wireMeshDimensions.width,
                                height: matDetail.wireMeshDimensions.height,
                                unit: matDetail.wireMeshDimensions.unit,
                                quantity: matDetail.wireMeshDimensions.quantity,
                                optimization: matDetail.wireMeshDimensions.optimization || null
                            }] : []
                        };
                        console.log(`[Wire Mesh Debug Aggregation] Creating new entry for ${matDetail.materialNameSnapshot}, wireMeshItems: ${JSON.stringify(processedNonProfileMaterials[materialIdStr].wireMeshItems)}`);
                    } else {
                        // Add individual wire mesh item instead of combining dimensions
                        if (matDetail.wireMeshDimensions) {
                            processedNonProfileMaterials[materialIdStr].wireMeshItems.push({
                                width: matDetail.wireMeshDimensions.width,
                                height: matDetail.wireMeshDimensions.height,
                                unit: matDetail.wireMeshDimensions.unit,
                                quantity: matDetail.wireMeshDimensions.quantity,
                                optimization: matDetail.wireMeshDimensions.optimization || null
                            });
                            console.log(`[Wire Mesh Debug Aggregation] Added wire mesh item to existing entry: ${JSON.stringify(matDetail.wireMeshDimensions)}`);
                        }
                    }
                    const currentTotalQuantity = parseFloat(processedNonProfileMaterials[materialIdStr].totalQuantityDecimal.toString());
                    const itemAggQuantity = parseFloat(matDetail.totalQuantity.toString());
                    processedNonProfileMaterials[materialIdStr].totalQuantityDecimal = toDecimal128((currentTotalQuantity + itemAggQuantity).toFixed(4));
                    
                    const currentTotalWeight = parseFloat(processedNonProfileMaterials[materialIdStr].totalWeightDecimal.toString());
                    const itemAggWeight = parseFloat(matDetail.totalWeight.toString());
                    processedNonProfileMaterials[materialIdStr].totalWeightDecimal = toDecimal128((currentTotalWeight + itemAggWeight).toFixed(3), '0.000');
                    
                    // Wire mesh items are now stored individually, no need for accumulation
                }
            }
            
            // Update the specific orderItem's requiredMaterialCuts
            orderItem.requiredMaterialCuts = newItemRequiredMaterialCuts;

            if (orderItem.finalItemSubtotal) {
                newFinalSubtotalAsNumber += parseFloat(orderItem.finalItemSubtotal.toString()) * orderItem.finalQuantity; 
            } else {
                console.warn(`Order item ${orderItem._id} missing finalItemSubtotal during recalculation.`);
            }
        }

        // Process aggregated profile materials (global optimization)
        const finalAggregatedOrderMaterials = [];
        for (const materialIdStr in aggregatedRawProfileCutsFt) {
            const profileData = aggregatedRawProfileCutsFt[materialIdStr];
            const material = profileData.materialDoc;
            const allCutsInFt = profileData.cuts;
            let consumptionResult = { pipesTakenPerStandardLength: [], totalPipesFromStock: 0, totalScrapLength: 0 };

            if (allCutsInFt.length > 0) {
                try {
                    consumptionResult = await calculateProfileConsumption(
                        material, companyId.toString(), allCutsInFt, SCRAP_THRESHOLD_FT
                    );
                } catch (error) {
                    console.error(`Error in global calculateProfileConsumption for order material ${material.name} (ID: ${materialIdStr}) during update:`, error);
                    throw new AppError(`Cutting planning error for ${material.name} (update): ${error.message}`, error instanceof ProfileCuttingError ? 400 : 500);
                }
            }
            
            let totalWeightForProfile = 0; 
            let weightUnitForProfile = material.weightUnit || 'kg';
            let weightCalcPossible = true;
            let determinedWeightPerFoot = 0;
            const gaugeToUseForWeight = order.gauge || profileData.gaugeSnapshot; 

            if (gaugeToUseForWeight && material.gaugeSpecificWeights && material.gaugeSpecificWeights.length > 0) {
                const gaugeWeight = material.gaugeSpecificWeights.find(gw => gw.gauge && gw.gauge.toString() === gaugeToUseForWeight.toString());
                if (gaugeWeight && gaugeWeight.weightPerUnitLength != null) {
                    determinedWeightPerFoot = parseFloat(gaugeWeight.weightPerUnitLength.toString());
                }
            }
            if (determinedWeightPerFoot === 0 && material.weightPerUnitLength != null) { 
                determinedWeightPerFoot = parseFloat(material.weightPerUnitLength.toString());
            }
            if (isNaN(determinedWeightPerFoot) || determinedWeightPerFoot <= 0) {
                weightCalcPossible = false;
            } else {
                const weightPerInch = determinedWeightPerFoot / 12.0;
                (consumptionResult.pipesTakenPerStandardLength || []).forEach(pipeInfo => {
                    totalWeightForProfile += (pipeInfo.count || 0) * (pipeInfo.lengthInInches || 0) * weightPerInch;
                });
            }

            finalAggregatedOrderMaterials.push({
                materialId: material._id,
                materialNameSnapshot: material.name,
                materialCategory: material.category,
                gaugeSnapshot: gaugeToUseForWeight, 
                isCutRequired: true, 
                usageUnit: material.usageUnit,
                pipeBreakdown: (consumptionResult.pipesTakenPerStandardLength || []).map(p => ({ 
                    length: toDecimal128(p.length), unit: p.unit, count: p.count, lengthInInches: p.lengthInInches 
                })),
                totalQuantity: toDecimal128(consumptionResult.totalPipesFromStock.toString()),
                quantityUnit: 'pipes',
                totalWeight: weightCalcPossible ? toDecimal128(totalWeightForProfile.toFixed(3), '0.000') : toDecimal128('0', '0.000'),
                weightUnit: weightCalcPossible ? weightUnitForProfile : 'N/A',
            });
        }

        // Add processed non-profile materials to the final aggregated list
        for (const materialIdStr in processedNonProfileMaterials) {
            const nonProfileData = processedNonProfileMaterials[materialIdStr];
            console.log(`[Wire Mesh Debug Final Aggregation] Processing ${nonProfileData.materialNameSnapshot}, wireMeshItems: ${JSON.stringify(nonProfileData.wireMeshItems)}`);
            finalAggregatedOrderMaterials.push({
                materialId: nonProfileData.materialId,
                materialNameSnapshot: nonProfileData.materialNameSnapshot,
                materialCategory: nonProfileData.materialCategory,
                gaugeSnapshot: nonProfileData.gaugeSnapshot,
                isCutRequired: false, 
                usageUnit: nonProfileData.usageUnit,
                pipeBreakdown: [], 
                totalQuantity: nonProfileData.totalQuantityDecimal,
                quantityUnit: nonProfileData.quantityUnit,
                totalWeight: nonProfileData.totalWeightDecimal,
                weightUnit: nonProfileData.weightUnit,
                // Store individual wire mesh items for proper display
                wireMeshItems: nonProfileData.wireMeshItems
            });
            console.log(`[Wire Mesh Debug Final Aggregation] Added to final list with wireMeshItems: ${JSON.stringify(nonProfileData.wireMeshItems)}`);
        }
        // Sort finalAggregatedOrderMaterials by name
        finalAggregatedOrderMaterials.sort((a, b) => (a.materialNameSnapshot || '').localeCompare(b.materialNameSnapshot || ''));

        order.aggregatedOrderMaterials = finalAggregatedOrderMaterials;

        // Recalculate order totals 
        order.finalSubtotal = mongoose.Types.Decimal128.fromString(newFinalSubtotalAsNumber.toFixed(2));
        let totalChargesAmountAsNumber = 0;
        order.charges.forEach(charge => {
            if (charge.amount) totalChargesAmountAsNumber += parseFloat(charge.amount.toString());
        });
        order.finalTotalCharges = mongoose.Types.Decimal128.fromString(totalChargesAmountAsNumber.toFixed(2));
        const finalSubtotalNumber = parseFloat(order.finalSubtotal.toString());
        const finalTotalChargesNumber = parseFloat(order.finalTotalCharges.toString());
        let preDiscountTotalNumber = finalSubtotalNumber + finalTotalChargesNumber;
        let discountAmountNumber = 0;
        if (order.discount && order.discount.value) {
            const discountValueNumber = parseFloat(order.discount.value.toString());
            if (order.discount.type === 'percentage') {
                discountAmountNumber = (preDiscountTotalNumber * discountValueNumber) / 100;
            } else { 
                discountAmountNumber = discountValueNumber;
            }
        }
        const finalGrandTotalNumber = preDiscountTotalNumber - discountAmountNumber;
        order.finalGrandTotal = mongoose.Types.Decimal128.fromString(finalGrandTotalNumber.toFixed(2));
        
        order.history.push({
            status: order.status, 
            notes: 'Order items updated with final measurements and material requirements recalculated.',
            updatedBy: userId,
            timestamp: Date.now(),
        });

        return order;
    }

    /**
     * Calculates the required material cuts for a single order item based on its product type and final dimensions.
     * @param {Object} productType - The Mongoose ProductType document (must be populated with materials).
     * @param {Decimal128} finalWidth - The final width of the item.
     * @param {Decimal128} finalHeight - The final height of the item.
     * @param {Number} finalQuantity - The final quantity of the item.
     * @param {String} dimensionUnitUsed - The dimension unit for finalWidth/finalHeight (e.g., 'inches', 'mm').
     * @param {String} companyId - The ID of the company.
     * @returns {Array} An array of required material cut objects.
     */
    async calculateRequiredMaterialCutsForItem(productType, finalWidth, finalHeight, finalQuantity, dimensionUnitUsed, companyId) {
        const allCuts = [];
        if (!productType.materials || productType.materials.length === 0) {
            return allCuts; // No materials defined for this product type
        }

        for (const mat of productType.materials) {
            const materialDoc = await this.findMaterialById(mat.materialId, companyId);
            if (!materialDoc) {
                console.warn(`MaterialV2 with ID ${mat.materialId} not found during cut calculation for product ${productType.name}`);
                continue;
            }

            if (!mat.isCutRequired && materialDoc.category !== 'Profile') {
                // For non-profile materials not explicitly requiring cuts (e.g., hardware, some accessories)
                // The formula directly gives the quantity needed per item.
                let totalQuantityForItemAsNumber = 0; // Use regular JavaScript number for arithmetic
                for (const formula of mat.formulas) {
                    const evalResultObj = formulaEvaluator.evaluateFormula(formula, {
                        W: parseFloat(finalWidth.toString()),
                        H: parseFloat(finalHeight.toString()),
                    });
                    if (evalResultObj.error) {
                        throw new AppError(`Formula evaluation error for material ${mat.materialNameSnapshot} (formula: ${formula}): ${evalResultObj.error}`, 500);
                    }
                    const evalResult = evalResultObj.result;
                    if (evalResult === null || isNaN(evalResult)) throw new AppError(`Formula evaluation for material ${mat.materialNameSnapshot} did not return a valid number.`, 500);
                    
                    // Simple JavaScript addition - much more reliable than Decimal128 arithmetic
                    totalQuantityForItemAsNumber += evalResult;
                }
                
                // Convert to Decimal128 only at the very end
                const totalQuantityForItem = mongoose.Types.Decimal128.fromString(totalQuantityForItemAsNumber.toString());
                
                // We store this as a single "cut" representing the total quantity for this non-profile material for one item.
                // The actual length/dimension is not a cut length but a quantity.
                allCuts.push({
                    materialId: mat.materialId,
                    materialNameSnapshot: materialDoc.name,
                    gaugeSnapshot: mat.defaultGauge || null, // Or from materialDoc if applicable
                    // For non-cut items, cutLengths array should store Decimal128s as per schema
                    cutLengths: Array(finalQuantity).fill(null).map(() => totalQuantityForItem), // Store the Decimal128 instance
                    lengthUnit: mat.quantityUnit, // This is actually the quantity's unit (e.g., pcs, sqft)
                    isCutRequired: false,
                });
                continue;
            }

            // Logic for materials that ARE cut (typically profiles)
            const cutsForItemUnit = [];
            for (const formula of mat.formulas) {
                // Convert finalW/H to the unit expected by the formula if necessary
                const wConversion = unitConverter.convertUnit(
                    parseFloat(finalWidth.toString()),
                    dimensionUnitUsed, // Unit of finalW/H
                    mat.formulaInputUnit // Unit expected by formula
                );
                if (wConversion.error) {
                    throw new AppError(`Unit conversion failed for width of material ${mat.materialNameSnapshot} (from ${dimensionUnitUsed} to ${mat.formulaInputUnit}): ${wConversion.error}`, 500);
                }
                const wInFormulaUnit = wConversion.result;

                const hConversion = unitConverter.convertUnit(
                    parseFloat(finalHeight.toString()),
                    dimensionUnitUsed, // Unit of finalW/H
                    mat.formulaInputUnit // Unit expected by formula
                );
                if (hConversion.error) {
                    throw new AppError(`Unit conversion failed for height of material ${mat.materialNameSnapshot} (from ${dimensionUnitUsed} to ${mat.formulaInputUnit}): ${hConversion.error}`, 500);
                }
                const hInFormulaUnit = hConversion.result;

                if (wInFormulaUnit === null || hInFormulaUnit === null) {
                    // This case should ideally be caught by the error checks above, but as a fallback:
                    throw new AppError(`Unit conversion resulted in null for material ${mat.materialNameSnapshot} from ${dimensionUnitUsed} to ${mat.formulaInputUnit}`, 500);
                }

                const cutLengthResultObj = formulaEvaluator.evaluateFormula(formula, {
                    W: wInFormulaUnit,
                    H: hInFormulaUnit,
                });

                if (cutLengthResultObj.error) {
                    throw new AppError(`Formula evaluation error for cut length of material ${mat.materialNameSnapshot} (formula: ${formula}): ${cutLengthResultObj.error}`, 500);
                }
                const cutLengthInFormulaUnit = cutLengthResultObj.result;

                if (cutLengthInFormulaUnit === null || isNaN(cutLengthInFormulaUnit) || cutLengthInFormulaUnit <= 0) {
                    // Silently ignore non-positive cut lengths or log if necessary
                    console.warn(`Invalid cut length (${cutLengthInFormulaUnit}) for material ${mat.materialNameSnapshot}, formula: ${formula}`);
                    continue;
                }

                // CRITICAL FIX: The formula output is in the same unit as the formula inputs (formulaInputUnit)
                // NOT in quantityUnit. quantityUnit should represent what unit we WANT to store it in.
                // For profile formulas that calculate lengths, the output unit matches the input unit.
                const formulaOutputUnit = mat.formulaInputUnit; // This is the actual unit of the formula result
                
                // Convert the calculated cut length FROM the formula's actual output unit
                // TO the materialDoc.usageUnit for storage
                const finalCutConversion = unitConverter.convertUnit(
                    cutLengthInFormulaUnit,
                    formulaOutputUnit, // The actual unit of the formula output
                    materialDoc.usageUnit // The desired storage/usage unit (e.g., inches or ft)
                );

                if (finalCutConversion.error) {
                    throw new AppError(`Cut length unit conversion failed for ${mat.materialNameSnapshot} (from ${formulaOutputUnit} to ${materialDoc.usageUnit}): ${finalCutConversion.error}`, 500);
                }
                let finalCutLength = finalCutConversion.result;

                if (finalCutLength === null) {
                     // This case should ideally be caught by the error check above
                    throw new AppError(`Cut length unit conversion resulted in null for ${mat.materialNameSnapshot} from ${formulaOutputUnit} to ${materialDoc.usageUnit}`, 500);
                }

                // Add logging for debugging
                if (finalCutLength > 20) { // Log suspiciously large cuts
                    console.log(`[Cut Calculation] MaterialV2: ${mat.materialNameSnapshot}, Formula: ${formula}, W: ${wInFormulaUnit} ${mat.formulaInputUnit}, H: ${hInFormulaUnit} ${mat.formulaInputUnit}, Result: ${cutLengthInFormulaUnit} ${formulaOutputUnit} → ${finalCutLength} ${materialDoc.usageUnit}`);
                }

                cutsForItemUnit.push(mongoose.Types.Decimal128.fromString(finalCutLength.toFixed(4))); // Store with precision
            }

            if (cutsForItemUnit.length > 0) {
                const repeatedCutsForTotalQuantity = [];
                for (let i = 0; i < finalQuantity; i++) {
                    repeatedCutsForTotalQuantity.push(...cutsForItemUnit);
                }

                allCuts.push({
                    materialId: mat.materialId,
                    materialNameSnapshot: materialDoc.name,
                    gaugeSnapshot: mat.defaultGauge || materialDoc.defaultGauge || null, // Prefer product type default, then material default
                    cutLengths: repeatedCutsForTotalQuantity,
                    lengthUnit: materialDoc.usageUnit, // Store cuts in the material's standard usage unit
                    isCutRequired: mat.isCutRequired || materialDoc.category === 'Profile',
                });
            }
        }
        return allCuts;
    }

    // Helper to group cuts for display, e.g., [{length: 12, unit: 'ft', count: 2}, {length: 15, unit: 'ft', count: 1}]
    // This is now more aligned with pipeBreakdown structure
    _groupAndFormatPipeBreakdownForDisplay(pipeBreakdownArray) {
        if (!pipeBreakdownArray || pipeBreakdownArray.length === 0) return [];
        // pipeBreakdownArray is expected to be like [{ length: Decimal128('12'), unit: 'ft', count: 2, lengthInInches: 144}, ...]
        return pipeBreakdownArray.map(p => {
            // Handle both plain objects and Mongoose subdocuments
            const actualP = p._doc || p; // If it's a Mongoose subdocument, use _doc
            if (!actualP || !actualP.length) {
                console.warn('[_groupAndFormatPipeBreakdownForDisplay] Invalid pipe breakdown entry:', p);
                return { length: 0, count: 0, unit: 'unknown' };
            }
            return {
                length: parseFloat(actualP.length.toString()),
                count: actualP.count || 0,
                unit: actualP.unit || 'unknown'
            };
        }).filter(item => item.length > 0) // Filter out invalid entries
          .sort((a,b) => a.length - b.length); // Sort for consistent display
    }
    
    _formatStockForDisplay(stockByLength) {
        if (!stockByLength || stockByLength.length === 0) return [];
        return stockByLength.map(item => ({
            length: parseFloat(item.length.toString()), 
            count: parseInt(item.quantity.toString(), 10), 
            unit: item.unit
        })).sort((a,b) => a.length - b.length); 
    }

    async getDetailedStockAvailabilityForOrder(order, companyId) {
        const detailedStockResults = [];
        // const aggregatedMaterialRequirements = {}; // Old approach

        // Step 1: Use the pre-aggregated and globally optimized materials from order.aggregatedOrderMaterials
        if (!order.aggregatedOrderMaterials || order.aggregatedOrderMaterials.length === 0) {
            console.warn(`[StockCheck] Order ${order.orderIdDisplay} has no aggregatedOrderMaterials. Returning empty stock results.`);
            return [];
        }

        // Step 2: Process each aggregated material for stock availability
        // for (const materialIdStr in aggregatedMaterialRequirements) { // Old loop
        for (const aggMatRequirement of order.aggregatedOrderMaterials) {
            // const aggMat = aggregatedMaterialRequirements[materialIdStr]; // Old way of getting aggMat
            const materialIdStr = aggMatRequirement.materialId.toString();
            const materialDoc = await this.findMaterialById(aggMatRequirement.materialId, companyId);

            if (aggMatRequirement.materialCategory === 'Wire Mesh') {
                // console.log(`[Wire Mesh Debug Stock Check FULL] Full aggMatRequirement for ${aggMatRequirement.materialNameSnapshot}:`, JSON.stringify(aggMatRequirement, null, 2));
            }

            if (!materialDoc) {
                console.warn(`[StockCheck] MaterialV2 with ID ${materialIdStr} (name: ${aggMatRequirement.materialNameSnapshot}) not found in DB during stock check. Skipping.`);
                            detailedStockResults.push({
                                materialId: materialIdStr,
                    materialName: aggMatRequirement.materialNameSnapshot || 'Unknown (Not Found)',
                    category: aggMatRequirement.materialCategory || 'Unknown',
                                status: 'MaterialV2 Not Found',
                                requiredCutsDetail: [],
                                availableStockDetail: [],
                                shortfallDetail: [],
                    usageUnit: aggMatRequirement.usageUnit || 'N/A'
                            });
                        continue;
            }
            
            // Use properties directly from aggMatRequirement, which is from order.aggregatedOrderMaterials
            const category = aggMatRequirement.materialCategory;
            const materialName = aggMatRequirement.materialNameSnapshot;
            const usageUnit = aggMatRequirement.usageUnit;

            if (category === 'Profile') {
                // aggMatRequirement.pipeBreakdown is already the globally optimized breakdown
                const requiredPipeBreakdownDisplay = this._groupAndFormatPipeBreakdownForDisplay(aggMatRequirement.pipeBreakdown);
                const actualStock = this._formatStockForDisplay(materialDoc.stockByLength);
                const mutableStock = JSON.parse(JSON.stringify(actualStock)); 
                const shortfallDetail = [];
                let isSufficient = true;

                for (const plannedPipe of (aggMatRequirement.pipeBreakdown || [])) { 
                    const actualPlannedPipe = plannedPipe._doc || plannedPipe;
                    if (!actualPlannedPipe || !actualPlannedPipe.length) {
                        console.warn('[StockCheck] Invalid plannedPipe in aggregated pipeBreakdown:', plannedPipe);
                        continue;
                    }
                    
                    const plannedPipeLengthInches = actualPlannedPipe.lengthInInches; 
                    let neededCount = actualPlannedPipe.count;

                    const stockItemIndex = mutableStock.findIndex(s => {
                        const stockItemLengthInches = unitConverter.convertUnit(s.length, s.unit, 'inches').result;
                        return stockItemLengthInches !== null && Math.abs(stockItemLengthInches - plannedPipeLengthInches) < 0.1;
                    });

                    if (stockItemIndex !== -1) {
                        const stockItem = mutableStock[stockItemIndex];
                        if (stockItem.count >= neededCount) {
                            stockItem.count -= neededCount;
                            neededCount = 0;
                        } else {
                            shortfallDetail.push({
                                length: parseFloat(actualPlannedPipe.length.toString()),
                                unit: actualPlannedPipe.unit,
                                count: neededCount - stockItem.count,
                            });
                            neededCount = stockItem.count; 
                            stockItem.count = 0;
                            isSufficient = false;
                        }
                    } else {
                        shortfallDetail.push({
                            length: parseFloat(actualPlannedPipe.length.toString()),
                            unit: actualPlannedPipe.unit,
                            count: neededCount,
                        });
                        isSufficient = false;
                    }
                }
                
                const finalAvailableStockDetail = mutableStock.filter(s => s.count > 0);
                const finalStatus = isSufficient ? 'Sufficient' : (shortfallDetail.length > 0 ? 'Insufficient' : 'Sufficient');

                detailedStockResults.push({
                    materialId: materialIdStr,
                    materialName: materialName,
                    category: category,
                    status: finalStatus,
                    requiredCutsDetail: requiredPipeBreakdownDisplay, 
                    availableStockDetail: actualStock, 
                    shortfallDetail: this._groupAndFormatPipeBreakdownForDisplay(shortfallDetail), 
                    usageUnit: usageUnit 
                });

            } else { // Non-Profile MaterialV2 Logic
                const requiredQty = parseFloat(aggMatRequirement.totalQuantity.toString());
                const availableQty = parseFloat((materialDoc.totalStockQuantity || '0').toString());
                const quantityUnitForDisplay = aggMatRequirement.quantityUnit; // Use the quantityUnit from aggregated data
                let status = 'N/A';
                let shortfallQty = 0;

                if (materialDoc.stockTrackingEnabled === false) { 
                    status = 'Not Tracked';
                } else if (availableQty >= requiredQty) {
                    status = 'Sufficient';
                } else {
                    status = 'Insufficient';
                    shortfallQty = requiredQty - availableQty;
                }
                
                let requiredDisplay, availableDisplay, shortfallDisplay;
                
                // Special handling for Wire Mesh materials - show individual optimized dimensions
                if (category === 'Wire Mesh' && aggMatRequirement.wireMeshItems && aggMatRequirement.wireMeshItems.length > 0) {
                    console.log(`[Wire Mesh Debug Stock Check] Wire mesh has ${aggMatRequirement.wireMeshItems.length} individual items`);
                    
                    // Display each optimized wire mesh item separately
                    requiredDisplay = aggMatRequirement.wireMeshItems.map(item => {
                        if (item.optimization) {
                            console.log(`[Wire Mesh Debug Stock Check] Using optimization data: ${JSON.stringify(item.optimization)}`);
                            
                            // Use optimized dimensions: selectedWidth x actualLength (handles orientation swapping)
                            const selectedWidth = item.optimization.selectedWidth;
                            
                            // For actualLength, try multiple approaches to get the correct value
                            let actualLength;
                            if (item.optimization.actualLength !== undefined) {
                                // Direct actualLength field (new optimization results)
                                actualLength = item.optimization.actualLength;
                            } else if (item.optimization.orientationUsed === 'swapped') {
                                // For swapped orientation, the original requiredWidth becomes the length
                                actualLength = item.optimization.requiredWidth;
                            } else if (item.optimization.orientationUsed === 'original') {
                                // For original orientation, use requiredLength
                                actualLength = item.optimization.requiredLength;
                            } else {
                                // Fallback: if no orientation info, try to determine from dimensions
                                // If selectedWidth matches requiredWidth, it's original orientation
                                if (Math.abs(selectedWidth - item.optimization.requiredWidth) < 0.01) {
                                    actualLength = item.optimization.requiredLength;
                                } else {
                                    // Otherwise assume swapped
                                    actualLength = item.optimization.requiredWidth;
                                }
                            }
                            
                            console.log(`[Wire Mesh Debug Stock Check] Calculated actualLength: ${actualLength} (selectedWidth: ${selectedWidth})`);
                            
                            const displayUnit = item.unit === 'inches' ? 'ft' : item.unit;
                            
                            // Convert to display unit if needed
                            let displayWidth = selectedWidth;
                            let displayLength = actualLength;
                            
                            if (item.unit === 'inches' && displayUnit === 'ft') {
                                displayWidth = (selectedWidth / 12).toFixed(2);
                                displayLength = (actualLength / 12).toFixed(2);
                            } else {
                                displayWidth = selectedWidth.toFixed(2);
                                displayLength = actualLength.toFixed(2);
                            }
                            
                            return { 
                                length: `${displayWidth} x ${displayLength}`,
                                count: item.quantity, 
                                unit: displayUnit 
                            };
                        } else {
                            // Fallback if no optimization data
                            console.log(`[Wire Mesh Debug Stock Check] No optimization data, using dimensions: ${item.width} x ${item.height} ${item.unit}`);
                            
                            const displayUnit = item.unit === 'inches' ? 'ft' : item.unit;
                            let displayWidth = item.width;
                            let displayHeight = item.height;
                            
                            if (item.unit === 'inches' && displayUnit === 'ft') {
                                displayWidth = (item.width / 12).toFixed(2);
                                displayHeight = (item.height / 12).toFixed(2);
                            } else {
                                displayWidth = displayWidth.toFixed(2);
                                displayHeight = displayHeight.toFixed(2);
                            }
                            
                            return { 
                                length: `${displayWidth} x ${displayHeight}`,
                                count: item.quantity, 
                                unit: displayUnit 
                            };
                        }
                    });
                    
                    console.log(`[Wire Mesh Debug Stock Check] Individual wire mesh items display: ${JSON.stringify(requiredDisplay)}`);
                    
                } else if (category === 'Wire Mesh') {
                    // Fallback for existing orders without wireMeshItems structure
                    console.log(`[Wire Mesh Debug Stock Check] No wireMeshItems found for existing order, calculating fallback`);
                    
                    // For existing orders, try to reverse-engineer the wire mesh optimization
                    // Using the total area to estimate what the original required dimensions might have been
                    const totalAreaSqFt = parseFloat(aggMatRequirement.totalQuantity.toString());
                    const quantity = 1; // Assume 1 piece for fallback
                    
                    // Area per piece
                    const areaPerPiece = totalAreaSqFt / quantity;
                    
                    try {
                        // Use the wire mesh optimization service to calculate optimized dimensions
                        // Assume a reasonable aspect ratio for the required dimensions (e.g. 1:1 or 3:4)
                        const estimatedRequiredWidth = Math.sqrt(areaPerPiece * 0.75); // Assume 3:4 ratio
                        const estimatedRequiredLength = areaPerPiece / estimatedRequiredWidth;
                        
                        console.log(`[Wire Mesh Debug Stock Check] Estimated required dimensions: ${estimatedRequiredWidth.toFixed(2)} x ${estimatedRequiredLength.toFixed(2)} ft`);
                        
                        // Call the wire mesh optimization service to get proper optimized dimensions
                        const optimizationResult = await WireMeshOptimizationService.calculateWireMeshConsumption(
                            materialDoc,
                            estimatedRequiredWidth,
                            estimatedRequiredLength,
                            'ft'
                        );
                        
                        console.log(`[Wire Mesh Debug Stock Check] Optimization result: selectedWidth=${optimizationResult.selectedWidth}${optimizationResult.unit}, requiredLength=${optimizationResult.requiredLength}${optimizationResult.unit}`);
                        
                        // Use the optimized dimensions
                        const selectedWidth = optimizationResult.selectedWidth;
                        const requiredLength = optimizationResult.requiredLength;
                        const displayUnit = optimizationResult.unit === 'inches' ? 'ft' : optimizationResult.unit;
                        
                        // Convert to display unit if needed
                        let displayWidth = selectedWidth;
                        let displayLength = requiredLength;
                        
                        if (optimizationResult.unit === 'inches' && displayUnit === 'ft') {
                            displayWidth = (selectedWidth / 12).toFixed(2);
                            displayLength = (requiredLength / 12).toFixed(2);
                        } else {
                            displayWidth = selectedWidth.toFixed(2);
                            displayLength = requiredLength.toFixed(2);
                        }
                        
                        requiredDisplay = [{ 
                            length: `${displayWidth} x ${displayLength}`,
                            count: quantity, 
                            unit: displayUnit 
                        }];
                        
                        console.log(`[Wire Mesh Debug Stock Check] Using optimized fallback dimensions: ${JSON.stringify(requiredDisplay)}`);
                        
                    } catch (optimizationError) {
                        console.warn(`[Wire Mesh Debug Stock Check] Optimization fallback failed: ${optimizationError.message}`);
                        
                        // If optimization fails, use simple estimation
                        const estimatedWidth = Math.sqrt(totalAreaSqFt * 0.75); // Assume 3:4 ratio (width:height)
                        const estimatedHeight = totalAreaSqFt / estimatedWidth;
                        
                        let wireMeshDims = {
                            width: estimatedWidth,
                            height: estimatedHeight,
                            unit: 'ft',
                            quantity: 1
                        };
                        console.log(`[Wire Mesh Debug Stock Check] Calculated fallback dimensions: ${JSON.stringify(wireMeshDims)}`);
                        
                        const dims = wireMeshDims;
                        
                        // Safety check for dimensions
                        if (!dims || typeof dims.width !== 'number' || typeof dims.height !== 'number') {
                            console.error(`[Wire Mesh Debug Stock Check] Invalid dimensions after fallback: ${JSON.stringify(dims)}`);
                            // Use default square dimensions
                            dims.width = 3;
                            dims.height = 3;
                            dims.unit = 'ft';
                            dims.quantity = 1;
                        }
                        
                        const displayUnit = dims.unit === 'inches' ? 'ft' : dims.unit; // Convert to display unit
                        
                        // Convert dimensions to display unit with null checks
                        let displayWidth = dims.width;
                        let displayHeight = dims.height;
                        
                        if (dims.unit === 'inches' && displayUnit === 'ft') {
                            displayWidth = (dims.width / 12).toFixed(2);
                            displayHeight = (dims.height / 12).toFixed(2);
                        } else {
                            displayWidth = displayWidth.toFixed(2);
                            displayHeight = displayHeight.toFixed(2);
                        }
                        
                        requiredDisplay = [{ 
                            length: `${displayWidth} x ${displayHeight}`,
                            count: dims.quantity, 
                            unit: displayUnit 
                        }];
                    }
                    
                } else {
                    console.log(`[Wire Mesh Debug Stock Check] MaterialV2 ${materialName}, category: ${category}, has wireMeshItems: ${!!aggMatRequirement.wireMeshItems}`);
                    // Standard non-profile material display
                    requiredDisplay = [{ length: requiredQty, count: 1, unit: quantityUnitForDisplay }]; 
                }
                
                // For available stock, show available quantity in area units
                if (category === 'Wire Mesh') {
                    
                    // Try to use the same width as the optimization result for consistency
                    let rollWidth = null;
                    let rollWidthUnit = 'ft';
                    let specificWidthStock = 0; // Stock available in the specific width
                    
                    // First, try to get the width from optimization data (for consistency)
                    if (aggMatRequirement.wireMeshItems && aggMatRequirement.wireMeshItems.length > 0) {
                        const firstItem = aggMatRequirement.wireMeshItems[0];
                        if (firstItem.optimization && firstItem.optimization.selectedWidth) {
                            rollWidth = firstItem.optimization.selectedWidth;
                            rollWidthUnit = firstItem.unit || 'ft';
                            
                            // Find stock available in this specific width from simpleBatches
                            if (materialDoc.simpleBatches && materialDoc.simpleBatches.length > 0) {
                                materialDoc.simpleBatches.forEach(batch => {
                                    const batchWidth = parseFloat(batch.selectedWidth.toString());
                                    const batchWidthUnit = batch.widthUnit;
                                    
                                    // Convert batch width to same unit as rollWidth for comparison
                                    const batchWidthInRollUnit = unitConverter.convertUnit(batchWidth, batchWidthUnit, rollWidthUnit);
                                    
                                    if (!batchWidthInRollUnit.error && Math.abs(batchWidthInRollUnit.result - rollWidth) < 0.01) {
                                        // This batch matches our required width
                                        const batchArea = parseFloat(batch.totalArea.toString());
                                        specificWidthStock += batchArea;
                                    }
                                });
                            }
                        }
                    }
                    
                    // Fallback to standard widths if optimization data not available
                    if (!rollWidth && materialDoc.standardLengths && materialDoc.standardLengths.length > 0) {
                        const standardWidth = materialDoc.standardLengths[0]; // Use first available standard width
                        rollWidth = parseFloat(standardWidth.length.toString());
                        rollWidthUnit = standardWidth.unit;
                        
                        // For fallback, use total stock since we don't have specific optimization
                        specificWidthStock = availableQty;
                    }
                    
                    if (rollWidth) {
                        // Use specific width stock if we found it, otherwise fall back to total stock
                        const stockToUse = specificWidthStock > 0 ? specificWidthStock : availableQty;
                        
                        // Convert to display unit if needed
                        let displayRollWidth = rollWidth;
                        let displayUnit = rollWidthUnit;
                        
                        if (rollWidthUnit === 'inches' && stockToUse > 10) {
                            displayRollWidth = (rollWidth / 12).toFixed(1);
                            displayUnit = 'ft';
                        }
                        
                        const rollAvailableLength = (stockToUse / (displayRollWidth || 1)).toFixed(0);
                        
                        availableDisplay = [{ 
                            length: `${displayRollWidth} x ${rollAvailableLength}`,
                            count: 1, 
                            unit: displayUnit 
                        }];
                    } else {
                        // Ultimate fallback: show total area
                        availableDisplay = [{ 
                            length: availableQty.toFixed(2),
                            count: 1, 
                            unit: quantityUnitForDisplay 
                        }];
                    }
                } else {
                    availableDisplay = [{ length: availableQty, count: 1, unit: quantityUnitForDisplay }];
                }
                
                // Calculate shortfall for wire mesh
                if (shortfallQty > 0) {
                    if (category === 'Wire Mesh' && requiredDisplay && requiredDisplay.length > 0) {
                        // Use the required dimensions format for shortfall
                        const reqDisplayItem = requiredDisplay[0];
                        if (reqDisplayItem) {
                            shortfallDisplay = [{ 
                                length: reqDisplayItem.length,
                                count: Math.ceil(shortfallQty / availableQty) || 1, // Rough estimate of pieces needed
                                unit: reqDisplayItem.unit 
                            }];
                        } else {
                            shortfallDisplay = [{ 
                                length: shortfallQty.toFixed(2),
                                count: 1, 
                                unit: quantityUnitForDisplay 
                            }];
                        }
                    } else {
                        shortfallDisplay = [{ length: shortfallQty, count: 1, unit: quantityUnitForDisplay }];
                    }
                } else {
                    shortfallDisplay = [];
                }
                
                console.log(`[Wire Mesh Debug Stock Check] Wire mesh display set - Required: ${JSON.stringify(requiredDisplay)}, Available: ${JSON.stringify(availableDisplay)}`);

                detailedStockResults.push({
                    materialId: materialIdStr,
                    materialName: materialName,
                    category: category,
                    status: status,
                    requiredCutsDetail: requiredDisplay, 
                    availableStockDetail: availableDisplay, 
                    shortfallDetail: shortfallDisplay,
                    usageUnit: quantityUnitForDisplay // Display unit for non-profiles
                });
            }
        }
        detailedStockResults.sort((a, b) => (a.materialName || '').localeCompare(b.materialName || ''));
        return detailedStockResults;
    }

    /**
     * Performs a basic stock check for the materials required by an order.
     * Compares the sum of required cut lengths against total available length in inventory.
     * @param {Object} order - The Mongoose Order document.
     * @param {String} companyId - The ID of the company.
     * @returns {Array} An array detailing stock availability for each profile material.
     */
    async performSimpleStockCheck(order, companyId) {
        // THIS METHOD IS NOW DEPRECATED in favor of getDetailedStockAvailabilityForOrder
        // console.warn("performSimpleStockCheck is deprecated. Use getDetailedStockAvailabilityForOrder for accurate stock details.");
        // For now, let it run its old course if something still calls it, but ideally, it should be removed.
        const aggregatedCuts = await this.aggregateRequiredCutsForOrder(order);
        const stockCheckResults = [];

        for (const materialCutInfo of aggregatedCuts) {
            if (materialCutInfo.category !== 'Profile') continue; // Only check stock for profiles this way for now

            const material = await this.findMaterialById(materialCutInfo.materialId, companyId);

            if (!material) {
                stockCheckResults.push({
                    materialId: materialCutInfo.materialId,
                    materialName: materialCutInfo.materialName,
                    status: 'MaterialV2 Not Found',
                    requiredTotalLength: 0,
                    availableTotalLength: 0,
                    usageUnit: materialCutInfo.usageUnit
                });
                continue;
            }

            let totalRequiredLength = 0;
            materialCutInfo.requiredCuts.forEach(cutLength => {
                // Ensure cutLength is in the material's standard usageUnit (which it should be from aggregation)
                totalRequiredLength += cutLength;
            });

            let totalAvailableLength = 0;
            if (material.stockByLength && material.stockByLength.length > 0) {
                material.stockByLength.forEach(stockItem => {
                    const conversionResult = unitConverter.convertUnit(
                        parseFloat(stockItem.length.toString()),
                        stockItem.unit, // Unit of the stockItem.length (e.g., 'ft')
                        material.usageUnit // Convert to material's usageUnit (e.g., 'inches')
                    );
                    if (conversionResult.error) {
                        console.error(`Stock check unit conversion error for material ${material.name}: ${conversionResult.error}`);
                        // Decide how to handle this: skip this stockItem, or throw, or mark material as indeterminate
                        return; // Skip this stock item if conversion fails
                    }
                    const stockItemLengthInUsageUnit = conversionResult.result;

                    if (stockItemLengthInUsageUnit !== null && !isNaN(stockItemLengthInUsageUnit)) {
                        totalAvailableLength += stockItemLengthInUsageUnit * parseFloat(stockItem.quantity.toString());
                    }
                });
            }

            stockCheckResults.push({
                materialId: material.id,
                materialName: material.name,
                status: totalAvailableLength >= totalRequiredLength ? 'Sufficient' : 'Insufficient',
                requiredTotalLength: parseFloat(totalRequiredLength.toFixed(2)),
                availableTotalLength: parseFloat(totalAvailableLength.toFixed(2)),
                usageUnit: material.usageUnit,
                // TODO: Add detailed breakdown by standard length if needed
            });
        }
        return stockCheckResults;
    }

    // Placeholder for more complex status transition logic if needed
    isValidStatusTransition(currentStatus, nextStatus) {
        const ALLOWED_TRANSITIONS = {
            'Pending': ['Measurement Confirmed', 'Cancelled', 'On Hold'],
            'Measurement Confirmed': ['In Production', 'Ready for Optimization', 'Cancelled', 'On Hold'],
            'Ready for Optimization': ['Optimization Complete', 'Optimization Failed', 'In Production', 'Cancelled', 'On Hold'],
            'Optimization Complete': ['In Production', 'Cutting', 'Cancelled', 'On Hold'],
            'Optimization Failed': ['Ready for Optimization', 'Measurement Confirmed', 'Cancelled', 'On Hold'], // Allow retry after fixing issues
            'In Production': ['Cutting', 'Assembly', 'Completed', 'Cancelled', 'On Hold'],
            'Cutting': ['Assembly', 'In Production', 'On Hold', 'Cancelled'],
            'Assembly': ['QC', 'Packed', 'Ready for Dispatch', 'In Production', 'On Hold', 'Cancelled', 'Completed'],
            'QC': ['Packed', 'Assembly', 'On Hold', 'Cancelled'],
            'Packed': ['Ready for Dispatch', 'QC', 'Assembly', 'On Hold', 'Cancelled', 'Delivered', 'Completed'],
            'Ready for Dispatch': ['Dispatched', 'On Hold', 'Cancelled', 'Delivered', 'Completed'],
            'Dispatched': ['Delivered', 'Completed', 'Cancelled'],
            'Delivered': ['Completed', 'Cancelled'],
            'On Hold': ['Pending', 'Measurement Confirmed', 'Ready for Optimization', 'Optimization Complete', 'In Production', 'Cutting', 'Assembly', 'QC', 'Packed', 'Ready for Dispatch', 'Cancelled'],
            'Completed': [], 
            'Cancelled': [] 
        };

        if (!ALLOWED_TRANSITIONS[currentStatus]) {
            return false; // Current status is not defined, shouldn't happen with valid statuses
        }
        return ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus);
    }

    /**
     * Calculates all material details for a single order item, including profile breakdowns.
     * This function is adapted from estimationService.calculateEstimationMaterials.
     * @param {Object} productType - The Mongoose ProductType document (must be populated with materials.materialId).
     * @param {Decimal128} finalWidth - The final width of the item.
     * @param {Decimal128} finalHeight - The final height of the item.
     * @param {Number} finalQuantity - The final quantity of the item.
     * @param {String} dimensionUnitUsed - The dimension unit for finalWidth/finalHeight (e.g., 'inches', 'mm').
     * @param {String} companyId - The ID of the company.
     * @param {String} orderGauge - Optional: The gauge specified at the order level (or item level if that granular).
     * @returns {Array} An array of material detail objects for the order item.
     */
    async calculateOrderMaterialDetails(productType, finalWidth, finalHeight, finalQuantity, dimensionUnitUsed, companyId, orderGauge = null) {
        const calculatedMaterialsArray = []; 
        // const profileMaterialCutsFt = {}; // No longer needed here, aggregation happens outside

        if (!productType.materials || productType.materials.length === 0) {
            return [];
        }

        for (const materialLink of productType.materials) {
            const materialObjectId = (typeof materialLink.materialId === 'object' && materialLink.materialId !== null)
                                   ? materialLink.materialId._id
                                   : materialLink.materialId;

            if (!materialObjectId) { 
                console.warn(`[calculateOrderMaterialDetails] Skipping material link in ProductType ${productType.name} because materialObjectId is missing or invalid:`, materialLink);
                continue;
            }

            const fetchedMaterialDoc = await this.findMaterialById(materialObjectId, companyId); 
            
            if (!fetchedMaterialDoc) {
                console.warn(`[calculateOrderMaterialDetails] Full material document not found in DB for ID: ${materialObjectId}. Skipping.`);
                continue;
            }
            const material = fetchedMaterialDoc;
            const materialIdString = material._id.toString();

            console.log(`[OrderService Debug - calculateOrderMaterialDetails] Processing MaterialV2: ${material.name} (ID: ${materialIdString}) for ProductType: ${productType.name}`);
            
            const widthConversion = unitConverter.convertUnit(parseFloat(finalWidth.toString()), dimensionUnitUsed, materialLink.formulaInputUnit);
            const heightConversion = unitConverter.convertUnit(parseFloat(finalHeight.toString()), dimensionUnitUsed, materialLink.formulaInputUnit);

            if (widthConversion.error || heightConversion.error) {
                throw new AppError(`Unit conversion error for order item: ${widthConversion.error || heightConversion.error} (MaterialV2: ${material.name}, From: ${dimensionUnitUsed}, To: ${materialLink.formulaInputUnit})`, 500);
            }
            const itemWidthInFormulaUnit = widthConversion.result;
            const itemHeightInFormulaUnit = heightConversion.result;

            if (itemWidthInFormulaUnit === null || itemHeightInFormulaUnit === null || isNaN(itemWidthInFormulaUnit) || isNaN(itemHeightInFormulaUnit)) {
                throw new AppError(`Unit conversion failed for order item dimensions (MaterialV2: ${material.name}). W=${finalWidth}, H=${finalHeight}, From: ${dimensionUnitUsed}, To: ${materialLink.formulaInputUnit}`, 500);
            }

            // Handle Wire Mesh materials with optimization
            if (material.category === 'Wire Mesh') {
                console.log(`[OrderService Debug] Wire Mesh detected: ${material.name}, formulas: ${JSON.stringify(materialLink.formulas)}, formula count: ${materialLink.formulas.length}`);
                
                // Wire Mesh requires special handling with width optimization
                // Check if Wire Mesh has proper formula configuration (need 2 formulas: width and length)
                if (materialLink.formulas.length < 2) {
                    console.warn(`[OrderService] Wire Mesh material "${material.name}" has ${materialLink.formulas.length} formula(s): [${materialLink.formulas.join(', ')}]. Expected 2 formulas: [width_formula, length_formula].`);
                    
                    // Provide fallback for Wire Mesh with insufficient formulas
                    if (materialLink.formulas.length === 1) {
                        console.warn(`[OrderService] Using fallback: treating single formula as area calculation for Wire Mesh "${material.name}".`);
                        
                        // Fallback: treat as regular material with area calculation
                        const formulaResults = materialLink.formulas.map(formulaStr => {
                            const evalResult = formulaEvaluator.evaluateFormula(formulaStr, { W: itemWidthInFormulaUnit, H: itemHeightInFormulaUnit });
                            if (evalResult.error) {
                                throw new AppError(`Formula error for material ${material.name} (Product: ${productType.name}): ${evalResult.error}`, 500);
                            }
                            return Array(finalQuantity).fill(evalResult.result); // Repeats the result for each unit of finalQuantity
                        });

                        const allQuantities = formulaResults.flat();
                        const sumOfQuantities = allQuantities.reduce((sum, qty) => sum + parseFloat(qty.toString()), 0);

                        let materialDetail = { 
                            materialId: material._id,
                            materialNameSnapshot: material.name,
                            materialCategory: material.category,
                            gaugeSnapshot: materialLink.defaultGauge || material.defaultGauge || orderGauge || null,
                            isCutRequired: materialLink.isCutRequired || false,
                            usageUnit: material.usageUnit,
                            calculatedValues: allQuantities,
                            totalQuantity: toDecimal128(sumOfQuantities.toFixed(4)),
                            quantityUnit: material.usageUnit,
                            totalWeight: toDecimal128('0'),
                            weightUnit: 'kg',
                            rawCutsFt: [] // Empty for non-profile materials
                        };

                        calculatedMaterialsArray.push(materialDetail);
                        continue;
                    } else {
                        throw new AppError(`Wire Mesh material "${material.name}" configuration error: Expected 2 formulas for width optimization, got ${materialLink.formulas.length}. Please configure [width_formula, length_formula].`, 500);
                    }
                }

                console.log(`[OrderService Debug] Wire Mesh ${material.name} has ${materialLink.formulas.length} formulas, proceeding with optimization`);
                
                // Wire Mesh has proper 2+ formulas - proceed with optimization
                try {
                    // Evaluate width formula (first formula)
                    const widthFormulaResult = formulaEvaluator.evaluateFormula(materialLink.formulas[0], {
                        W: itemWidthInFormulaUnit,
                        H: itemHeightInFormulaUnit
                    });

                    if (widthFormulaResult.error) {
                        throw new Error(`Width formula error for Wire Mesh ${material.name}: ${widthFormulaResult.error}`);
                    }

                    // Evaluate height formula (second formula)
                    const heightFormulaResult = formulaEvaluator.evaluateFormula(materialLink.formulas[1], {
                        W: itemWidthInFormulaUnit,
                        H: itemHeightInFormulaUnit
                    });

                    if (heightFormulaResult.error) {
                        throw new Error(`Height formula error for Wire Mesh ${material.name}: ${heightFormulaResult.error}`);
                    }

                    const requiredWidth = widthFormulaResult.result;
                    const requiredLength = heightFormulaResult.result;

                    console.log(`[OrderService] Wire Mesh ${material.name}: Required dimensions ${requiredWidth} × ${requiredLength} ${materialLink.formulaInputUnit}`);

                    // Use Wire Mesh optimization service with separate dimensions
                    const optimizationResult = await WireMeshOptimizationService.calculateWireMeshConsumption(
                        material,
                        requiredWidth,   // Calculated width from formula 1
                        requiredLength,  // Calculated height from formula 2
                        materialLink.formulaInputUnit
                    );

                    // Convert to usage unit if needed
                    const finalAreaUnit = material.usageUnit;
                    let finalArea = optimizationResult.actualArea;
                    let finalWastage = optimizationResult.wastageArea;

                    if (optimizationResult.areaUnit !== finalAreaUnit) {
                        const areaConversion = unitConverter.convertUnit(
                            optimizationResult.actualArea,
                            optimizationResult.areaUnit,
                            finalAreaUnit
                        );
                        
                        const wastageConversion = unitConverter.convertUnit(
                            optimizationResult.wastageArea,
                            optimizationResult.areaUnit,
                            finalAreaUnit
                        );

                        if (areaConversion.error || wastageConversion.error) {
                            throw new Error(`Unit conversion error for Wire Mesh ${material.name}: ${areaConversion.error || wastageConversion.error}`);
                        }

                        finalArea = areaConversion.result;
                        finalWastage = wastageConversion.result;
                    }

                    // Multiply by item quantity to get total optimized area
                    const optimizedAreaPerItem = finalArea;
                    const totalOptimizedArea = optimizedAreaPerItem * finalQuantity;

                    // Store Wire Mesh with optimization details
                    let materialDetail = {
                        materialId: material._id,
                        materialNameSnapshot: material.name,
                        materialCategory: material.category,
                        gaugeSnapshot: materialLink.defaultGauge || material.defaultGauge || orderGauge || null,
                        isCutRequired: materialLink.isCutRequired || false,
                        usageUnit: material.usageUnit,
                        calculatedValues: [finalArea], // Store optimized area per item
                        totalQuantity: toDecimal128(totalOptimizedArea.toFixed(4)),
                        quantityUnit: material.usageUnit,
                        totalWeight: toDecimal128('0'),
                        weightUnit: 'kg',
                        rawCutsFt: [], // Empty for non-profile materials
                        // Store optimized wire mesh dimensions for display
                        wireMeshDimensions: {
                            width: optimizationResult.selectedWidth, // Optimized width (from standard width)
                            height: optimizationResult.actualLength || optimizationResult.requiredLength, // Use actualLength if available (handles swapped orientation)
                            unit: materialLink.formulaInputUnit,
                            quantity: finalQuantity,
                            // Store optimization details for debugging
                            optimization: {
                                requiredWidth: optimizationResult.requiredWidth,
                                requiredLength: optimizationResult.requiredLength,
                                selectedWidth: optimizationResult.selectedWidth,
                                actualLength: optimizationResult.actualLength || optimizationResult.requiredLength,
                                efficiency: optimizationResult.efficiency,
                                wastagePercentage: optimizationResult.wastagePercentage,
                                optimizationType: optimizationResult.optimizationType,
                                orientationUsed: optimizationResult.orientationUsed || 'original'
                            }
                        }
                    };

                    console.log(`[OrderService] Wire Mesh ${material.name}: Optimized ${totalOptimizedArea.toFixed(2)} ${finalAreaUnit} (efficiency: ${optimizationResult.efficiency}%, selected width: ${optimizationResult.selectedWidth}${optimizationResult.unit})`);

                    // Check if a detail for this materialId already exists
                    const existingMaterialIndex = calculatedMaterialsArray.findIndex(m => m.materialId.toString() === materialIdString);
                    if (existingMaterialIndex !== -1) {
                        // Merge logic for Wire Mesh: sum totalQuantity and accumulate dimensions
                        const existingDetail = calculatedMaterialsArray[existingMaterialIndex];
                        existingDetail.totalQuantity = toDecimal128((parseFloat(existingDetail.totalQuantity.toString()) + parseFloat(materialDetail.totalQuantity.toString())).toFixed(4));
                        
                        // For wire mesh dimensions, keep the largest dimensions for display
                        if (existingDetail.wireMeshDimensions && materialDetail.wireMeshDimensions) {
                            existingDetail.wireMeshDimensions.quantity += materialDetail.wireMeshDimensions.quantity;
                            // Keep the larger dimensions for display purposes
                            if (materialDetail.wireMeshDimensions.width > existingDetail.wireMeshDimensions.width) {
                                existingDetail.wireMeshDimensions.width = materialDetail.wireMeshDimensions.width;
                                existingDetail.wireMeshDimensions.height = materialDetail.wireMeshDimensions.height;
                            }
                        }
                    } else {
                        calculatedMaterialsArray.push(materialDetail);
                    }

                } catch (optimizationError) {
                    console.error('Wire Mesh optimization error in order service:', optimizationError);
                    throw new AppError(`Wire Mesh optimization failed for ${material.name}: ${optimizationError.message}`, 500);
                }

                continue; // Skip regular material processing for Wire Mesh
            }

            // Regular material processing (non-Wire Mesh)
            const formulaResults = materialLink.formulas.map(formulaStr => {
                const evalResult = formulaEvaluator.evaluateFormula(formulaStr, { W: itemWidthInFormulaUnit, H: itemHeightInFormulaUnit });
                if (evalResult.error) {
                    throw new AppError(`Formula error for material ${material.name} (Product: ${productType.name}): ${evalResult.error}`, 500);
                }
                let evalResultForConversion = evalResult.result;
                let sourceUnitForConversion = materialLink.formulaInputUnit;
                const formulaInputUnitType = unitConverter.getUnitType(materialLink.formulaInputUnit);
                const quantityUnitType = unitConverter.getUnitType(materialLink.quantityUnit);

                if (formulaInputUnitType === 'linear' && quantityUnitType === 'area') {
                    const baseUnit = materialLink.formulaInputUnit.toLowerCase();
                    let potentialSqUnit = '';
                    if (['inches', 'in'].includes(baseUnit)) potentialSqUnit = 'sqin';
                    else if (['feet', 'ft'].includes(baseUnit)) potentialSqUnit = 'sqft';
                    else if (['millimeters', 'mm'].includes(baseUnit)) potentialSqUnit = 'sqmm';
                    else if (['centimeters', 'cm'].includes(baseUnit)) potentialSqUnit = 'sqcm';
                    else if (['meters', 'm'].includes(baseUnit)) potentialSqUnit = 'sqm';
                    if (unitConverter.SUPPORTED_AREA_UNITS.includes(potentialSqUnit)) {
                        sourceUnitForConversion = potentialSqUnit;
                    } else {
                        throw new AppError(`Cannot form valid square unit for material "${material.name}". Linear: '${materialLink.formulaInputUnit}', Area: '${materialLink.quantityUnit}'.`, 500);
                    }
                }

                let resultInUsageUnit = evalResultForConversion;
                if (sourceUnitForConversion.toLowerCase() !== materialLink.quantityUnit.toLowerCase()) {
                    const outputConversion = unitConverter.convertUnit(evalResultForConversion, sourceUnitForConversion, materialLink.quantityUnit);
                    if (outputConversion.error) {
                        throw new AppError(`Formula output unit conversion error: ${outputConversion.error} (Mat: ${material.name}, From: ${sourceUnitForConversion}, To: ${materialLink.quantityUnit})`, 500);
                    }
                    resultInUsageUnit = outputConversion.result;
                }
                if (resultInUsageUnit === null || isNaN(resultInUsageUnit)) {
                     throw new AppError(`Formula output conversion resulted in invalid value for material ${material.name}. From: ${sourceUnitForConversion}, To: ${materialLink.quantityUnit}.`, 500);
                }
                return Array(finalQuantity).fill(resultInUsageUnit); // Repeats the result for each unit of finalQuantity
            });

            const allQuantities = formulaResults.flat(); // these are in material.usageUnit

            let materialDetail = { 
                materialId: material._id,
                materialNameSnapshot: material.name,
                materialCategory: material.category, // Store category for easier access
                gaugeSnapshot: materialLink.defaultGauge || material.defaultGauge || orderGauge || null, // Capture gauge
                isCutRequired: materialLink.isCutRequired || material.category === 'Profile',
                usageUnit: material.usageUnit, // The unit of quantities/cuts calculated so far
                calculatedValues: allQuantities, // Hold temporary calculated values
                totalQuantity: toDecimal128('0'), // Will be calculated based on category
                quantityUnit: material.usageUnit,
                totalWeight: toDecimal128('0'),
                weightUnit: 'kg'
            };

            // Calculate totalQuantity based on material category
            if (material.category === 'Profile') {
                // For profiles, totalQuantity will be set later during cutting optimization (number of pipes)
                materialDetail.quantityUnit = material.usageUnit; // Unit of raw cuts
                
                // Calculate rawCutsFt for profile materials (needed for aggregation)
                materialDetail.rawCutsFt = allQuantities.map(cutLength => {
                    const conversionToFt = unitConverter.convertUnit(parseFloat(cutLength.toString()), material.usageUnit, 'ft');
                    if (conversionToFt.error) {
                        throw new AppError(`Error converting profile cut to feet: ${conversionToFt.error} (Mat: ${material.name}, From: ${material.usageUnit}, Val: ${cutLength})`, 500);
                    }
                    if (conversionToFt.result === null || isNaN(conversionToFt.result) || conversionToFt.result <= 0) {
                         console.warn(`[calculateOrderMaterialDetails] Profile cut ${cutLength} ${material.usageUnit} for ${material.name} resulted in non-positive feet value (${conversionToFt.result} ft). Ignoring.`);
                         return null; // Will be filtered out
                    }
                    return conversionToFt.result;
                }).filter(cutInFt => cutInFt !== null); // Remove nulls from ignored cuts
            } else {
                // For non-profile materials, sum up all calculated quantities
                const sumOfQuantities = allQuantities.reduce((sum, qty) => sum + parseFloat(qty.toString()), 0);
                materialDetail.totalQuantity = toDecimal128(sumOfQuantities.toFixed(4));
                materialDetail.quantityUnit = material.usageUnit;
                materialDetail.rawCutsFt = []; // Empty for non-profile materials
            }
            
            // Check if a detail for this materialId already exists (e.g. if material is used twice in productType with different formulas - rare)
            const existingMaterialIndex = calculatedMaterialsArray.findIndex(m => m.materialId.toString() === materialIdString);
            if (existingMaterialIndex !== -1) {
                // Merge logic: For profiles, append rawCutsFt. For non-profiles, sum totalQuantity & weight.
                const existingDetail = calculatedMaterialsArray[existingMaterialIndex];
                if (material.category === 'Profile') {
                    existingDetail.rawCutsFt.push(...materialDetail.rawCutsFt);
                    existingDetail.calculatedValues.push(...materialDetail.calculatedValues); // Also merge raw values
                } else {
                    existingDetail.totalQuantity = toDecimal128((parseFloat(existingDetail.totalQuantity.toString()) + parseFloat(materialDetail.totalQuantity.toString())).toFixed(4));
                    existingDetail.totalWeight = toDecimal128((parseFloat(existingDetail.totalWeight.toString()) + parseFloat(materialDetail.totalWeight.toString())).toFixed(3), '0.000');
                }
            } else {
                calculatedMaterialsArray.push(materialDetail);
            }
        } // End loop over productType.materials

        // --- Global profile consumption is REMOVED from here ---
        // It will be done by the calling function (prepareOrderDataFromQuotation or updateAndRecalculateOrderItems)
        
        return calculatedMaterialsArray;
    }
}

module.exports = new OrderService(); 