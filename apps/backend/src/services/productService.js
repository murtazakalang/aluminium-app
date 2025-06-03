const ProductType = require('../models/ProductType');
const MaterialV2 = require('../models/MaterialV2');
const { calculateProfileConsumption } = require('../utils/profileCuttingUtil');
const { evaluateFormula } = require('../utils/formulaEvaluator'); // Using your existing safe evaluator
const mongoose = require('mongoose');
const WireMeshOptimizationService = require('./wireMeshOptimizationService');

// Helper to evaluate a list of cut formulas
function evaluateCutListFormulas(formulaArray, variables /*, inputUnit - if needed for future conversion */) {
    if (!Array.isArray(formulaArray)) {
        // Handle case where formulas might not be an array (e.g. old data or single formula string)
        if (typeof formulaArray === 'string') { // If it's a single formula string for a cut
            const evalResult = evaluateFormula(formulaArray, variables);
            if (evalResult.error) throw new Error(evalResult.error);
            return [evalResult.result];
        }
        throw new Error('Formulas for cut list must be an array of strings.');
    }
    const results = [];
    for (const formulaStr of formulaArray) {
        const evalResult = evaluateFormula(formulaStr, variables);
        if (evalResult.error) {
            throw new Error(`Error in formula "${formulaStr}": ${evalResult.error}`);
        }
        if (evalResult.result == null) { // Check for null explicitly if evaluateFormula can return it
             throw new Error(`Formula "${formulaStr}" evaluated to null or undefined.`);
        }
        results.push(evalResult.result);
    }
    return results;
}


async function getUnitCostOfStandardPipe(materialDoc) {
    // materialDoc is assumed to be a populated MaterialV2 document
    if (!materialDoc || materialDoc.category !== 'Profile' || !materialDoc.standardLengths || materialDoc.standardLengths.length === 0) {
        throw new Error(`Invalid material or missing standard length for cost calculation (ID: ${materialDoc ? materialDoc._id : 'unknown'}).`);
    }

    const primaryStandardLengthValue = parseFloat(materialDoc.standardLengths[0].length.toString());
    const primaryStandardLengthUnit = materialDoc.standardLengths[0].unit;

    if (materialDoc.stockByLength && materialDoc.stockByLength.length > 0) {
        const stockEntry = materialDoc.stockByLength.find(
            sbl => parseFloat(sbl.length.toString()) === primaryStandardLengthValue && sbl.unit === primaryStandardLengthUnit
        );
        if (stockEntry && stockEntry.unitRate != null) {
            const rate = parseFloat(stockEntry.unitRate.toString());
            if (isNaN(rate) || rate < 0) { // Added check for valid rate
                throw new Error(`Invalid unit rate found for standard pipe length ${primaryStandardLengthValue}${primaryStandardLengthUnit} for material ${materialDoc.name}.`);
            }
            return rate;
        }
    }
    throw new Error(`Unit rate for standard pipe length ${primaryStandardLengthValue}${primaryStandardLengthUnit} not found in stockByLength for material ${materialDoc.name}.`);
}

/**
 * Calculates the estimated cost of a product given its ID and dimensions.
 */
async function calculateProductCost(productId, companyId, width, height) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
        throw new Error('Invalid Product ID format.');
    }
    const product = await ProductType.findOne({ _id: productId, companyId: companyId.toString() })
        .populate({
            path: 'materials.materialId', // Populate the material document
            model: 'MaterialV2'
        });

    if (!product) {
        throw new Error(`Product not found with ID ${productId} for the given company.`);
    }

    let totalEstimatedCost = 0;
    const materialBreakdown = [];

    for (const matLink of product.materials) {
        const material = matLink.materialId; // This is the populated MaterialV2 document
        
        if (!material) {
            console.warn(`MaterialV2 data missing for linked ID in product ${product.name}. MaterialV2 link details: ${JSON.stringify(matLink)}`);
            materialBreakdown.push({
                name: `Unknown MaterialV2 (Original Link ID: ${matLink.materialId_placeholder || matLink._id?.toString() || 'unknown'})`, // Attempt to get original ID if population failed
                cost: 0,
                error: 'Linked material data could not be loaded.',
            });
            continue;
        }

        let materialCost = 0;
        let currentMaterialDetails = { // Common details for the breakdown
            materialDbId: material._id,
            name: material.name,
            category: material.category,
            cost: 0,
        };

        try {
            const formulaVariables = { W: width, H: height };
            // TODO: Consider inputUnit from matLink.inputUnit or product.defaultInputUnit for formulaVariables if they need conversion
            // For now, assuming W, H are passed in units expected by formulas.

            if (material.category === 'Profile') {
                const requiredCutLengths_ft = evaluateCutListFormulas(
                    matLink.formulas,
                    formulaVariables
                );

                if (!requiredCutLengths_ft || requiredCutLengths_ft.length === 0) {
                    currentMaterialDetails.notes = 'No cuts required by formula for these dimensions.';
                    materialBreakdown.push(currentMaterialDetails);
                    continue;
                }

                const unitCostPerStandardPipe = await getUnitCostOfStandardPipe(material);

                const consumptionDetails = await calculateProfileConsumption(
                    material._id.toString(),
                    companyId.toString(),
                    requiredCutLengths_ft
                );
                materialCost = consumptionDetails.pipesTakenFromStock * unitCostPerStandardPipe;

                Object.assign(currentMaterialDetails, {
                    cost: parseFloat(materialCost.toFixed(2)),
                    pipesUsed: consumptionDetails.pipesTakenFromStock,
                    scrapGenerated_ft: consumptionDetails.totalScrapGenerated_ft,
                    finalUsableOffcuts_ft: consumptionDetails.finalUsableOffcuts_ft,
                    requiredCuts_ft: requiredCutLengths_ft,
                    costPerPipe: unitCostPerStandardPipe
                });

            } else if (material.category === 'Wire Mesh') {
                // Handle Wire Mesh with width optimization
                if (!matLink.formulas || matLink.formulas.length < 2) {
                    currentMaterialDetails.error = `Wire Mesh material ${material.name} requires exactly 2 formulas: [width_formula, length_formula].`;
                    materialBreakdown.push(currentMaterialDetails);
                    continue;
                }

                // Evaluate width and length formulas separately
                const widthFormulaResult = evaluateFormula(matLink.formulas[0], formulaVariables);
                const lengthFormulaResult = evaluateFormula(matLink.formulas[1], formulaVariables);

                if (widthFormulaResult.error || lengthFormulaResult.error) {
                    currentMaterialDetails.error = `Formula error for Wire Mesh ${material.name}: ${widthFormulaResult.error || lengthFormulaResult.error}`;
                    materialBreakdown.push(currentMaterialDetails);
                    continue;
                }

                try {
                    // Use Wire Mesh optimization service
                    const optimizationResult = await WireMeshOptimizationService.processWireMeshFormula(
                        material,
                        {
                            width: widthFormulaResult.result,
                            length: lengthFormulaResult.result
                        },
                        'ft' // Assuming formulas work in feet, adjust as needed
                    );

                    // Calculate cost based on actual area (including wastage)
                    const rate = material.unitRateForStockUnit ? parseFloat(material.unitRateForStockUnit.toString()) : 0;
                    materialCost = optimizationResult.finalQuantity * rate;

                    Object.assign(currentMaterialDetails, {
                        cost: parseFloat(materialCost.toFixed(2)),
                        quantityRequired: optimizationResult.finalQuantity,
                        quantityUnit: optimizationResult.finalUnit,
                        rate: rate,
                        // Wire Mesh specific optimization details
                        optimizationDetails: {
                            requiredWidth: optimizationResult.requiredWidth,
                            requiredLength: optimizationResult.requiredLength,
                            selectedWidth: optimizationResult.selectedWidth,
                            requiredArea: optimizationResult.requiredArea,
                            actualArea: optimizationResult.actualArea,
                            wastageArea: optimizationResult.finalWastage,
                            wastagePercentage: optimizationResult.wastagePercentage,
                            efficiency: optimizationResult.efficiency,
                            optimizationType: optimizationResult.optimizationType
                        }
                    });

                } catch (optimizationError) {
                    console.error('Wire Mesh optimization error:', optimizationError);
                    currentMaterialDetails.error = `Wire Mesh optimization failed: ${optimizationError.message}`;
                    materialBreakdown.push(currentMaterialDetails);
                    continue;
                }

            } else {
                // Handle other material types (Glass, Hardware, Accessories, Consumables)
                if (!matLink.formulas || matLink.formulas.length === 0) {
                     currentMaterialDetails.error = `No formula defined for non-profile material ${material.name}.`;
                     materialBreakdown.push(currentMaterialDetails);
                     continue;
                }
                const formulaToUse = Array.isArray(matLink.formulas) ? matLink.formulas[0] : matLink.formulas;

                const evalResult = evaluateFormula(formulaToUse, formulaVariables);
                if (evalResult.error) throw new Error(evalResult.error);
                if (evalResult.result == null) throw new Error(`Formula "${formulaToUse}" evaluated to null or undefined.`);
                
                const requiredQuantity = (material.category === 'Glass') ? evalResult.result : Math.ceil(evalResult.result); // Ceil for pcs typically

                if (material.unitRateForStockUnit != null) {
                    const rate = parseFloat(material.unitRateForStockUnit.toString());
                     if (isNaN(rate) || rate < 0) {
                        throw new Error(`Invalid unit rate for ${material.name} (usage unit: ${material.usageUnit}).`);
                    }
                    materialCost = requiredQuantity * rate;
                } else {
                    throw new Error(`Unit rate for ${material.name} (usage unit: ${material.usageUnit}) not defined.`);
                }
                
                Object.assign(currentMaterialDetails, {
                    cost: parseFloat(materialCost.toFixed(2)),
                    quantityRequired: requiredQuantity,
                    quantityUnit: material.usageUnit,
                    rate: material.unitRateForStockUnit ? parseFloat(material.unitRateForStockUnit.toString()) : 0
                });
            }
            totalEstimatedCost += materialCost;
            materialBreakdown.push(currentMaterialDetails);

        } catch (err) {
            console.error(`Error processing material ${material.name} (ID: ${material._id}) for product ${product.name}: ${err.message}`);
            currentMaterialDetails.error = err.message;
            materialBreakdown.push(currentMaterialDetails);
            // Optionally, re-throw or decide if one material error fails the whole calculation.
            // For now, it will just record error for this material and continue.
        }
    }

    return {
        productId: product._id,
        productName: product.name,
        dimensions: { width, height }, // Echo back dimensions used
        totalEstimatedCost: parseFloat(totalEstimatedCost.toFixed(2)),
        materialBreakdown,
    };
}

module.exports = {
    calculateProductCost,
}; 