const mongoose = require('mongoose');
const Order = require('../models/Order');
const CuttingPlan = require('../models/CuttingPlan');
const { convertUnit, SUPPORTED_LINEAR_UNITS, getUnitType } = require('../utils/unitConverter');
const { getWeight, convertProfileLengthToWeight } = require('../utils/weightUtils');
const { ProfileCuttingError } = require('../utils/profileCuttingUtil');
const { AppError } = require('../utils/appError');
const Decimal = require('decimal.js');
const MaterialV2 = require('../models/MaterialV2');

const CUTTING_LOSS_INCHES = 0.125;
const EPSILON_INCHES = 0.001;

function toDecimal128(value, errorMessage) {
    try {
        if (value instanceof mongoose.Types.Decimal128) {
            return value;
        }
        const sValue = String(value);
        if (isNaN(parseFloat(sValue))) {
            throw new Error(`Invalid number for Decimal128: ${sValue}`);
        }
        return mongoose.Types.Decimal128.fromString(sValue);
    } catch (e) {
        throw new ProfileCuttingError(errorMessage || `Failed to convert '${value}' to Decimal128: ${e.message}`);
    }
}

/**
 * @description Service for handling cutting optimization logic.
 */
class CuttingOptimizationService {
    constructor() {
        this.KERF_LOSS_INCHES = 0.125; // Standard kerf loss per cut in inches
    }

    /**
     * Helper function to find material in both V2 and V1 systems
     * @param {string} materialId - MaterialV2 ID to search for
     * @param {string} companyId - Company ID for multi-tenancy
     * @returns {Object} MaterialV2 document in V1-compatible format
     */
    static async findMaterialById(materialId, companyId) {
        try {
            // First try to find in V2 system
            const materialV2 = await MaterialV2.findOne({ 
                _id: materialId, 
                companyId: companyId 
            });
            
            if (materialV2) {
                console.log(`[CuttingOptimizationService - findMaterialById] Found V2 MaterialV2: ${materialV2.name} (ID: ${materialV2._id})`);
                console.log(`[CuttingOptimizationService - findMaterialById] materialV2.stockBatches for ${materialV2.name}:`, JSON.stringify(materialV2.stockBatches));
                console.log(`[CuttingOptimizationService - findMaterialById] materialV2.profileBatches for ${materialV2.name}:`, JSON.stringify(materialV2.profileBatches));

                // Determine which batch source to use
                let sourceBatches = [];
                if (materialV2.category === 'Profile' && materialV2.profileBatches && materialV2.profileBatches.length > 0) {
                    console.log(`[CuttingOptimizationService - findMaterialById] Using profileBatches for Profile material ${materialV2.name}`);
                    sourceBatches = materialV2.profileBatches;
                } else if (materialV2.stockBatches && materialV2.stockBatches.length > 0) {
                    console.log(`[CuttingOptimizationService - findMaterialById] Using stockBatches for material ${materialV2.name}`);
                    sourceBatches = materialV2.stockBatches;
                } else {
                    console.log(`[CuttingOptimizationService - findMaterialById] No stockBatches or relevant profileBatches found for ${materialV2.name}`);
                }

                // Convert V2 material to V1-like structure for backward compatibility
                return {
                    _id: materialV2._id,
                    name: materialV2.name,
                    category: materialV2.category,
                    stockUnit: materialV2.stockUnit,
                    usageUnit: materialV2.usageUnit,
                    standardLengths: materialV2.standardLengths || [],
                    gaugeSpecificWeights: materialV2.referenceGaugeWeights?.map(rgw => ({
                        gauge: rgw.gauge,
                        weightPerUnitLength: rgw.referenceWeight,
                        unitLength: rgw.unitLength
                    })) || [],
                    stockByLength: (() => {
                        const consolidatedStock = {};
                        (sourceBatches || []).forEach(batch => {
                            const currentQty = parseFloat(batch.currentQuantity.toString());
                            // Skip batches with zero or negative quantity
                            if (currentQty <= 0) {
                                console.log(`[CuttingOptimizationService] Skipping empty batch: ${batch.length}${batch.lengthUnit}, quantity: ${currentQty}`);
                                return;
                            }
                            
                            const lengthKey = `${batch.length.toString()}_${batch.lengthUnit}`;
                            if (!consolidatedStock[lengthKey]) {
                                consolidatedStock[lengthKey] = {
                                    length: batch.length,
                                    unit: batch.lengthUnit,
                                    quantity: mongoose.Types.Decimal128.fromString('0'),
                                    unitRate: batch.ratePerPiece || mongoose.Types.Decimal128.fromString('0')
                                };
                            }
                            // Add the current batch quantity to the consolidated total
                            const existingQty = parseFloat(consolidatedStock[lengthKey].quantity.toString());
                            consolidatedStock[lengthKey].quantity = mongoose.Types.Decimal128.fromString((existingQty + currentQty).toString());
                        });
                        console.log(`[CuttingOptimizationService] Consolidated stock for ${materialV2.name}:`, Object.values(consolidatedStock).map(s => ({ length: s.length.toString(), unit: s.unit, qty: s.quantity.toString() })));
                        return Object.values(consolidatedStock);
                    })(),
                    weightUnit: 'kg', // Default weight unit for V2 materials
                    companyId: materialV2.companyId,
                    isActive: materialV2.isActive,
                    createdAt: materialV2.createdAt,
                    updatedAt: materialV2.updatedAt
                };
            }
            
            // If not found in V2, try V1 system
            const materialV1 = await MaterialV2.findOne({ 
                _id: materialId, 
                companyId: companyId 
            });
            
            return materialV1;
            
        } catch (error) {
            console.error(`[CuttingOptimizationService] Error finding material ${materialId}:`, error);
            throw new AppError(`Failed to find material: ${error.message}`, 500);
        }
    }

    /**
     * Generates a detailed cutting layout for a single material, considering stock.
     * Adapts logic from profileCuttingUtil.js.
     * @param {object} materialDoc - The Mongoose MaterialV2 document.
     * @param {Array<object>} requiredCutsWithIdentifiers - Array of objects like { length: number, identifier: string } in the material's usageUnit.
     * @param {string} materialUsageUnit - The usage unit of the material (e.g., 'inches', 'ft').
     * @param {string} materialGaugeSnapshot - The gauge of the material for this order.
     * @returns {Promise<object>} - { pipesUsedLayout: [], summary: {} }
     */
    async generateDetailedCuttingLayout(materialDoc, requiredCutsWithIdentifiers, materialUsageUnit, materialGaugeSnapshot) {
        const standardLengths_in = materialDoc.standardLengths.map((sl, index) => {
            const numLength = parseFloat(sl.length.toString());
            const conversion = convertUnit(numLength, sl.unit, 'inches');
            if (conversion.error || conversion.result === null || isNaN(conversion.result) || conversion.result <= EPSILON_INCHES) {
                throw new ProfileCuttingError(`Invalid standard length ${sl.length.toString()} ${sl.unit} for material ${materialDoc.name}: ${conversion.error || 'conversion failed'}.`);
            }
            return {
                originalLengthString: sl.length.toString(),
                originalUnit: sl.unit,
                lengthInInches: conversion.result,
                id: `${sl.length.toString()}_${sl.unit}_${index}`
            };
        }).sort((a, b) => b.lengthInInches - a.lengthInInches);

        if (standardLengths_in.length === 0) {
            throw new ProfileCuttingError(`No valid standard lengths for material ${materialDoc.name}.`);
        }

        let cutsToPlace_in = requiredCutsWithIdentifiers.map((cutItem, index) => {
            const conversion = convertUnit(cutItem.length, materialUsageUnit, 'inches');
            if (conversion.error || conversion.result === null || isNaN(conversion.result) || conversion.result <= EPSILON_INCHES) {
                throw new ProfileCuttingError(`Failed to convert required cut ${cutItem.length} ${materialUsageUnit} (ID: ${cutItem.identifier}) to inches for material ${materialDoc.name} at index ${index}: ${conversion.error || 'conversion failed'}.`);
            }
            return { length: conversion.result, identifier: cutItem.identifier };
        }).sort((a, b) => b.length - a.length); // Sort by length, descending

        console.log(`[CuttingOptimizationService] Cuts to place for ${materialDoc.name} (in inches with identifiers):`, cutsToPlace_in);

        if (cutsToPlace_in.length > 0 && cutsToPlace_in[0].length > standardLengths_in[0].lengthInInches + EPSILON_INCHES) {
            throw new ProfileCuttingError(`Largest cut for ${materialDoc.name} (${(cutsToPlace_in[0].length / 12).toFixed(2)}ft, ID: ${cutsToPlace_in[0].identifier}) is greater than the largest available standard pipe (${(standardLengths_in[0].lengthInInches / 12).toFixed(2)}ft).`);
        }
        
        // Directly map stockByLength and store length as a string
        let availableStock = materialDoc.stockByLength.map(s => ({
            lengthString: s.length.toString(), // Store as string representation
            lengthDecimal: s.length, // Keep original Decimal128 for other uses if needed
            unit: s.unit,
            quantity: parseInt(s.quantity.toString(), 10),
            id: `${s.length.toString()}_${s.unit}` // ID can still use the direct string form
        }));

        console.log(`[CuttingOptimizationService] Available stock for ${materialDoc.name}:`, availableStock.map(s => ({ id: s.id, qty: s.quantity, lenStr: s.lengthString, unit: s.unit })));

        const detailedPipesUsed = [];
        let unfulfillableScrapTotal_in = 0;

        while (cutsToPlace_in.length > 0) {
            let bestPipeChoiceForThisIteration = null;
            let chosenStockEntryId = null;

            for (const candidateStdPipe of standardLengths_in) {
                const stockEntry = availableStock.find(s => 
                    s.lengthString === candidateStdPipe.originalLengthString && 
                    s.unit === candidateStdPipe.originalUnit && 
                    s.quantity > 0
                );

                if (!stockEntry) {
                    console.log(`[CuttingOptimizationService] No stock found for ${candidateStdPipe.originalLengthString} ${candidateStdPipe.originalUnit} of ${materialDoc.name}`);
                    continue;
                }
                
                console.log(`[CuttingOptimizationService] Found stock for ${candidateStdPipe.originalLengthString} ${candidateStdPipe.originalUnit} of ${materialDoc.name}, quantity: ${stockEntry.quantity}`);

                let currentCutsOnCandidate_in = [];
                let currentLengthUsedOnCandidate_in = 0;
                let piecesOnCandidate = 0;
                const cutsToAttemptPacking = [...cutsToPlace_in];

                for (const cutItem of cutsToAttemptPacking) {
                    const lossForThisCut = (piecesOnCandidate > 0) ? CUTTING_LOSS_INCHES : 0;
                    if (currentLengthUsedOnCandidate_in + cutItem.length + lossForThisCut <= candidateStdPipe.lengthInInches + EPSILON_INCHES) {
                        currentLengthUsedOnCandidate_in += (cutItem.length + lossForThisCut);
                        currentCutsOnCandidate_in.push(cutItem);
                        piecesOnCandidate++;
                    }
                }

                if (currentCutsOnCandidate_in.length > 0) {
                    const currentImmediateScrap_in = candidateStdPipe.lengthInInches - currentLengthUsedOnCandidate_in;
                    if (bestPipeChoiceForThisIteration === null || currentImmediateScrap_in < bestPipeChoiceForThisIteration.immediateScrap_in) {
                        bestPipeChoiceForThisIteration = {
                            standardPipeInfo: candidateStdPipe,
                            cutsPacked_in: currentCutsOnCandidate_in,
                            lengthUsedWithLoss_in: currentLengthUsedOnCandidate_in,
                            immediateScrap_in: currentImmediateScrap_in,
                        };
                        chosenStockEntryId = stockEntry.id;
                    }
                }
            }

            if (bestPipeChoiceForThisIteration && chosenStockEntryId) {
                const stockToDecrement = availableStock.find(s => s.id === chosenStockEntryId);
                if (stockToDecrement && stockToDecrement.quantity > 0) {
                    stockToDecrement.quantity--;

                    const cutsMadeForPlan = bestPipeChoiceForThisIteration.cutsPacked_in.map(packedCutItem => {
                        const conversion = convertUnit(packedCutItem.length, 'inches', materialUsageUnit);
                        if (conversion.error || conversion.result === null) {
                             throw new ProfileCuttingError(`Error converting packed cut ${packedCutItem.length} inches (ID: ${packedCutItem.identifier}) back to ${materialUsageUnit} for ${materialDoc.name}`);
                        }
                        return {
                            requiredLength: toDecimal128(conversion.result, `Cut length ${conversion.result} for ${materialDoc.name}`),
                            identifier: packedCutItem.identifier
                        };
                    });

                    const totalCutLengthOnPipe_usageUnit_conv = convertUnit(bestPipeChoiceForThisIteration.lengthUsedWithLoss_in, 'inches', materialUsageUnit);
                     if (totalCutLengthOnPipe_usageUnit_conv.error) throw new ProfileCuttingError(`Error converting total cut length on pipe for ${materialDoc.name}`);
                    const totalCutLengthOnPipe_usageUnit = toDecimal128(totalCutLengthOnPipe_usageUnit_conv.result, `Total cut length on pipe for ${materialDoc.name}`);
                    
                    const scrapLength_usageUnit_conv = convertUnit(bestPipeChoiceForThisIteration.immediateScrap_in, 'inches', materialUsageUnit);
                    if (scrapLength_usageUnit_conv.error) throw new ProfileCuttingError(`Error converting scrap length for ${materialDoc.name}`);
                    const scrapLength_usageUnit = toDecimal128(scrapLength_usageUnit_conv.result,  `Scrap length for ${materialDoc.name}`);

                    let pipeWeight = null;
                    if (materialGaugeSnapshot && materialDoc.weightUnit) {
                         console.log(`[CuttingOptimizationService] Calculating weight for ${materialDoc.name}: gauge='${materialGaugeSnapshot}', weightUnit='${materialDoc.weightUnit}', standardLength='${bestPipeChoiceForThisIteration.standardPipeInfo.originalLengthString}', standardUnit='${bestPipeChoiceForThisIteration.standardPipeInfo.originalUnit}'`);
                         const stdLenForWeightCalc = parseFloat(bestPipeChoiceForThisIteration.standardPipeInfo.originalLengthString);
                         const weightResult = getWeight(materialDoc, materialGaugeSnapshot, stdLenForWeightCalc, bestPipeChoiceForThisIteration.standardPipeInfo.originalUnit);
                         console.log(`[CuttingOptimizationService] Weight result for ${materialDoc.name}:`, weightResult);
                         if (!weightResult.error && weightResult.calculatedWeight) {
                            pipeWeight = toDecimal128(weightResult.calculatedWeight, `Pipe weight for ${materialDoc.name}`);
                         } else {
                            console.warn(`Could not calculate weight for pipe of ${materialDoc.name}, gauge ${materialGaugeSnapshot}: ${weightResult.error}`);
                         }
                    }
                    
                    detailedPipesUsed.push({
                        standardLength: toDecimal128(bestPipeChoiceForThisIteration.standardPipeInfo.originalLengthString, `Standard length ${bestPipeChoiceForThisIteration.standardPipeInfo.originalLengthString} for ${materialDoc.name}`),
                        standardLengthUnit: bestPipeChoiceForThisIteration.standardPipeInfo.originalUnit,
                        cutsMade: cutsMadeForPlan,
                        totalCutLengthOnPipe: totalCutLengthOnPipe_usageUnit,
                        scrapLength: scrapLength_usageUnit,
                        calculatedWeight: pipeWeight,
                    });

                    for (const packedCutItem of bestPipeChoiceForThisIteration.cutsPacked_in) {
                        // Find and remove the first occurrence of this cut (match by length and identifier if possible, or just length)
                        const indexToRemove = cutsToPlace_in.findIndex(c => 
                            Math.abs(c.length - packedCutItem.length) < EPSILON_INCHES && 
                            (c.identifier === packedCutItem.identifier || !c.identifier) // Looser match if original identifier was missing
                        );
                        if (indexToRemove > -1) {
                            cutsToPlace_in.splice(indexToRemove, 1);
                        }
                    }
                } else {
                     console.warn(`[CuttingOptimizationService] Stock for ${chosenStockEntryId} was unexpectedly unavailable for decrementing.`);
                     bestPipeChoiceForThisIteration = null;
                }
            }
            
            if (!bestPipeChoiceForThisIteration && cutsToPlace_in.length > 0) {
                const largestRemainingCut_in = cutsToPlace_in.shift();
                unfulfillableScrapTotal_in += largestRemainingCut_in.length;
                console.error(`[CuttingOptimizationService] INSUFFICIENT STOCK: Cannot fulfill cut for ${materialDoc.name}: ${largestRemainingCut_in.length.toFixed(2)}in (identifier: ${largestRemainingCut_in.identifier})`);
                
                // Collect all unfulfillable cuts
                const allUnfulfillableCuts = [largestRemainingCut_in, ...cutsToPlace_in];
                
                // Clear the remaining cuts array since we're going to throw an error
                cutsToPlace_in.length = 0;
                
                // Convert unfulfillable cuts to display format
                const unfulfillableCutsDisplay = allUnfulfillableCuts.map(cut => {
                    const conversionResult = convertUnit(cut.length, 'inches', materialUsageUnit);
                    const displayLength = conversionResult.error ? 
                        cut.length.toFixed(2) + ' in' : 
                        conversionResult.result.toFixed(2) + ' ' + materialUsageUnit;
                    return `${displayLength} (${cut.identifier})`;
                }).join(', ');
                
                throw new ProfileCuttingError(
                    `Insufficient stock available for material "${materialDoc.name}". ` +
                    `Cannot fulfill the following cuts: ${unfulfillableCutsDisplay}. ` +
                    `Please ensure adequate stock is available before optimizing cuts.`
                );
            }
        }

        const pipesTakenCounts = {};
        let totalWeightForAllPipes_D = new Decimal('0.00');

        detailedPipesUsed.forEach(pipe => {
            console.log(`[CuttingOptimizationService] Aggregating weight for pipe of ${pipe.standardLength.toString()} ${pipe.standardLengthUnit}. Calculated weight: ${pipe.calculatedWeight ? pipe.calculatedWeight.toString() : 'null'}`);
            const key = `${pipe.standardLength.toString()}_${pipe.standardLengthUnit}`;
            if (!pipesTakenCounts[key]) {
                pipesTakenCounts[key] = {
                    length: parseFloat(pipe.standardLength.toString()),
                    unit: pipe.standardLengthUnit,
                    quantity: 0,
                    totalScrapOnThesePipes: toDecimal128('0.00')
                };
            }
            pipesTakenCounts[key].quantity++;
            pipesTakenCounts[key].totalScrapOnThesePipes = toDecimal128(
                parseFloat(pipesTakenCounts[key].totalScrapOnThesePipes.toString()) + 
                parseFloat(pipe.scrapLength.toString())
            );
            if(pipe.calculatedWeight) {
                 const pipeWeight_D = new Decimal(pipe.calculatedWeight.toString());
                 totalWeightForAllPipes_D = totalWeightForAllPipes_D.plus(pipeWeight_D);
            }
        });
        
        const unfulfillableScrap_usageUnit_conv = convertUnit(unfulfillableScrapTotal_in, 'inches', materialUsageUnit);
        if (unfulfillableScrap_usageUnit_conv.error) console.warn(`Error converting unfulfillable scrap for ${materialDoc.name}`);
        const unfulfillableScrap_usageUnit = toDecimal128(unfulfillableScrap_usageUnit_conv.result || '0', `Unfulfillable scrap for ${materialDoc.name}`);

        if (detailedPipesUsed.length > 0 && unfulfillableScrapTotal_in > EPSILON_INCHES) {
             const firstPipeKey = `${detailedPipesUsed[0].standardLength.toString()}_${detailedPipesUsed[0].standardLengthUnit}`;
             if(pipesTakenCounts[firstPipeKey]) {
                pipesTakenCounts[firstPipeKey].totalScrapOnThesePipes = toDecimal128(
                    parseFloat(pipesTakenCounts[firstPipeKey].totalScrapOnThesePipes.toString()) +
                    parseFloat(unfulfillableScrap_usageUnit.toString())
                );
             }
        }

        const summaryTotalPipesPerLength = Object.values(pipesTakenCounts).map(pt => ({
            length: pt.length,
            unit: pt.unit,
            quantity: pt.quantity,
            totalScrap: pt.totalScrapOnThesePipes,
            scrapUnit: materialUsageUnit // Add scrap unit explicitly using material's usage unit
        }));

        return {
            pipesUsedLayout: detailedPipesUsed,
            summary: {
                totalPipesPerLength: summaryTotalPipesPerLength,
                totalWeight: toDecimal128(totalWeightForAllPipes_D.toString())
            }
        };
    }

    /**
     * Optimizes cuts for a given order.
     * @param {string} orderId - The ID of the order to optimize.
     * @param {string} companyId - The ID of the company.
     * @param {string} userId - The ID of the user performing the operation.
     * @returns {Promise<object>} The created CuttingPlan document.
     */
    async optimizeCuts(orderId, companyId, userId) {
        const order = await Order.findById(orderId);
        if (!order) {
            throw new AppError(`Order not found: ${orderId}`, 404);
        }

        // DEBUG: Log the full order structure to understand the issue
        console.log(`[CuttingOptimizationService - DEBUG] Processing order ${order.orderIdDisplay}:`);
        console.log(`[CuttingOptimizationService - DEBUG] Order items count: ${order.items.length}`);
        order.items.forEach((item, index) => {
            console.log(`[CuttingOptimizationService - DEBUG] Item ${index}:`, {
                productTypeNameSnapshot: item.productTypeNameSnapshot,
                finalQuantity: item.finalQuantity,
                requiredMaterialCutsCount: item.requiredMaterialCuts ? item.requiredMaterialCuts.length : 0
            });
            if (item.requiredMaterialCuts) {
                item.requiredMaterialCuts.forEach((cut, cutIndex) => {
                    console.log(`[CuttingOptimizationService - DEBUG] Item ${index} - Cut ${cutIndex}:`, {
                        materialNameSnapshot: cut.materialNameSnapshot,
                        cutLengthsCount: cut.cutLengths ? cut.cutLengths.length : 0,
                        cutLengths: cut.cutLengths,
                        lengthUnit: cut.lengthUnit,
                        isCutRequired: cut.isCutRequired
                    });
                });
            }
        });

        // Ensure order is in a state that allows optimization
        if (order.cuttingPlanStatus === 'Committed') {
            throw new AppError('A cutting plan has already been committed for this order. Re-optimization is not allowed unless the commitment is reverted.', 400);
        }
        // Add other status checks if necessary, e.g. order.status

        // If a previous, uncommitted cutting plan exists, remove it.
        // This ensures the unique index on CuttingPlan (orderId) is not violated.
        // Note: In theory, there should only be one, but we'll handle the case where there might be multiple due to race conditions or data inconsistencies.
        const existingUncommittedPlans = await CuttingPlan.find({ orderId: order._id, status: { $ne: 'Committed' } });
        if (existingUncommittedPlans.length > 0) {
            console.log(`[CuttingOptimizationService] Found ${existingUncommittedPlans.length} existing uncommitted cutting plan(s) for order ${orderId}. Removing them before generating a new one.`);
            
            for (const plan of existingUncommittedPlans) {
                console.log(`[CuttingOptimizationService] Removing cutting plan ${plan._id} (status: ${plan.status}) for order ${orderId}.`);
                await CuttingPlan.findByIdAndDelete(plan._id);
            }
            
            // Also ensure the order's cuttingPlanId is cleared if it pointed to any of these old plans
            if (order.cuttingPlanId) {
                const deletedPlanIds = existingUncommittedPlans.map(p => p._id.toString());
                if (deletedPlanIds.includes(order.cuttingPlanId.toString())) {
                    console.log(`[CuttingOptimizationService] Clearing order.cuttingPlanId as it pointed to a deleted plan.`);
                    order.cuttingPlanId = null;
                    // order.cuttingPlanStatus will be updated later when the new plan is created
                }
            }
        }
        // At this point, there should be no uncommitted cutting plans for this order

        // Extract all required material cuts from the order
        const materialPlans = [];
        
        // First, collect all materials and their cuts across all items
        const materialCutsMap = new Map(); // materialId -> { cutReq, allCutLengths: [] }

        // Process each item to track window associations properly
        order.items.forEach((item, itemIndex) => {
            if (!item.requiredMaterialCuts || !item.requiredMaterialCuts.length) return;
            
            const itemLabel = item.itemLabel || `Window ${itemIndex + 1}`;
            
            item.requiredMaterialCuts.forEach(cutReq => {
                console.log(`[CuttingOptimizationService - DEBUG] Checking cutReq for material ${cutReq.materialNameSnapshot} in ${itemLabel}:`, {
                    isCutRequired: cutReq.isCutRequired,
                    materialId: cutReq.materialId.toString(),
                    cutLengthsCount: cutReq.cutLengths ? cutReq.cutLengths.length : 0
                });
                
                // Check if material should be processed - either explicitly marked as cut required 
                // OR has actual cut lengths (which indicates it's a profile that should be optimized)
                const hasCutLengths = cutReq.cutLengths && cutReq.cutLengths.length > 0;
                const shouldProcess = cutReq.isCutRequired || hasCutLengths;
                
                if (!shouldProcess) {
                    console.log(`[CuttingOptimizationService - DEBUG] Skipping material ${cutReq.materialNameSnapshot} in ${itemLabel}: isCutRequired=${cutReq.isCutRequired}, hasCutLengths=${hasCutLengths}, shouldProcess=${shouldProcess}`);
                    return;
                }

                const materialIdStr = cutReq.materialId.toString();
                
                // Collect cuts for this material
                if (!materialCutsMap.has(materialIdStr)) {
                    materialCutsMap.set(materialIdStr, {
                        cutReq: cutReq,
                        allCutLengths: []
                    });
                }
                
                // Add the cut lengths from this cutReq to the accumulated cuts with proper window label
                if (cutReq.cutLengths && Array.isArray(cutReq.cutLengths)) {
                    cutReq.cutLengths.forEach(cl => {
                        materialCutsMap.get(materialIdStr).allCutLengths.push({
                            length: cl,
                            lengthUnit: cutReq.lengthUnit,
                            materialNameSnapshot: cutReq.materialNameSnapshot,
                            itemLabel: itemLabel
                        });
                    });
                }
            });
        });

        console.log(`[CuttingOptimizationService - DEBUG] Collected materials for processing:`, 
            Array.from(materialCutsMap.keys()).map(materialId => {
                const data = materialCutsMap.get(materialId);
                return {
                    materialId,
                    materialName: data.cutReq.materialNameSnapshot,
                    totalCuts: data.allCutLengths.length
                };
            })
        );

        // Now process each unique material with all its accumulated cuts
        for (const [materialIdStr, materialData] of materialCutsMap) {
            const cutReq = materialData.cutReq;
            const allCutLengths = materialData.allCutLengths;

            console.log(`[CuttingOptimizationService - DEBUG] Processing material ${cutReq.materialNameSnapshot} with ${allCutLengths.length} total cuts`);

            const material = await CuttingOptimizationService.findMaterialById(cutReq.materialId, companyId);
            if (!material) {
                throw new AppError(`MaterialV2 details not found for ID: ${cutReq.materialId} (${cutReq.materialNameSnapshot}).`, 404);
            }

            console.log(`[CuttingOptimizationService - DEBUG] MaterialV2 ${material.name} (ID: ${material._id}) stockByLength from findMaterialById:`, JSON.stringify(material.stockByLength));

            // Convert all lengths to inches for standardization
            const standardLengths = material.stockByLength.map(stock => {
                console.log(`[CuttingOptimizationService - DEBUG] Processing stock entry for ${material.name}:`, JSON.stringify(stock));
                const numericStockLength = parseFloat(stock.length.toString());
                const conversionToInches = convertUnit(numericStockLength, stock.unit, 'inches'); // Target 'inches'
                console.log(`[CuttingOptimizationService - DEBUG] Conversion for ${material.name} - ${numericStockLength} ${stock.unit} to inches:`, JSON.stringify(conversionToInches));

                if (conversionToInches.error || conversionToInches.result === null || isNaN(conversionToInches.result)){
                    console.error(`[CuttingOptimizationService] Error converting stock length ${stock.length.toString()} ${stock.unit} to inches for material ${material.name}. Error: ${conversionToInches.error || 'NaN result'}`);
                    return { length: null, quantity: 0, originalUnit: stock.unit, error: 'StockConversionError' }; // Mark as problematic
                }
                return {
                    length: conversionToInches.result, // Already a number
                    quantity: parseInt(stock.quantity.toString()),
                    originalUnit: stock.unit
                };
            })
            .filter(stock => stock && stock.length !== null && stock.quantity > 0); // Filter out problematic or zero-quantity stock

            console.log(`[CuttingOptimizationService - DEBUG] Effective standardLengths for ${material.name} after mapping and filtering (used for optimization):`, JSON.stringify(standardLengths));

            if (!standardLengths.length) {
                // Check if there was stockByLength initially but all failed conversion or had zero quantity
                if (material.stockByLength && material.stockByLength.length > 0) {
                     console.error(`[CuttingOptimizationService] All stock for material ${material.name} (ID: ${material._id}) failed conversion to inches or had zero quantity.`);
                     throw new ProfileCuttingError(`All available stock for ${material.name} could not be processed or has zero quantity. Please check material stock setup and units.`);
                }
                throw new ProfileCuttingError(`Insufficient stock or no suitable standard lengths available for ${material.name} to meet required cuts (after processing stock data).`);
            }

            // Collect all cuts needed for this material across all items
            const allCutsForMaterial = allCutLengths.map(cutData => {
                console.log(`[CuttingOptimizationService - DEBUG] Processing material cuts for ${cutData.materialNameSnapshot}:`, {
                    cutLength: cutData.length,
                    lengthUnit: cutData.lengthUnit,
                    cutLengthType: typeof cutData.length,
                    itemLabel: cutData.itemLabel
                });
                
                const lengthStr = cutData.length ? cutData.length.toString() : null;
                const lengthUnit = cutData.lengthUnit;

                console.log(`[CuttingOptimizationService - DEBUG] Processing individual cut:`, {
                    lengthInput: cutData.length,
                    lengthStr,
                    lengthUnit,
                    lengthInputType: typeof cutData.length
                });

                if (lengthStr === null || lengthStr.trim() === '' || isNaN(parseFloat(lengthStr))) {
                    console.error(`[CuttingOptimizationService] Invalid or empty lengthStr found: '${lengthStr}' for material ${cutData.materialNameSnapshot}, order ${order.orderIdDisplay}. Skipping this cut.`);
                    return { length: null, originalLength: cutData.length, originalUnit: lengthUnit, error: 'InvalidLengthInput' };
                }

                const numericLength = parseFloat(lengthStr);
                console.log(`[CuttingOptimizationService - DEBUG] Numeric length: ${numericLength}, lengthUnit: '${lengthUnit}' for material ${cutData.materialNameSnapshot}`);

                if (!lengthUnit || typeof lengthUnit !== 'string' || lengthUnit.trim() === '') {
                    console.error(`[CuttingOptimizationService] Invalid or missing lengthUnit: '${lengthUnit}' for material ${cutData.materialNameSnapshot}, order ${order.orderIdDisplay}. Skipping this cut.`);
                    return { length: null, originalLength: cutData.length, originalUnit: lengthUnit, error: 'InvalidLengthUnit' };
                }
                
                // Call convertUnit with a number
                const conversionResult = convertUnit(numericLength, lengthUnit, 'inches');
                
                console.log(`[CuttingOptimizationService - DEBUG] Unit conversion result:`, {
                    input: numericLength,
                    inputUnit: lengthUnit,
                    targetUnit: 'inches',
                    result: conversionResult.result,
                    error: conversionResult.error
                });
                
                if (conversionResult.error || conversionResult.result === null || isNaN(conversionResult.result)) {
                    console.error(`[CuttingOptimizationService] Unit conversion failed or resulted in NaN for cut. Input: ${numericLength} ${lengthUnit}, MaterialV2: ${cutData.materialNameSnapshot}, Order: ${order.orderIdDisplay}. Error: ${conversionResult.error || 'NaN result'}`);
                    return { length: null, originalLength: cutData.length, originalUnit: lengthUnit, error: `ConversionError: ${conversionResult.error || 'NaN result'}` };
                }

                const lengthInInches = conversionResult.result;

                return {
                    length: lengthInInches,
                    originalLength: cutData.length, 
                    originalUnit: lengthUnit
                };
            }).filter(cut => cut && cut.length !== null && !isNaN(cut.length));

            console.log(`[CuttingOptimizationService - DEBUG] allCutsForMaterial after processing for ${material.name}:`, {
                totalCuts: allCutsForMaterial.length,
                cuts: allCutsForMaterial.map(c => ({ length: c.length, originalLength: c.originalLength, originalUnit: c.originalUnit }))
            });

            // After filtering, if allCutsForMaterial is empty, it means all cuts had issues.
            if (allCutsForMaterial.length === 0 && order.items.flatMap(i => i.requiredMaterialCuts).filter(mc => mc.materialId.toString() === cutReq.materialId.toString()).flatMap(mc => mc.cutLengths).length > 0) {
                 console.error(`[CuttingOptimizationService] All cuts for material ${cutReq.materialNameSnapshot} (ID: ${cutReq.materialId}) in order ${order.orderIdDisplay} resulted in errors during processing/conversion. Cannot optimize.`);
                 throw new ProfileCuttingError(`All cuts for material ${cutReq.materialNameSnapshot} resulted in errors and could not be processed for optimization. Please check order data and material formulas.`);
            }

            if (allCutsForMaterial.length === 0) { // No valid cuts to process for this material
                continue; // Move to the next material
            }

            // Check if any cut is longer than available stock
            const longestStockLength = Math.max(...standardLengths.map(s => s.length));
            const longestCut = Math.max(...allCutsForMaterial.map(c => c.length));
            
            if (longestCut > longestStockLength) {
                throw new ProfileCuttingError(
                    `Insufficient stock or no suitable standard lengths available for ${material.name} to meet required cuts. ` +
                    `One or more cuts (e.g., ${longestCut.toFixed(2)} in) are longer than any available stock length.`
                );
            }

            // Sort cuts in descending order for first-fit decreasing algorithm
            allCutsForMaterial.sort((a, b) => b.length - a.length);

            // Convert cuts back to the material's usage unit for the detailed layout generator
            const cutsInMaterialUnit = allCutsForMaterial.map(cut => {
                const conversionResult = convertUnit(cut.length, 'inches', material.usageUnit);
                if (conversionResult.error || conversionResult.result === null) {
                    console.error(`[CuttingOptimizationService] Error converting cut ${cut.length} inches back to ${material.usageUnit} for ${material.name}`);
                    return cut.length; // Fallback to inches value
                }
                return conversionResult.result;
            });

            // Collect all cuts with their identifiers for the current material
            const requiredCutsWithIdentifiersForMaterial = [];
            order.items.forEach(orderItem => {
                if (orderItem.requiredMaterialCuts && Array.isArray(orderItem.requiredMaterialCuts)) {
                    orderItem.requiredMaterialCuts.forEach(materialCutEntry => {
                        if (materialCutEntry.materialId.toString() === material._id.toString()) {
                            if (materialCutEntry.cutLengths && Array.isArray(materialCutEntry.cutLengths)) {
                                materialCutEntry.cutLengths.forEach(cutLengthValue => {
                                    const len = parseFloat(cutLengthValue.toString());
                                    if (len > 0) {
                                        // Repeat the cut for the quantity of the parent orderItem
                                        for (let i = 0; i < orderItem.quantity; i++) {
                                            requiredCutsWithIdentifiersForMaterial.push({
                                                length: len, // This should be in the material's usageUnit as per original design
                                                identifier: orderItem.itemIdentifier || `Item ${orderItem.productNameSnapshot || 'Unnamed'}`,
                                                // We need to ensure 'length' is in material.usageUnit here before passing to generateDetailedCuttingLayout
                                                // The original logic converted allCutsForMaterial to inches, then back to material.usageUnit.
                                                // This new collection needs to align with that expectation.
                                            });
                                        }
                                    }
                                });
                            }
                        }
                    });
                }
            });

            // The original logic converted all cuts to inches, then sorted, then converted back to material.usageUnit for generateDetailedCuttingLayout.
            // We need to ensure `requiredCutsWithIdentifiersForMaterial` lengths are in `material.usageUnit`.
            // The `materialCutEntry.cutLengths` are assumed to be in `materialCutEntry.lengthUnit`.
            // Let's refine this to ensure correct unit handling before passing to generateDetailedCuttingLayout.

            const finalCutsForLayout = [];
            allCutLengths.forEach((cutData, index) => {
                const rawLength = parseFloat(cutData.length.toString());
                if (rawLength > 0) {
                    const conversionToUsageUnit = convertUnit(rawLength, cutData.lengthUnit, material.usageUnit);
                    if (conversionToUsageUnit.error || conversionToUsageUnit.result === null) {
                        console.error(`Error converting cut length ${rawLength} ${cutData.lengthUnit} to ${material.usageUnit} for ${material.name}`);
                        // Skip this cut if conversion fails
                        return;
                    }
                    const lengthInUsageUnit = conversionToUsageUnit.result;

                    finalCutsForLayout.push({
                        length: lengthInUsageUnit,
                        identifier: cutData.itemLabel || `Cut ${index + 1}`
                    });
                }
            });

            console.log(`[CuttingOptimizationService - DEBUG] finalCutsForLayout for ${material.name}:`, {
                totalCuts: finalCutsForLayout.length,
                cuts: finalCutsForLayout.map(c => ({ length: c.length, identifier: c.identifier }))
            });

            if (finalCutsForLayout.length === 0) {
                console.log(`[CuttingOptimizationService - optimizeCuts] No valid cuts required for material ${material.name} after processing and unit conversion. Skipping layout generation.`);
                continue; // Move to the next material
            }

            // Filter out cuts for this material that have already been processed if the material appears multiple times with different gauges
            // This part is tricky if the same materialId is used for multiple cutReqs. For now, assume each materialId is unique per optimization run.

            console.log(`[CuttingOptimizationService - optimizeCuts] Preparing to generate layout for ${material.name}. Gauge from cutReq: '${cutReq.gaugeSnapshot}', MaterialV2's own weightUnit: '${material.weightUnit}'`);
            console.log(`[CuttingOptimizationService - optimizeCuts] Final cuts for layout (in ${material.usageUnit}) for ${material.name}:`, finalCutsForLayout);

            // Use the detailed cutting layout generator
            const layoutResult = await this.generateDetailedCuttingLayout(
                material,
                finalCutsForLayout, // This now contains lengths in material.usageUnit
                material.usageUnit,
                cutReq.gaugeSnapshot
            );

            // Add material plan with detailed summary
            materialPlans.push({
                materialId: material._id,
                materialNameSnapshot: material.name,
                gaugeSnapshot: cutReq.gaugeSnapshot,
                usageUnit: material.usageUnit,
                pipesUsed: layoutResult.pipesUsedLayout,
                totalPipesPerLength: layoutResult.summary.totalPipesPerLength,
                totalWeight: layoutResult.summary.totalWeight
            });
        }

        console.log(`[CuttingOptimizationService] Finished processing all materials. Creating cutting plan with ${materialPlans.length} material plans.`);

        // Create the cutting plan
        const newCuttingPlan = await CuttingPlan.create({
            orderId: order._id,
            orderIdDisplay: order.orderIdDisplay,
            companyId,
            generatedBy: userId,
            materialPlans,
            summary: {
                totalWeight: mongoose.Types.Decimal128.fromString('0'),
                totalScrapWeight: mongoose.Types.Decimal128.fromString('0')
            },
            status: 'Generated' // Explicitly set status on creation
        });

        console.log(`[CuttingOptimizationService] Successfully created cutting plan with ID: ${newCuttingPlan._id}`);

        // Update the order with the new cutting plan ID and status
        order.cuttingPlanId = newCuttingPlan._id;
        order.cuttingPlanStatus = 'Generated';
        // Potentially update order.status to 'Optimization Complete' if not already handled by controller
        if (order.status === 'Ready for Optimization' || order.status === 'Optimization Failed') {
            order.status = 'Optimization Complete';
        }
        await order.save(); // Save changes to the order document

        console.log(`[CuttingOptimizationService] Successfully updated order ${order.orderIdDisplay} with cutting plan ID and status`);

        return newCuttingPlan;
    }

    /**
     * Helper function to convert units.
     * @param {number} value - The value to convert.
     * @param {string} fromUnit - The unit to convert from.
     * @param {string} toUnit - The unit to convert to.
     * @returns {{result: number|null, error: string|null}} Conversion result.
     */
    convertUnits(value, fromUnit, toUnit) {
        return convertUnit(value, fromUnit, toUnit);
    }

    /**
     * Helper function to calculate weight of a material cut.
     * @param {object} material - The material object.
     * @param {string} gauge - The gauge of the material.
     * @param {number|string} cutLength - The length of the cut.
     * @param {string} cutLengthUnit - The unit of the cut length.
     * @returns {object} Calculated weight and unit or error.
     */
    calculateWeight(material, gauge, cutLength, cutLengthUnit) {
        return getWeight(material, gauge, cutLength, cutLengthUnit);
    }

     /**
     * Converts a given length of a profile material to its equivalent weight.
     * @param {number} length The length of the material.
     * @param {string} lengthUnit The unit of the input length.
     * @param {object} material The inventory material object.
     * @param {string} gauge The specific gauge of the profile material.
     * @returns {{weight: number|null, weightUnit: string|null, error: string|null}} Result.
     */
    calculateProfileLengthToWeight(length, lengthUnit, material, gauge) {
        return convertProfileLengthToWeight(length, lengthUnit, material, gauge);
    }
}

module.exports = CuttingOptimizationService;