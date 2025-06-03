const ProductType = require('../models/ProductType');
const MaterialV2 = require('../models/MaterialV2');
const { evaluateFormula, validateFormulaString } = require('../utils/formulaEvaluator');
const { convertUnit, SUPPORTED_AREA_UNITS, getUnitType, SUPPORTED_LINEAR_UNITS } = require('../utils/unitConverter');
const { convertProfileLengthToWeight } = require('../utils/weightUtils');
const GlassFormulaService = require('../services/glassFormulaService');
const { validateGlassFormula, testFormulaCalculation, getFormulaExamples } = require('../utils/formulaValidator');
const mongoose = require('mongoose');
const svgGenerationService = require('../services/svgGenerationService');

// Helper function to process materials for create/update
async function processAndValidateMaterials(materialsData, companyId) {
    const processedMaterials = [];
    const errors = [];

    for (let i = 0; i < materialsData.length; i++) {
        const pMat = materialsData[i];
        if (!mongoose.Types.ObjectId.isValid(pMat.materialId)) {
            errors.push(`Invalid materialId format at index ${i}: ${pMat.materialId}`);
            continue;
        }

        // Check material exists in either MaterialV2 (new batch system) or old MaterialV2 system
        let inventoryMaterial = await MaterialV2.findOne({ _id: pMat.materialId, companyId }).lean();
        let isFromV2System = true;

        if (!inventoryMaterial) {
            // If not found in MaterialV2, try old MaterialV2 system
            inventoryMaterial = await MaterialV2.findOne({ _id: pMat.materialId, companyId }).lean();
            isFromV2System = false;
        }

        if (!inventoryMaterial) {
            errors.push(`MaterialV2 ${pMat.materialNameSnapshot || pMat.materialId} not found.`);
            console.log(`[CostCalc] Error: MaterialV2 ${pMat.materialId} not found in inventory.`);
            continue;
        }
        if (!inventoryMaterial.isActive) {
            errors.push(`MaterialV2 ${inventoryMaterial.name} (${pMat.materialId}) is inactive.`);
            console.log(`[CostCalc] Error: MaterialV2 ${inventoryMaterial.name} is inactive.`);
            continue;
        }

        if (pMat.quantityUnit !== inventoryMaterial.usageUnit) {
            errors.push(
                `Quantity unit mismatch for material ${inventoryMaterial.name} (ID: ${pMat.materialId}). ` +
                `ProductType quantityUnit '${pMat.quantityUnit}' must match MaterialV2 usageUnit '${inventoryMaterial.usageUnit}'.`
            );
            continue;
        }

        processedMaterials.push({
            ...pMat,
            materialNameSnapshot: inventoryMaterial.name,       // Store snapshot of name
            materialCategorySnapshot: inventoryMaterial.category // Store snapshot of category
        });
    }
    return { processedMaterials, errors };
}

exports.createProduct = async (req, res) => {
    const { name, description, imageUrl, isActive, materials, labourCost, glassAreaFormula } = req.body;
    const companyId = req.user.companyId; // Assuming auth middleware sets req.user

    if (!name || !materials || !Array.isArray(materials) || materials.length === 0) {
        return res.status(400).json({ message: 'Name and at least one material are required.' });
    }

    try {
        // Check for existing product with the same name for this company
        const existingProduct = await ProductType.findOne({ name, companyId });
        if (existingProduct) {
            return res.status(400).json({ message: `ProductType with name "${name}" already exists for this company.` });
        }

        const { processedMaterials, errors: materialProcessingErrors } = await processAndValidateMaterials(materials, companyId);

        if (materialProcessingErrors.length > 0) {
            return res.status(400).json({ 
                message: 'Error processing materials. Please check details.', 
                errors: materialProcessingErrors 
            });
        }

        const newProductType = new ProductType({
            companyId,
            name,
            description,
            imageUrl,
            isActive,
            materials: processedMaterials,
            labourCost,
            glassAreaFormula
        });

        const savedProductType = await newProductType.save();
        res.status(201).json(savedProductType);

    } catch (error) {
        console.error('Error in createProduct:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation Error', errors: error.errors });
        }
        res.status(500).json({ message: 'Server error during product creation.', errorDetails: error.message });
    }
};

// Placeholder for other controller functions (CRUD operations)
exports.getAllProducts = async (req, res) => { 
    const companyId = req.user.companyId;
    try {
        // Get all products without populate first
        const products = await ProductType.find({ companyId });
        
        // Manually populate materials for each product
        const populatedProducts = [];
        
        for (const product of products) {
            const populatedMaterials = [];
            
            for (const materialRef of product.materials) {
                let materialData = null;
                
                // Try MaterialV2 first (new system)
                materialData = await MaterialV2.findOne({ 
                    _id: materialRef.materialId, 
                    companyId 
                }).select('name category stockUnit usageUnit aggregatedTotals').lean();
                
                if (materialData) {
                    // Transform MaterialV2 data to match expected format
                    populatedMaterials.push({
                        ...materialRef.toObject(),
                        materialId: {
                            _id: materialData._id,
                            name: materialData.name,
                            category: materialData.category,
                            stockUnit: materialData.stockUnit,
                            usageUnit: materialData.usageUnit,
                            unitRateForStockUnit: materialData.aggregatedTotals?.averageRatePerPiece?.toString() || '0'
                        }
                    });
                } else {
                    // Try old MaterialV2 system
                    materialData = await MaterialV2.findOne({ 
                        _id: materialRef.materialId, 
                        companyId 
                    }).select('name category unitRateForStockUnit stockUnit usageUnit').lean();
                    
                    if (materialData) {
                        populatedMaterials.push({
                            ...materialRef.toObject(),
                            materialId: materialData
                        });
                    } else {
                        // MaterialV2 not found in either system
                        populatedMaterials.push({
                            ...materialRef.toObject(),
                            materialId: null // This will indicate missing material
                        });
                    }
                }
            }
            
            populatedProducts.push({
                ...product.toObject(),
                materials: populatedMaterials
            });
        }
        
        res.status(200).json(populatedProducts);
    } catch (error) {
        console.error('Error in getAllProducts:', error);
        res.status(500).json({ message: 'Server error while fetching products.' });
    }
};

exports.getProductById = async (req, res) => {
    const { productId } = req.params;
    const companyId = req.user.companyId; // Assuming auth middleware sets req.user

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid Product ID format.' });
    }

    try {
        // Get product without populate first
        const product = await ProductType.findOne({ _id: productId, companyId });

        if (!product) {
            return res.status(404).json({ message: 'ProductType not found or not associated with this company.' });
        }

        // Manually populate materials from both systems
        const populatedMaterials = [];
        
        for (const materialRef of product.materials) {
            let materialData = null;
            
            // Try MaterialV2 first (new system)
            materialData = await MaterialV2.findOne({ 
                _id: materialRef.materialId, 
                companyId 
            }).select('name category stockUnit usageUnit isActive hsnCode brand supplier aggregatedTotals').lean();
            
            if (materialData) {
                // Transform MaterialV2 data to match expected format
                populatedMaterials.push({
                    ...materialRef.toObject(),
                    materialId: {
                        _id: materialData._id,
                        name: materialData.name,
                        category: materialData.category,
                        stockUnit: materialData.stockUnit,
                        usageUnit: materialData.usageUnit,
                        isActive: materialData.isActive,
                        hsnCode: materialData.hsnCode,
                        brand: materialData.brand,
                        supplier: materialData.supplier,
                        unitRateForStockUnit: materialData.aggregatedTotals?.averageRatePerPiece?.toString() || '0'
                    }
                });
            } else {
                // Try old MaterialV2 system
                materialData = await MaterialV2.findOne({ 
                    _id: materialRef.materialId, 
                    companyId 
                }).select('name category unitRateForStockUnit stockUnit usageUnit isActive hsnCode brand supplier').lean();
                
                if (materialData) {
                    populatedMaterials.push({
                        ...materialRef.toObject(),
                        materialId: materialData
                    });
                } else {
                    // MaterialV2 not found in either system
                    console.warn(`MaterialV2 ${materialRef.materialId} not found in either MaterialV2 or MaterialV2 collections`);
                    populatedMaterials.push({
                        ...materialRef.toObject(),
                        materialId: null // This will indicate missing material
                    });
                }
            }
        }

        // Create response object with populated materials
        const productResponse = {
            ...product.toObject(),
            materials: populatedMaterials
        };

        res.status(200).json(productResponse);
    } catch (error) {
        console.error('Error in getProductById:', error);
        res.status(500).json({ message: 'Server error while fetching the product.', errorDetails: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    const { productId } = req.params;
    const companyId = req.user.companyId;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid Product ID format.' });
    }

    // Fields that can be updated
    const allowedUpdates = ['name', 'description', 'imageUrl', 'isActive', 'materials', 'labourCost', 'glassAreaFormula'];
    const updates = Object.keys(updateData);
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
        const problematicFields = updates.filter(update => !allowedUpdates.includes(update));
        console.warn('Attempt to update disallowed fields:', problematicFields, 'Full payload:', updateData);
        return res.status(400).json({ 
            message: `Invalid updates! Some fields cannot be modified: ${problematicFields.join(', ')}.` 
        });
    }

    try {
        let productToUpdate = await ProductType.findOne({ _id: productId, companyId });

        if (!productToUpdate) {
            return res.status(404).json({ message: 'ProductType not found or not associated with this company.' });
        }

        // If name is being updated, check for uniqueness (excluding current product)
        if (updateData.name && updateData.name !== productToUpdate.name) {
            const existingProductWithName = await ProductType.findOne({ 
                name: updateData.name, 
                companyId, 
                _id: { $ne: productId } 
            });
            if (existingProductWithName) {
                return res.status(400).json({ message: `Another ProductType with name "${updateData.name}" already exists.` });
            }
        }

        // If materials are being updated, process and validate them
        if (updateData.materials) {
            if (!Array.isArray(updateData.materials)) {
                 return res.status(400).json({ message: 'Materials must be an array.'});
            }
            const { processedMaterials, errors: materialProcessingErrors } = await processAndValidateMaterials(updateData.materials, companyId);
            if (materialProcessingErrors.length > 0) {
                return res.status(400).json({ 
                    message: 'Error processing materials for update. Please check details.', 
                    errors: materialProcessingErrors 
                });
            }
            productToUpdate.materials = processedMaterials; // Assign processed materials
            // Remove materials from updateData so it's not directly applied below by Object.assign, as it has been handled.
            delete updateData.materials; 
        }

        // Apply other allowed updates
        updates.forEach(updateKey => {
            if (updateData[updateKey] !== undefined && updateKey !== 'materials') { // materials already handled
                productToUpdate[updateKey] = updateData[updateKey];
            }
        });

        const updatedProduct = await productToUpdate.save();
        res.status(200).json(updatedProduct);

    } catch (error) {
        console.error('Error in updateProduct:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation Error', errors: error.errors });
        }
        res.status(500).json({ message: 'Server error while updating the product.', errorDetails: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    const { productId } = req.params;
    const companyId = req.user.companyId; // Assuming auth middleware sets req.user

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid Product ID format.' });
    }

    try {
        const productToDelete = await ProductType.findOne({ _id: productId, companyId });

        if (!productToDelete) {
            return res.status(404).json({ message: 'ProductType not found or not associated with this company.' });
        }

        // Optional: Check for dependencies before hard delete
        // For example, if ProductTypes are used in active Quotes/Orders, you might prevent deletion
        // or implement a soft delete (e.g., setting productToDelete.isActive = false and saving).
        // For now, we proceed with a hard delete as per standard DELETE operation.

        await ProductType.deleteOne({ _id: productId, companyId }); // Ensures we only delete if it matches companyId again

        res.status(200).json({ message: 'ProductType successfully deleted.', deletedProductId: productId });

    } catch (error) {
        console.error('Error in deleteProduct:', error);
        res.status(500).json({ message: 'Server error while deleting the product.', errorDetails: error.message });
    }
};

exports.validateFormula = async (req, res) => {
    const { formula } = req.body;
    if (!formula || typeof formula !== 'string') {
        return res.status(400).json({ valid: false, error: 'Formula string is required.' });
    }
    const result = validateFormulaString(formula);
    return res.status(200).json(result);
};

exports.calculateProductCost = async (req, res) => {
    const { productId, width, height } = req.body;
    const companyId = req.user.companyId;

    console.log(`[CostCalc] Starting for Product: ${productId}, W: ${width}, H: ${height}`);

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid productId' });
    }
    if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
        return res.status(400).json({ message: 'Width and height must be positive numbers.' });
    }

    try {
        const productType = await ProductType.findOne({ _id: productId, companyId }).lean();
        if (!productType) return res.status(404).json({ message: 'ProductType not found.' });
        if (!productType.isActive) return res.status(400).json({ message: 'ProductType is not active.' });

        let totalCalculatedCost = 0;
        const breakdown = [];
        const errors = [];

        for (const pMaterial of productType.materials) {
            console.log(`[CostCalc] Processing pMaterial: ${pMaterial.materialNameSnapshot || pMaterial.materialId}`);

            // Load inventory material data from either MaterialV2 or MaterialV2 system
            let inventoryMaterial = await MaterialV2.findOne({ _id: pMaterial.materialId, companyId }).lean();
            let isFromV2System = true;

            if (!inventoryMaterial) {
                // If not found in MaterialV2, try old MaterialV2 system
                inventoryMaterial = await MaterialV2.findOne({ _id: pMaterial.materialId, companyId }).lean();
                isFromV2System = false;
            }

            if (!inventoryMaterial) {
                errors.push(`MaterialV2 ${pMaterial.materialNameSnapshot || pMaterial.materialId} not found.`);
                console.log(`[CostCalc] Error: MaterialV2 ${pMaterial.materialId} not found in inventory.`);
                continue;
            }
            if (!inventoryMaterial.isActive) {
                errors.push(`MaterialV2 ${inventoryMaterial.name} (${pMaterial.materialId}) is inactive.`);
                console.log(`[CostCalc] Error: MaterialV2 ${inventoryMaterial.name} is inactive.`);
                continue;
            }

            let materialTotalQuantityForRate = 0; 
            let displayQuantity = 0; 
            let displayQuantityUnit = pMaterial.quantityUnit;
            let materialTotalLengthInUsageUnit = 0;
            let weightConversionNeeded = false; // Declare at broader scope for rate calculation

            for (const formulaStr of pMaterial.formulas) {
                const evalInputs = { W: width, H: height };
                console.log(`[CostCalc] Evaluating formula "${formulaStr}" for ${pMaterial.materialNameSnapshot || pMaterial.materialId} with inputs:`, evalInputs);
                const evalResult = evaluateFormula(formulaStr, evalInputs);
                console.log(`[CostCalc] Formula evalResult:`, evalResult);

                if (evalResult.error) {
                    errors.push(`Formula error for ${pMaterial.materialNameSnapshot || pMaterial.materialId} ("${formulaStr}"): ${evalResult.error}`);
                    continue;
                }
                if (typeof evalResult.result === 'number') {
                    let effectiveFromUnit = pMaterial.formulaInputUnit.toLowerCase();
                    const targetQuantityUnit = pMaterial.quantityUnit.toLowerCase();
                    const targetQuantityUnitType = getUnitType(targetQuantityUnit);
                    const formulaInputUnitType = getUnitType(effectiveFromUnit);
                    if (targetQuantityUnitType === 'area' && formulaInputUnitType === 'linear') {
                        if (effectiveFromUnit === 'inches') effectiveFromUnit = 'sqin';
                        else if (effectiveFromUnit === 'ft') effectiveFromUnit = 'sqft';
                        else if (effectiveFromUnit === 'mm') effectiveFromUnit = 'sqmm';
                        else if (effectiveFromUnit === 'cm') effectiveFromUnit = 'sqcm';
                        else if (effectiveFromUnit === 'm') effectiveFromUnit = 'sqm';
                        else { errors.push(`Cannot form square unit for ${pMaterial.materialNameSnapshot || pMaterial.materialId}: unsupported linear formulaInputUnit '${pMaterial.formulaInputUnit}'`); continue; }
                    }
                    console.log(`[CostCalc] Attempting unit conversion: ${evalResult.result} from '${effectiveFromUnit}' to '${targetQuantityUnit}'`);
                    const conversion = convertUnit(evalResult.result, effectiveFromUnit, targetQuantityUnit);
                    console.log(`[CostCalc] Unit conversion result:`, conversion);
                    if (conversion.error) {
                        errors.push(`Unit conversion error for ${pMaterial.materialNameSnapshot || pMaterial.materialId} (formula "${formulaStr}", from ${effectiveFromUnit} to ${targetQuantityUnit}): ${conversion.error}`);
                        continue;
                    }
                    materialTotalLengthInUsageUnit += conversion.result;
                } else {
                    errors.push(`Formula "${formulaStr}" for ${pMaterial.materialNameSnapshot || pMaterial.materialId} non-numeric result.`);
                    continue;
                }
            }
            
            displayQuantity = materialTotalLengthInUsageUnit;
            displayQuantityUnit = pMaterial.quantityUnit;
            console.log(`[CostCalc] Total calculated length/qty in usage unit (${displayQuantityUnit}) for ${pMaterial.materialNameSnapshot || pMaterial.materialId}: ${displayQuantity}`);

            if (displayQuantity <= 0 && pMaterial.formulas.length > 0) {
                console.log(`[CostCalc] Skipping ${pMaterial.materialNameSnapshot || pMaterial.materialId}: zero/negative qty post-conversion.`);
                continue;
            }
            if (pMaterial.formulas.length === 0 && displayQuantity === 0) {
                console.log(`[CostCalc] Skipping ${pMaterial.materialNameSnapshot || pMaterial.materialId}: no formulas.`);
                continue;
            }

            if (pMaterial.materialCategorySnapshot === 'Profile' && getUnitType(pMaterial.quantityUnit) === 'linear') {
                // For Profile materials, we need to convert length to weight for proper costing
                let gaugeToUse = pMaterial.defaultGauge;
                
                if (isFromV2System) {
                    // MaterialV2 system: use referenceGaugeWeights for conversion
                    if (inventoryMaterial.referenceGaugeWeights && inventoryMaterial.referenceGaugeWeights.length > 0) {
                        weightConversionNeeded = true;
                        if (!gaugeToUse) {
                            gaugeToUse = inventoryMaterial.referenceGaugeWeights[0].gauge;
                        }
                        console.log(`[CostCalc] MaterialV2 Profile detected. Gauge to use for ${inventoryMaterial.name}: ${gaugeToUse}`);
                    }
                } else {
                    // Old MaterialV2 system: check if stockUnit is weight-based
                    if (getUnitType(inventoryMaterial.stockUnit) === 'weight') {
                        weightConversionNeeded = true;
                        if (!gaugeToUse && inventoryMaterial.gaugeSpecificWeights && inventoryMaterial.gaugeSpecificWeights.length > 0) {
                            gaugeToUse = inventoryMaterial.gaugeSpecificWeights[0].gauge;
                        }
                        console.log(`[CostCalc] Legacy Profile detected. Gauge to use for ${inventoryMaterial.name}: ${gaugeToUse}`);
                    }
                }
                
                if (weightConversionNeeded && gaugeToUse) {
                    console.log(`[CostCalc] Calling convertProfileLengthToWeight for ${inventoryMaterial.name}: length ${materialTotalLengthInUsageUnit} ${pMaterial.quantityUnit}, gauge ${gaugeToUse}`);
                    
                    let weightConversion;
                    if (isFromV2System) {
                        // For MaterialV2, create a compatible object for the conversion function
                        const compatibleMaterial = {
                            name: inventoryMaterial.name,
                            gaugeSpecificWeights: inventoryMaterial.referenceGaugeWeights.map(rg => ({
                                gauge: rg.gauge,
                                weightPerUnitLength: rg.referenceWeight,
                                unitLength: rg.unitLength
                            })),
                            weightUnit: 'kg' // MaterialV2 uses kg by default
                        };
                        weightConversion = convertProfileLengthToWeight(materialTotalLengthInUsageUnit, pMaterial.quantityUnit, compatibleMaterial, gaugeToUse);
                    } else {
                        // Use old MaterialV2 system directly
                        weightConversion = convertProfileLengthToWeight(materialTotalLengthInUsageUnit, pMaterial.quantityUnit, inventoryMaterial, gaugeToUse);
                    }
                    
                    console.log(`[CostCalc] Length-to-weight conversion result for ${inventoryMaterial.name}:`, weightConversion);
                    if (weightConversion.error) {
                        errors.push(`Could not convert length to weight for ${inventoryMaterial.name}: ${weightConversion.error}`);
                        continue;
                    }
                    materialTotalQuantityForRate = weightConversion.weight;
                } else {
                    if (pMaterial.materialCategorySnapshot === 'Profile') {
                        console.log(`[CostCalc] Profile ${inventoryMaterial.name} does not have proper gauge weights for conversion, using linear quantity directly`);
                    }
                    materialTotalQuantityForRate = materialTotalLengthInUsageUnit;
                }
            } else {
                materialTotalQuantityForRate = materialTotalLengthInUsageUnit;
                console.log(`[CostCalc] Not a profile requiring length-to-weight, or units compatible. Using ${materialTotalQuantityForRate} for rate calculation for ${inventoryMaterial.name}.`);
            }
            console.log(`[CostCalc] Quantity for rate for ${inventoryMaterial.name}: ${materialTotalQuantityForRate} (expected unit: ${inventoryMaterial.stockUnit})`);

            let materialRate = 0;
            if (isFromV2System) {
                // MaterialV2: get rate based on whether weight conversion was used
                if (pMaterial.materialCategorySnapshot === 'Profile' && weightConversionNeeded && inventoryMaterial.aggregatedTotals?.averageRatePerKg) {
                    // Use weight-based rate for converted Profile materials
                    materialRate = parseFloat(inventoryMaterial.aggregatedTotals.averageRatePerKg.toString());
                    console.log(`[CostCalc] Using weight-based rate for MaterialV2 Profile: ${materialRate} per kg`);
                } else {
                    // Use piece-based rate for non-Profile or non-converted materials
                    materialRate = inventoryMaterial.aggregatedTotals?.averageRatePerPiece ? 
                        parseFloat(inventoryMaterial.aggregatedTotals.averageRatePerPiece.toString()) : 0;
                    console.log(`[CostCalc] Using piece-based rate for MaterialV2: ${materialRate} per piece`);
                }
            } else {
                // Old MaterialV2: get rate from unitRateForStockUnit
                materialRate = inventoryMaterial.unitRateForStockUnit ? 
                    parseFloat(inventoryMaterial.unitRateForStockUnit.toString()) : 0;
                console.log(`[CostCalc] Using legacy material rate: ${materialRate} per ${inventoryMaterial.stockUnit}`);
            }
            
            console.log(`[CostCalc] Inventory material found: ${inventoryMaterial.name}, Category: ${inventoryMaterial.category}, System: ${isFromV2System ? 'V2' : 'Legacy'}, Rate: ${materialRate}`);
            
            if (isNaN(materialRate) || materialRate < 0) { // Allow rate to be 0
                errors.push(`Invalid rate for ${inventoryMaterial.name}: '${materialRate.toString()}'`);
                continue;
            }

            const itemCost = materialTotalQuantityForRate * materialRate;
            console.log(`[CostCalc] Calculated item cost for ${inventoryMaterial.name}: ${materialTotalQuantityForRate} * ${materialRate} = ${itemCost}`);
            totalCalculatedCost += itemCost;

            // Determine the correct rate unit for display
            let rateUnitForDisplay = inventoryMaterial.stockUnit;
            if (isFromV2System && pMaterial.materialCategorySnapshot === 'Profile' && weightConversionNeeded) {
                rateUnitForDisplay = 'kg'; // Weight-based rate unit for converted Profile materials
            }

            breakdown.push({
                materialId: inventoryMaterial._id,
                materialName: inventoryMaterial.name,
                materialCategory: inventoryMaterial.category,
                quantity: displayQuantity,
                quantityUnit: displayQuantityUnit,
                rate: materialRate, 
                rateUnit: rateUnitForDisplay, 
                cost: itemCost,
                _debug_formulaInputUnit: pMaterial.formulaInputUnit,
                _debug_quantityForRate: materialTotalQuantityForRate,
                _debug_rateUnit: rateUnitForDisplay,
            });
        }

        console.log(`[CostCalc] Final errors:`, errors);
        console.log(`[CostCalc] Final breakdown:`, breakdown);
        console.log(`[CostCalc] Final totalCalculatedCost: ${totalCalculatedCost}`);

        if (errors.length > 0) {
             return res.status(200).json({
                message: "Calculation completed with errors.",
                totalCost: totalCalculatedCost,
                breakdown,
                errors
            });
        }

        res.status(200).json({
            totalCost: totalCalculatedCost,
            breakdown,
            message: 'Cost calculated successfully.'
        });

    } catch (error) {
        console.error('[CostCalc] CATCH ERROR in calculateProductCost:', error);
        res.status(500).json({ message: 'Server error during cost calculation.', errorDetails: error.message });
    }
};

// NEW: Glass Formula Management Endpoints

/**
 * Get glass formula for a product type
 * GET /api/products/:productId/glass-formula
 */
exports.getGlassFormula = async (req, res) => {
    const { productId } = req.params;
    const companyId = req.user.companyId;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid Product ID format.' });
    }

    try {
        const product = await ProductType.findOne({ _id: productId, companyId });

        if (!product) {
            return res.status(404).json({ message: 'ProductType not found or not associated with this company.' });
        }

        res.status(200).json({
            productId: product._id,
            productName: product.name,
            glassAreaFormula: product.glassAreaFormula || {
                formula: "",
                formulaInputUnit: "inches",
                outputUnit: "sqft",
                description: ""
            }
        });

    } catch (error) {
        console.error('Error in getGlassFormula:', error);
        res.status(500).json({ message: 'Server error while fetching glass formula.', errorDetails: error.message });
    }
};

/**
 * Update glass formula for a product type
 * PUT /api/products/:productId/glass-formula
 */
exports.updateGlassFormula = async (req, res) => {
    const { productId } = req.params;
    const { 
        widthFormula, 
        heightFormula, 
        glassQuantity,
        formulaInputUnit, 
        outputUnit, 
        description 
    } = req.body;
    const companyId = req.user.companyId;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid Product ID format.' });
    }

    // Validate formulas
    if (widthFormula && widthFormula.trim() !== '') {
        const validation = GlassFormulaService.validateFormula(widthFormula);
        if (!validation.valid) {
            return res.status(400).json({ 
                message: 'Invalid width formula', 
                error: validation.error 
            });
        }
    }
    if (heightFormula && heightFormula.trim() !== '') {
        const validation = GlassFormulaService.validateFormula(heightFormula);
        if (!validation.valid) {
            return res.status(400).json({ 
                message: 'Invalid height formula', 
                error: validation.error 
            });
        }
    }
    if (glassQuantity && (typeof glassQuantity !== 'number' || glassQuantity < 1)) {
        return res.status(400).json({ 
            message: 'Glass quantity must be a positive number' 
        });
    }

    // Validate units
    const supportedUnits = GlassFormulaService.getSupportedUnits();
    if (formulaInputUnit && !supportedUnits.inputUnits.includes(formulaInputUnit)) {
        return res.status(400).json({ 
            message: 'Invalid input unit', 
            supportedUnits: supportedUnits.inputUnits 
        });
    }
    if (outputUnit && !supportedUnits.outputUnits.includes(outputUnit)) {
        return res.status(400).json({ 
            message: 'Invalid output unit', 
            supportedUnits: supportedUnits.outputUnits 
        });
    }

    try {
        const product = await ProductType.findOne({ _id: productId, companyId });

        if (!product) {
            return res.status(404).json({ message: 'ProductType not found or not associated with this company.' });
        }

        // Update glass area formula
        product.glassAreaFormula = {
            widthFormula: widthFormula || product.glassAreaFormula?.widthFormula || "",
            heightFormula: heightFormula || product.glassAreaFormula?.heightFormula || "",
            glassQuantity: glassQuantity || product.glassAreaFormula?.glassQuantity || 1,
            formulaInputUnit: formulaInputUnit || product.glassAreaFormula?.formulaInputUnit || "inches",
            outputUnit: outputUnit || product.glassAreaFormula?.outputUnit || "sqft",
            description: description || product.glassAreaFormula?.description || ""
        };

        const updatedProduct = await product.save();

        res.status(200).json({
            message: 'Glass formulas updated successfully',
            productId: updatedProduct._id,
            productName: updatedProduct.name,
            glassAreaFormula: updatedProduct.glassAreaFormula
        });

    } catch (error) {
        console.error('Error in updateGlassFormula:', error);
        res.status(500).json({ message: 'Server error while updating glass formulas.', errorDetails: error.message });
    }
};

/**
 * Validate and test glass formula
 * POST /api/products/validate-glass-formula
 */
exports.validateGlassFormula = async (req, res) => {
    const { widthFormula, heightFormula, glassQuantity, testDimensions, inputUnit, outputUnit } = req.body;

    // Validate required formulas
    if (!widthFormula || !heightFormula) {
        return res.status(400).json({ 
            valid: false, 
            error: 'Both width and height formulas are required.' 
        });
    }

    try {
        // Validate separate formulas
        const widthValidation = GlassFormulaService.validateFormula(widthFormula);
        const heightValidation = GlassFormulaService.validateFormula(heightFormula);
        
        if (!widthValidation.valid) {
            return res.status(200).json({
                valid: false,
                error: `Width formula error: ${widthValidation.error}`
            });
        }
        
        if (!heightValidation.valid) {
            return res.status(200).json({
                valid: false,
                error: `Height formula error: ${heightValidation.error}`
            });
        }

        let apiTestResults = [];
        if (testDimensions && testDimensions.width !== undefined && testDimensions.height !== undefined && inputUnit && outputUnit) {
            const calculated = GlassFormulaService.calculateGlassAreaWithQuantity(
                widthFormula,
                heightFormula,
                Number(testDimensions.width),
                Number(testDimensions.height),
                glassQuantity || 1,
                inputUnit,
                outputUnit
            );

            if (calculated.error) {
                return res.status(200).json({
                    valid: true, 
                    message: 'Formulas syntax is valid, but test calculation failed.',
                    testError: calculated.error,
                    testResults: [{
                        width: Number(testDimensions.width),
                        height: Number(testDimensions.height),
                        calculatedArea: 'Error', 
                        unit: outputUnit
                    }]
                });
            }
            
            apiTestResults = [{
                width: Number(testDimensions.width),
                height: Number(testDimensions.height),
                calculatedArea: calculated.result,
                unit: outputUnit,
                glassDetails: {
                    piecesPerItem: calculated.glassQuantity,
                    totalPieces: calculated.glassQuantity,
                    areaPerPiece: calculated.areaPerPiece,
                    adjustedWidth: calculated.adjustedWidth,
                    adjustedHeight: calculated.adjustedHeight,
                    roundedWidth: calculated.roundedWidth,
                    roundedHeight: calculated.roundedHeight,
                    glassCutSize: calculated.roundedWidth && calculated.roundedHeight ? 
                        `${calculated.roundedWidth}" x ${calculated.roundedHeight}"` : null
                }
            }];
        }

        res.status(200).json({
            valid: true,
            message: 'Formulas are valid',
            testResults: apiTestResults 
        });

    } catch (error) {
        console.error('Error in validateGlassFormula controller:', error);
        res.status(500).json({ 
            valid: false, 
            error: 'Server error during formula validation.',
            errorDetails: error.message 
        });
    }
};

/**
 * Generate glass placement sheet for an estimation
 * GET /api/products/glass-placement/:estimationId
 */
exports.generateGlassPlacementSheet = async (req, res) => {
    const { estimationId } = req.params;
    const { format } = req.query; // 'json' or 'csv'
    const companyId = req.user.companyId;

    if (!mongoose.Types.ObjectId.isValid(estimationId)) {
        return res.status(400).json({ message: 'Invalid Estimation ID format.' });
    }

    try {
        const GlassPlacementService = require('../services/glassPlacementService');
        
        const placementSheet = await GlassPlacementService.generatePlacementSheet(estimationId, companyId);
        const optimizationReport = GlassPlacementService.generateOptimizationReport(placementSheet);

        if (format === 'csv') {
            const csvData = GlassPlacementService.exportToCSV(placementSheet);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="glass-placement-${estimationId}.csv"`);
            return res.send(csvData);
        }

        res.status(200).json({
            message: 'Glass placement sheet generated successfully',
            placementSheet,
            optimizationReport
        });

    } catch (error) {
        console.error('Error in generateGlassPlacementSheet:', error);
        res.status(500).json({ 
            message: 'Server error while generating glass placement sheet.',
            errorDetails: error.message 
        });
    }
};

/**
 * Generate SVG technical drawing for a product using AI
 */
exports.generateSVG = async (req, res) => {
    const { productId } = req.params;
    const { prompt } = req.body;
    const companyId = req.user.companyId;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid Product ID format.' });
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return res.status(400).json({ message: 'AI prompt is required for SVG generation.' });
    }

    try {
        // Find the product
        const product = await ProductType.findOne({ _id: productId, companyId });
        if (!product) {
            return res.status(404).json({ message: 'ProductType not found or not associated with this company.' });
        }

        // Generate SVG using AI service
        let svgContent;
        try {
            svgContent = await svgGenerationService.generateSVG(prompt, {
                name: product.name,
                description: product.description
            });
        } catch (svgError) {
            console.warn('AI SVG generation failed, using fallback:', svgError.message);
            // Use fallback SVG if AI generation fails
            svgContent = svgGenerationService.generateFallbackSVG({
                name: product.name,
                description: product.description
            });
        }

        // Update product with new technical drawing
        product.technicalDrawing = {
            svgContent: svgContent,
            prompt: prompt.trim(),
            generatedAt: new Date(),
            generatedBy: userId,
            isActive: true
        };

        const updatedProduct = await product.save();

        res.status(200).json({
            message: 'SVG technical drawing generated successfully',
            productId: updatedProduct._id,
            productName: updatedProduct.name,
            technicalDrawing: {
                svgContent: updatedProduct.technicalDrawing.svgContent,
                prompt: updatedProduct.technicalDrawing.prompt,
                generatedAt: updatedProduct.technicalDrawing.generatedAt,
                isActive: updatedProduct.technicalDrawing.isActive
            }
        });

    } catch (error) {
        console.error('Error in generateSVG:', error);
        res.status(500).json({ message: 'Server error while generating SVG.', errorDetails: error.message });
    }
};

/**
 * Update technical drawing for a product
 */
exports.updateTechnicalDrawing = async (req, res) => {
    const { productId } = req.params;
    const { svgContent, prompt, isActive } = req.body;
    const companyId = req.user.companyId;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid Product ID format.' });
    }

    try {
        // Find the product
        const product = await ProductType.findOne({ _id: productId, companyId });
        if (!product) {
            return res.status(404).json({ message: 'ProductType not found or not associated with this company.' });
        }

        // Validate SVG content if provided
        if (svgContent) {
            try {
                svgGenerationService.validateSVGContent(svgContent);
            } catch (validationError) {
                return res.status(400).json({ 
                    message: 'Invalid SVG content', 
                    error: validationError.message 
                });
            }
        }

        // Update technical drawing fields
        if (!product.technicalDrawing) {
            product.technicalDrawing = {};
        }

        if (svgContent !== undefined) {
            product.technicalDrawing.svgContent = svgContent;
        }
        if (prompt !== undefined) {
            product.technicalDrawing.prompt = prompt;
        }
        if (isActive !== undefined) {
            product.technicalDrawing.isActive = isActive;
        }

        // Always update these fields
        product.technicalDrawing.generatedAt = new Date();
        product.technicalDrawing.generatedBy = userId;

        const updatedProduct = await product.save();

        res.status(200).json({
            message: 'Technical drawing updated successfully',
            productId: updatedProduct._id,
            productName: updatedProduct.name,
            technicalDrawing: {
                svgContent: updatedProduct.technicalDrawing.svgContent,
                prompt: updatedProduct.technicalDrawing.prompt,
                generatedAt: updatedProduct.technicalDrawing.generatedAt,
                isActive: updatedProduct.technicalDrawing.isActive
            }
        });

    } catch (error) {
        console.error('Error in updateTechnicalDrawing:', error);
        res.status(500).json({ message: 'Server error while updating technical drawing.', errorDetails: error.message });
    }
}; 