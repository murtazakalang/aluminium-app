const mongoose = require('mongoose');
const ProductType = require('../models/ProductType');
const Estimation = require('../models/Estimation');
const { evaluateFormula } = require('../utils/formulaEvaluator');
const {
    convertUnit,
    getUnitType,
    SUPPORTED_AREA_UNITS,
    SUPPORTED_LINEAR_UNITS
} = require('../utils/unitConverter');
const { calculateProfileConsumption, SCRAP_THRESHOLD_FT } = require('../utils/profileCuttingUtil');
const { calculateLabourCosts, mergeLabourCharges } = require('./labourCostService');
const GlassFormulaService = require('./glassFormulaService');
const WireMeshOptimizationService = require('./wireMeshOptimizationService');
const Quotation = require('../models/Quotation');
const Client = require('../models/Client');
const Setting = require('../models/Setting');
const QuotationService = require('./quotationService');
const MaterialV2 = require('../models/MaterialV2');

// Helper utility to robustly convert values to Mongoose Decimal128
const toDecimal128 = (value, defaultValue = '0.00') => {
    if (value === null || value === undefined) {
        return mongoose.Types.Decimal128.fromString(defaultValue);
    }
    if (value instanceof mongoose.Types.Decimal128) {
        return value; // Already a Decimal128
    }
    if (typeof value === 'number') {
        // Ensure toFixed is used for proper decimal representation from number
        return mongoose.Types.Decimal128.fromString(value.toFixed(2)); 
    }
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        if (isNaN(parsed)) {
            return mongoose.Types.Decimal128.fromString(defaultValue);
        }
        return mongoose.Types.Decimal128.fromString(parsed.toFixed(2));
    }
    // If it's an object that might be a Decimal128 structure e.g. { $numberDecimal: "10.5" }
    if (typeof value === 'object' && value.$numberDecimal !== undefined) {
         const parsed = parseFloat(value.$numberDecimal);
         if (isNaN(parsed)) {
            return mongoose.Types.Decimal128.fromString(defaultValue);
        }
        return mongoose.Types.Decimal128.fromString(parsed.toFixed(2));
    }
    console.warn(`[toDecimal128] Unexpected value type: ${typeof value}, value: ${JSON.stringify(value)}. Defaulting.`);
    return mongoose.Types.Decimal128.fromString(defaultValue);
};

class EstimationService {
    /**
     * Calculate glass area and cost for a single estimation item
     * @param {Object} item - Estimation item
     * @param {Object} productType - Product type with glass formula
     * @param {string} estimationDimensionUnit - Unit used in estimation
     * @param {string} companyId - Company ID for multi-tenancy
     * @returns {Object} Glass calculation result
     */
    static async calculateGlassForItem(item, productType, estimationDimensionUnit, companyId) {
        const glassFormula = productType.glassAreaFormula;
        
        // Check if product type has glass formulas
        const hasGlassFormulas = glassFormula?.widthFormula && glassFormula.heightFormula && 
                                glassFormula.widthFormula.trim() !== '' && glassFormula.heightFormula.trim() !== '';
        
        if (!glassFormula || !hasGlassFormulas) {
            return { hasGlass: false };
        }

        // Check if item has selected glass type
        if (!item.selectedGlassTypeId) {
            return { 
                hasGlass: true, 
                error: 'Glass type not selected for item with glass formula',
                formula: glassFormula 
            };
        }

        try {
            // Find glass material in both V2 and V1 systems
            let glassMaterial = null;
            
            // First try to find in V2 system
            const materialV2 = await MaterialV2.findOne({ 
                _id: item.selectedGlassTypeId, 
                companyId: companyId,
                category: 'Glass'
            });
            
            if (materialV2) {
                // Convert V2 material to V1-like structure for backward compatibility
                // For glass materials, use piece-based rate or unitRateForStockUnit
                const rateToUse = materialV2.unitRateForStockUnit || materialV2.aggregatedTotals?.averageRatePerPiece || '0';
                const stockUnitToUse = materialV2.stockUnit || 'sqft';
                
                glassMaterial = {
                    _id: materialV2._id,
                    name: materialV2.name,
                    category: materialV2.category,
                    stockUnit: stockUnitToUse,
                    usageUnit: materialV2.usageUnit,
                    unitRateForStockUnit: rateToUse,
                    supplier: materialV2.supplier,
                    brand: materialV2.brand,
                    isActive: true, // V2 only contains active materials
                    isV2: true, // Flag to identify V2 materials
                    companyId: materialV2.companyId
                };
            } else {
                // Fall back to V1 system (though V1 is deprecated)
                glassMaterial = await MaterialV2.findOne({ 
                    _id: item.selectedGlassTypeId, 
                    companyId: companyId,
                    category: 'Glass',
                    isActive: true
                });
            }

            if (!glassMaterial) {
                return { 
                    hasGlass: true, 
                    error: 'Selected glass material not found or inactive',
                    formula: glassFormula 
                };
            }

            // Calculate glass area using separate formulas
            const width = parseFloat(item.width.toString());
            const height = parseFloat(item.height.toString());

            // Use separate formula approach
            const areaResult = GlassFormulaService.calculateGlassAreaWithQuantity(
                glassFormula.widthFormula,
                glassFormula.heightFormula,
                width,
                height,
                glassFormula.glassQuantity || 1,
                estimationDimensionUnit,
                glassFormula.outputUnit
            );
            
            let glassDetails = {};
            if (!areaResult.error) {
                glassDetails = {
                    adjustedWidth: areaResult.adjustedWidth,
                    adjustedHeight: areaResult.adjustedHeight,
                    roundedWidth: areaResult.roundedWidth,
                    roundedHeight: areaResult.roundedHeight,
                    areaPerPiece: areaResult.areaPerPiece,
                    piecesPerItem: areaResult.glassQuantity,
                    glassCutSize: `${areaResult.roundedWidth}" x ${areaResult.roundedHeight}"`
                };
            }

            if (areaResult.error) {
                return { 
                    hasGlass: true, 
                    error: `Glass area calculation error: ${areaResult.error}`,
                    formula: glassFormula 
                };
            }

            const glassQuantityPerItem = areaResult.result;
            const totalGlassQuantity = glassQuantityPerItem * item.quantity;
            
            // Calculate cost using glass material rate
            const glassRate = parseFloat(glassMaterial.unitRateForStockUnit ? glassMaterial.unitRateForStockUnit.toString() : '0');
            const totalGlassCost = totalGlassQuantity * glassRate;

            return {
                hasGlass: true,
                glassMaterial: glassMaterial,
                glassQuantityPerItem: glassQuantityPerItem,
                totalGlassQuantity: totalGlassQuantity,
                glassUnit: glassFormula.outputUnit,
                glassRate: glassRate,
                glassRateUnit: glassMaterial.stockUnit,
                totalGlassCost: totalGlassCost,
                formula: glassFormula,
                glassDetails: glassDetails // Additional details for glass placement sheets
            };

        } catch (error) {
            return { 
                hasGlass: true, 
                error: `Glass calculation error: ${error.message}`,
                formula: glassFormula 
            };
        }
    }

    /**
     * Aggregate glass materials from all items
     * @param {Array} glassCalculations - Array of glass calculation results
     * @returns {Object} Aggregated glass materials map
     */
    static aggregateGlassMaterials(glassCalculations) {
        const glassMap = {};

        for (const calc of glassCalculations) {
            if (!calc.hasGlass || calc.error || !calc.glassMaterial) {
                continue;
            }

            const materialIdString = calc.glassMaterial._id.toString();
            
            if (!glassMap[materialIdString]) {
                glassMap[materialIdString] = {
                    materialId: calc.glassMaterial._id,
                    materialNameSnapshot: calc.glassMaterial.name,
                    materialCategorySnapshot: 'Glass',
                    totalQuantity: toDecimal128('0.00'),
                    quantityUnit: calc.glassUnit,
                    totalWeight: toDecimal128('0.000'),
                    weightUnit: 'N/A',
                    autoUnitRate: toDecimal128(calc.glassRate.toString()),
                    autoRateUnit: calc.glassRateUnit,
                    manualUnitRate: toDecimal128('0.00'),
                    calculatedCost: toDecimal128('0.00'),
                    sourceType: 'glass',
                    sourceItemIds: []
                };
            }

            // Aggregate quantities and costs
            const existingQuantity = parseFloat(glassMap[materialIdString].totalQuantity.toString());
            glassMap[materialIdString].totalQuantity = toDecimal128((existingQuantity + calc.totalGlassQuantity).toFixed(4));
            
            const existingCost = parseFloat(glassMap[materialIdString].calculatedCost.toString());
            glassMap[materialIdString].calculatedCost = toDecimal128((existingCost + calc.totalGlassCost).toFixed(2));
            
            // Track source item (we'll populate this when we have the item reference)
            if (calc.itemId) {
                glassMap[materialIdString].sourceItemIds.push(calc.itemId);
            }
        }

        return glassMap;
    }

    /**
     * Calculate materials for an estimation
     * @param {string} estimationId - ID of the estimation
     * @param {string} companyId - Company ID for multi-tenancy
     * @returns {Object} Calculated materials breakdown
     */
    async calculateEstimationMaterials(estimationId, companyId) {
        const estimation = await Estimation.findOne({ 
            _id: estimationId, 
            companyId: companyId 
        });

        if (!estimation) {
            throw new Error('Estimation not found');
        }

        console.log(`[EstimationService] Starting material calculation for estimation ${estimationId} with ${estimation.items.length} items`);

        const calculatedMaterialsMap = {};
        const profileMaterialCuts = {};

        // Helper function to find material in both V2 and V1 systems
        const findMaterialById = async (materialId, companyId) => {
            try {
                // First try to find in V2 system
                const materialV2 = await MaterialV2.findOne({ 
                    _id: materialId, 
                    companyId: companyId 
                });
                
                if (materialV2) {
                    // Convert V2 material to V1-like structure for backward compatibility
                    // IMPORTANT: Copy ALL fields needed for profile cutting optimization
                    
                    // For profiles, use weight-based rate; for others, use piece-based rate
                    const isProfile = materialV2.category === 'Profile';
                    const rateToUse = isProfile 
                        ? materialV2.aggregatedTotals?.averageRatePerKg || '0'
                        : materialV2.aggregatedTotals?.averageRatePerPiece || '0';
                    const stockUnitToUse = isProfile ? 'kg' : materialV2.stockUnit;
                    
                    return {
                        _id: materialV2._id,
                        name: materialV2.name,
                        category: materialV2.category,
                        stockUnit: stockUnitToUse,
                        usageUnit: materialV2.usageUnit,
                        unitRateForStockUnit: rateToUse,
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
                        
                        // Additional fields that might be needed
                        purchaseUnit: stockUnitToUse, // Use determined stock unit as purchase unit
                        unitRate: rateToUse // Use the same rate as unitRateForStockUnit
                    };
                }
                
                // Fall back to V1 system
                const materialV1 = await MaterialV2.findOne({ 
                    _id: materialId, 
                    companyId: companyId,
                    isActive: true 
                });
                
                if (materialV1) {
                    return {
                        ...materialV1.toObject(),
                        isV2: false // Flag to identify V1 materials
                    };
                }
                
                return null;
            } catch (error) {
                console.warn(`Error finding material ${materialId}:`, error);
                return null;
            }
        };

        // Iterate through each estimation item
        for (const item of estimation.items) {
            const productType = await ProductType.findOne({ 
                _id: item.productTypeId, 
                companyId: companyId 
            });

            if (!productType) {
                console.warn(`Product Type not found for ID: ${item.productTypeId} in estimation ${estimationId}. Skipping its materials.`);
                continue;
            }
            if (!item.productTypeNameSnapshot) {
                item.productTypeNameSnapshot = productType.name;
            }

            // Process materials for this product type
            for (const materialLink of productType.materials) {
                if (!materialLink.materialId) {
                    console.warn(`Linked materialId is missing in ProductType ${productType.name}. Skipping.`);
                    continue;
                }
                
                // Find material using our helper function
                const material = await findMaterialById(materialLink.materialId, companyId);
                
                if (!material) {
                    console.warn(`MaterialV2 not found for ID: ${materialLink.materialId} in ProductType ${productType.name}. This material may have been deleted or migrated. Skipping.`);
                    continue;
                }
                
                const materialIdString = material._id.toString();

                // --- CRITICAL UNIT CONVERSION FOR INPUTS ---
                const widthConversion = convertUnit(
                    parseFloat(item.width.toString()),
                    estimation.dimensionUnitUsed,
                    materialLink.formulaInputUnit
                );
                const heightConversion = convertUnit(
                    parseFloat(item.height.toString()),
                    estimation.dimensionUnitUsed,
                    materialLink.formulaInputUnit
                );

                if (widthConversion.error || heightConversion.error) {
                    throw new Error(`Unit conversion error: ${widthConversion.error || heightConversion.error} (MaterialV2: ${material.name}, From: ${estimation.dimensionUnitUsed}, To: ${materialLink.formulaInputUnit})`);
                }
                
                const itemWidthInFormulaUnit = widthConversion.result;
                const itemHeightInFormulaUnit = heightConversion.result;

                // This check might be redundant now if convertUnit itself throws or returns error for NaN result
                if (itemWidthInFormulaUnit === null || itemHeightInFormulaUnit === null || isNaN(itemWidthInFormulaUnit) || isNaN(itemHeightInFormulaUnit)) {
                    throw new Error(`Unit conversion failed for item dimensions for material ${material.name}. Check units: ${estimation.dimensionUnitUsed} to ${materialLink.formulaInputUnit}. Values: W=${item.width}, H=${item.height}`);
                }

                // Evaluate formulas for this material
                const formulaResults = materialLink.formulas.map(formulaStr => {
                    const evalResult = evaluateFormula(formulaStr, {
                        W: itemWidthInFormulaUnit, // Use converted width
                        H: itemHeightInFormulaUnit  // Use converted height
                    });

                    if (evalResult.error) {
                        throw new Error(`Formula error for material ${material.name} (Product: ${productType.name}): ${evalResult.error}`);
                    }

                    let evalResultForConversion = evalResult.result;
                    let sourceUnitForConversion = materialLink.formulaInputUnit;

                    const formulaInputUnitType = getUnitType(materialLink.formulaInputUnit);
                    const quantityUnitType = getUnitType(materialLink.quantityUnit);

                    if (formulaInputUnitType === 'linear' && quantityUnitType === 'area') {
                        const baseUnit = materialLink.formulaInputUnit.toLowerCase();
                        let potentialSqUnit = '';

                        if (baseUnit === 'inches' || baseUnit === 'in') potentialSqUnit = 'sqin';
                        else if (baseUnit === 'feet' || baseUnit === 'ft') potentialSqUnit = 'sqft';
                        else if (baseUnit === 'millimeters' || baseUnit === 'mm') potentialSqUnit = 'sqmm';
                        else if (baseUnit === 'centimeters' || baseUnit === 'cm') potentialSqUnit = 'sqcm';
                        else if (baseUnit === 'meters' || baseUnit === 'm') potentialSqUnit = 'sqm';
                        
                        if (SUPPORTED_AREA_UNITS.includes(potentialSqUnit)) {
                            sourceUnitForConversion = potentialSqUnit;
                        } else {
                            throw new Error(`Cannot form a valid square unit for material "${material.name}". Linear formula input: '${materialLink.formulaInputUnit}', Area quantity unit: '${materialLink.quantityUnit}'. Attempted squared unit ('${potentialSqUnit}' derived from '${baseUnit}') is not a supported area unit for conversion.`);
                        }
                    }

                    let resultInUsageUnit = evalResultForConversion;
                    if (sourceUnitForConversion.toLowerCase() !== materialLink.quantityUnit.toLowerCase()) {
                        const outputConversion = convertUnit(
                            evalResultForConversion,
                            sourceUnitForConversion,
                            materialLink.quantityUnit // This is the material.usageUnit essentially
                        );
                        if (outputConversion.error) {
                            throw new Error(`Formula output unit conversion error: ${outputConversion.error} (MaterialV2: ${material.name}, From: ${sourceUnitForConversion}, To: ${materialLink.quantityUnit}, Raw eval result: ${evalResultForConversion})`);
                        }
                        resultInUsageUnit = outputConversion.result;
                    }
                    
                    if (resultInUsageUnit === null || isNaN(resultInUsageUnit)) {
                         throw new Error(`Formula output unit conversion resulted in invalid value for material ${material.name}. Check units: ${sourceUnitForConversion} to ${materialLink.quantityUnit}. Raw eval: ${evalResultForConversion}`);
                    }

                    // For each item.quantity, we have a formulaResult.
                    // If it's a profile, this resultInUsageUnit is a single cut length.
                    // We need to collect all such cut lengths.
                    const individualQuantities = Array(item.quantity).fill(resultInUsageUnit);
                    return individualQuantities; // Return an array of lengths for this formula & item quantity
                });

                // Flatten the array of arrays of lengths
                const allCutLengthsForItemMaterial = formulaResults.flat();

                if (material.category === 'Profile') {
                    if (!profileMaterialCuts[materialIdString]) {
                        profileMaterialCuts[materialIdString] = {
                            material: material, // Store the material object for later use
                            cuts: []
                        };
                    }
                    // Convert all cut lengths to feet for profileCuttingUtil
                    allCutLengthsForItemMaterial.forEach(cutLength => {
                        // materialLink.quantityUnit is the unit of 'cutLength' (e.g. inches, mm, ft)
                        // It should align with material.usageUnit
                        const conversionToFt = convertUnit(cutLength, material.usageUnit, 'ft');
                        if (conversionToFt.error) {
                            throw new Error(`Error converting profile cut length to feet for material ${material.name}: ${conversionToFt.error}. From ${material.usageUnit} to ft. Value: ${cutLength}`);
                        }
                        if (conversionToFt.result === null || isNaN(conversionToFt.result)) {
                            throw new Error(`Failed to convert profile cut length to feet for ${material.name}. From ${material.usageUnit} to ft. Value: ${cutLength} resulted in ${conversionToFt.result}`);
                        }
                        profileMaterialCuts[materialIdString].cuts.push(conversionToFt.result);
                    });
                } else { // For non-profile materials, sum quantities as before
                    const totalQuantityForMaterialItem = allCutLengthsForItemMaterial.reduce((sum, qty) => sum + qty, 0);
                    
                    // Handle Wire Mesh with width optimization
                    if (material.category === 'Wire Mesh') {
                        // Wire Mesh requires special handling with width optimization
                        // Expect formulas to be: [width_formula, length_formula]
                        
                        // Check if Wire Mesh has proper formula configuration
                        if (materialLink.formulas.length < 2) {
                            console.warn(`[EstimationService] Wire Mesh material "${material.name}" has ${materialLink.formulas.length} formula(s): [${materialLink.formulas.join(', ')}]. Expected 2 formulas: [width_formula, length_formula].`);
                            
                            // Provide fallback for Wire Mesh with insufficient formulas
                            if (materialLink.formulas.length === 1) {
                                console.warn(`[EstimationService] Using fallback: treating single formula as area calculation for Wire Mesh "${material.name}".`);
                                
                                // Fallback: treat as regular material with area calculation
                                const fallbackAreaCalculation = totalQuantityForMaterialItem;
                                
                                // Auto-fill rate for Wire Mesh
                                let candidateRateValue;
                                let candidateRateUnit;

                                if (material.unitRateForStockUnit != null && material.stockUnit) {
                                    candidateRateValue = material.unitRateForStockUnit;
                                    candidateRateUnit = material.stockUnit;
                                } else if (material.unitRate != null) {
                                    candidateRateValue = material.unitRate;
                                    candidateRateUnit = material.purchaseUnit || material.usageUnit || 'sqft';
                                } else {
                                    candidateRateValue = '0';
                                    candidateRateUnit = material.usageUnit || 'sqft';
                                }

                                const materialData = {
                                    materialId: material._id,
                                    materialNameSnapshot: material.name,
                                    materialCategorySnapshot: material.category,
                                    totalQuantity: toDecimal128(fallbackAreaCalculation.toFixed(2)),
                                    quantityUnit: material.usageUnit,
                                    totalWeight: toDecimal128('0', '0.000'),
                                    weightUnit: 'N/A',
                                    autoUnitRate: toDecimal128(candidateRateValue),
                                    autoRateUnit: candidateRateUnit,
                                    manualUnitRate: toDecimal128('0.00'),
                                    calculatedCost: toDecimal128('0.00'),
                                    // Add a warning flag for missing optimization
                                    configurationWarning: `Wire Mesh "${material.name}" is missing width optimization. Please configure 2 formulas: [width_formula, length_formula] for optimal material usage.`
                                };

                                if (!calculatedMaterialsMap[materialIdString]) {
                                    calculatedMaterialsMap[materialIdString] = materialData;
                                } else {
                                    const existingQuantity = parseFloat(calculatedMaterialsMap[materialIdString].totalQuantity.toString());
                                    calculatedMaterialsMap[materialIdString].totalQuantity = toDecimal128((existingQuantity + fallbackAreaCalculation).toFixed(2));
                                }

                                console.log(`[EstimationService] Wire Mesh ${material.name}: Fallback calculation ${fallbackAreaCalculation.toFixed(2)} ${material.usageUnit} (no optimization applied)`);
                                
                            } else {
                                // No formulas or empty formulas - provide helpful error
                                throw new Error(`Wire Mesh material "${material.name}" configuration error:
                                
Current formulas: [${materialLink.formulas.join(', ')}] (${materialLink.formulas.length} formula${materialLink.formulas.length !== 1 ? 's' : ''})
Required: Exactly 2 formulas for width optimization

To fix this:
1. Go to Products section
2. Edit the product that uses "${material.name}"
3. Configure exactly 2 formulas for the Wire Mesh material:
   - Formula 1 (width): e.g., "W + 0.1" (window width + margin)
   - Formula 2 (length): e.g., "H + 0.1" (window height + margin)

This enables automatic width optimization and reduces material waste.`);
                            }
                            
                        } else {
                            // Wire Mesh has proper 2+ formulas - proceed with optimization
                            
                            // For Wire Mesh with 2+ formulas: treat like glass system
                            // Formula 1 (index 0): Width formula (e.g., "W/2" for sash)
                            // Formula 2 (index 1): Height formula (e.g., "H" for full height)
                            try {
                                // Evaluate width formula (first formula)
                                const widthFormulaResult = evaluateFormula(materialLink.formulas[0], {
                                    W: itemWidthInFormulaUnit,
                                    H: itemHeightInFormulaUnit
                                });

                                if (widthFormulaResult.error) {
                                    throw new Error(`Width formula error for Wire Mesh ${material.name}: ${widthFormulaResult.error}`);
                                }

                                // Evaluate height formula (second formula)
                                const heightFormulaResult = evaluateFormula(materialLink.formulas[1], {
                                    W: itemWidthInFormulaUnit,
                                    H: itemHeightInFormulaUnit
                                });

                                if (heightFormulaResult.error) {
                                    throw new Error(`Height formula error for Wire Mesh ${material.name}: ${heightFormulaResult.error}`);
                                }

                                const requiredWidth = widthFormulaResult.result;
                                const requiredLength = heightFormulaResult.result;

                                console.log(`[EstimationService] Wire Mesh ${material.name}: Required dimensions ${requiredWidth} × ${requiredLength} ${materialLink.formulaInputUnit}`);

                                // Use Wire Mesh optimization service with separate dimensions
                                const optimizationResult = await WireMeshOptimizationService.calculateWireMeshConsumption(
                                    material,
                                    requiredWidth,   // Calculated width from formula 1
                                    requiredLength,  // Calculated height from formula 2
                                    materialLink.formulaInputUnit
                                );

                                // Log if orientation was swapped
                                if (optimizationResult.orientationUsed === 'swapped') {
                                    console.log(`[EstimationService] Wire Mesh ${material.name}: Orientation swapped - using ${optimizationResult.selectedWidth}${optimizationResult.unit} width × ${optimizationResult.actualLength}${optimizationResult.unit} length`);
                                } else {
                                    console.log(`[EstimationService] Wire Mesh ${material.name}: Original orientation - using ${optimizationResult.selectedWidth}${optimizationResult.unit} width × ${optimizationResult.actualLength || optimizationResult.requiredLength}${optimizationResult.unit} length`);
                                }

                                // Convert to usage unit if needed
                                const finalAreaUnit = material.usageUnit;
                                let finalArea = optimizationResult.actualArea;
                                let finalWastage = optimizationResult.wastageArea;

                                if (optimizationResult.areaUnit !== finalAreaUnit) {
                                    const areaConversion = convertUnit(
                                        optimizationResult.actualArea,
                                        optimizationResult.areaUnit,
                                        finalAreaUnit
                                    );
                                    
                                    const wastageConversion = convertUnit(
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
                                const totalOptimizedArea = optimizedAreaPerItem * item.quantity;

                                // Store Wire Mesh specific details
                                const materialData = {
                                    materialId: material._id,
                                    materialNameSnapshot: material.name,
                                    materialCategorySnapshot: material.category,
                                    totalQuantity: toDecimal128(totalOptimizedArea.toFixed(2)),
                                    quantityUnit: finalAreaUnit,
                                    totalWeight: toDecimal128('0', '0.000'),
                                    weightUnit: 'N/A',
                                    // Include optimization details
                                    wireMeshOptimization: {
                                        requiredWidthPerItem: optimizationResult.requiredWidth,
                                        requiredLengthPerItem: optimizationResult.requiredLength,
                                        selectedWidthPerItem: optimizationResult.selectedWidth,
                                        actualLengthPerItem: optimizationResult.actualLength || optimizationResult.requiredLength,
                                        requiredAreaPerItem: optimizationResult.requiredArea,
                                        actualAreaPerItem: optimizationResult.actualArea,
                                        wastageAreaPerItem: optimizationResult.wastageArea,
                                        wastagePercentage: optimizationResult.wastagePercentage,
                                        efficiency: optimizationResult.efficiency,
                                        optimizationType: optimizationResult.optimizationType,
                                        orientationUsed: optimizationResult.orientationUsed || 'original',
                                        totalItems: item.quantity,
                                        totalWastageArea: optimizationResult.wastageArea * item.quantity,
                                        // Add formula tracking for debugging
                                        widthFormula: materialLink.formulas[0],
                                        heightFormula: materialLink.formulas[1]
                                    }
                                };

                                // Auto-fill rate for Wire Mesh
                                let candidateRateValue;
                                let candidateRateUnit;

                                if (material.unitRateForStockUnit != null && material.stockUnit) {
                                    candidateRateValue = material.unitRateForStockUnit;
                                    candidateRateUnit = material.stockUnit;
                                } else if (material.unitRate != null) {
                                    candidateRateValue = material.unitRate;
                                    candidateRateUnit = material.purchaseUnit || material.usageUnit || 'sqft';
                                } else {
                                    candidateRateValue = '0';
                                    candidateRateUnit = material.usageUnit || 'sqft';
                                }

                                materialData.autoUnitRate = toDecimal128(candidateRateValue);
                                materialData.autoRateUnit = candidateRateUnit;
                                materialData.manualUnitRate = toDecimal128('0.00');
                                materialData.calculatedCost = toDecimal128('0.00');

                                if (!calculatedMaterialsMap[materialIdString]) {
                                    calculatedMaterialsMap[materialIdString] = materialData;
                                } else {
                                    // Aggregate Wire Mesh materials
                                    const existingQuantity = parseFloat(calculatedMaterialsMap[materialIdString].totalQuantity.toString());
                                    const existingWastage = calculatedMaterialsMap[materialIdString].wireMeshOptimization?.totalWastageArea || 0;
                                    
                                    calculatedMaterialsMap[materialIdString].totalQuantity = toDecimal128((existingQuantity + totalOptimizedArea).toFixed(2));
                                    
                                    // Update Wire Mesh optimization totals
                                    if (calculatedMaterialsMap[materialIdString].wireMeshOptimization) {
                                        calculatedMaterialsMap[materialIdString].wireMeshOptimization.totalItems += item.quantity;
                                        calculatedMaterialsMap[materialIdString].wireMeshOptimization.totalWastageArea = existingWastage + (optimizationResult.wastageArea * item.quantity);
                                    }
                                }

                                console.log(`[EstimationService] Wire Mesh ${material.name}: Optimized ${totalOptimizedArea.toFixed(2)} ${finalAreaUnit} (efficiency: ${optimizationResult.efficiency}%, selected width: ${optimizationResult.selectedWidth}${optimizationResult.unit})`);

                            } catch (optimizationError) {
                                console.error('Wire Mesh optimization error in estimation:', optimizationError);
                                throw new Error(`Wire Mesh optimization failed for ${material.name}: ${optimizationError.message}`);
                            }
                        }

                    } else {
                        // Handle other non-profile materials (Glass, Hardware, Accessories, Consumables) as before
                        
                        // --- Auto-fill rate (Non-Profile) ---
                        let candidateRateValue;
                        let candidateRateUnit;

                        if (material.unitRateForStockUnit != null && material.stockUnit) {
                            candidateRateValue = material.unitRateForStockUnit;
                            candidateRateUnit = material.stockUnit;
                            console.log(`[EstimationService] Non-profile ${material.name}: Using unitRateForStockUnit: ${candidateRateValue} per ${candidateRateUnit}`);
                        } else if (material.unitRate != null) {
                            candidateRateValue = material.unitRate;
                            candidateRateUnit = material.purchaseUnit || material.usageUnit || 'pcs';
                            console.log(`[EstimationService] Non-profile ${material.name}: Using unitRate: ${candidateRateValue} per ${candidateRateUnit} (purchase/usage unit)`);
                        } else {
                            candidateRateValue = '0'; // Default to 0 if no rate is found
                            candidateRateUnit = material.purchaseUnit || material.usageUnit || 'pcs';
                            console.log(`[EstimationService] Non-profile ${material.name}: No specific rate found, defaulting to 0 per ${candidateRateUnit}`);
                        }
                        
                        const autoUnitRate = toDecimal128(candidateRateValue);
                        const autoRateUnit = candidateRateUnit;

                        if (parseFloat(autoUnitRate.toString()) === 0 && candidateRateValue != null && parseFloat(candidateRateValue.toString()) !== 0) {
                            console.log(`[EstimationService] Rate for non-profile materialId: ${material._id} (${material.name}) was processed as 0. Original value: ${candidateRateValue}, Original Unit: ${candidateRateUnit}`);
                        }
                        if (candidateRateValue == null || (typeof candidateRateValue === 'string' && parseFloat(candidateRateValue) === 0 && candidateRateValue !== '0')) { // Log if original was null/undefined or a non-"0" string that parsed to 0
                            console.log(`[EstimationService] Rate not found or was zero for non-profile materialId: ${material._id} (${material.name}), AutoRateUnit: ${autoRateUnit}. Fallback to 0 rate.`);
                        }
                        // --- End Auto-fill rate (Non-Profile) ---

                        if (!calculatedMaterialsMap[materialIdString]) {
                            calculatedMaterialsMap[materialIdString] = {
                                materialId: material._id,
                                materialNameSnapshot: material.name,
                                materialCategorySnapshot: material.category,
                                totalQuantity: toDecimal128(totalQuantityForMaterialItem.toFixed(2)),
                                quantityUnit: material.usageUnit,
                                totalWeight: toDecimal128('0', '0.000'),
                                weightUnit: 'N/A',
                                autoUnitRate: autoUnitRate,
                                autoRateUnit: autoRateUnit,
                                manualUnitRate: toDecimal128('0.00'),
                                calculatedCost: toDecimal128('0.00')
                            };
                        } else {
                            const existingQuantity = parseFloat(calculatedMaterialsMap[materialIdString].totalQuantity.toString());
                            calculatedMaterialsMap[materialIdString].totalQuantity = toDecimal128((existingQuantity + totalQuantityForMaterialItem).toFixed(2));
                            
                            if (!calculatedMaterialsMap[materialIdString].autoUnitRate || parseFloat(calculatedMaterialsMap[materialIdString].autoUnitRate.toString()) === 0) {
                            calculatedMaterialsMap[materialIdString].autoUnitRate = autoUnitRate;
                            calculatedMaterialsMap[materialIdString].autoRateUnit = autoRateUnit;
                            }
                        }
                    }
                }
            }
        }

        // After processing all items, calculate profile consumption
        for (const materialIdString in profileMaterialCuts) {
            const profileData = profileMaterialCuts[materialIdString];
            const material = profileData.material;
            const allCuts_ft = profileData.cuts;

            if (allCuts_ft.length > 0) {
                try {
                    // ---- TEMPORARY LOGGING START ----
                    console.log(`[PROFILE CUTTING DEBUG] MaterialV2: ${material.name} (ID: ${materialIdString})`);
                    console.log(`[PROFILE CUTTING DEBUG] Company ID: ${companyId.toString()}`);
                    console.log(`[PROFILE CUTTING DEBUG] Required Cuts (ft): ${JSON.stringify(allCuts_ft)}`);
                    console.log(`[PROFILE CUTTING DEBUG] MaterialV2 Standard Lengths: ${JSON.stringify(material.standardLengths)}`);
                    
                    // Check if material has standardLengths defined
                    if (!material.standardLengths || material.standardLengths.length === 0) {
                        console.warn(`[EstimationService] Profile material "${material.name}" has no standardLengths defined. This will prevent optimization. Skipping profile calculation.`);
                        
                        // Provide a warning in the material data instead of failing
                        const warningMessage = `Profile material "${material.name}" is missing standard lengths configuration. Please add standard lengths in the material inventory to enable cutting optimization.`;
                        
                        if (!calculatedMaterialsMap[materialIdString]) {
                            calculatedMaterialsMap[materialIdString] = {
                                materialId: material._id,
                                materialNameSnapshot: material.name,
                                materialCategorySnapshot: material.category,
                                totalQuantity: toDecimal128(allCuts_ft.reduce((sum, cut) => sum + cut, 0).toFixed(2)),
                                quantityUnit: 'ft',
                                totalWeight: toDecimal128('0', '0.000'),
                                weightUnit: 'N/A',
                                autoUnitRate: toDecimal128('0.00'),
                                autoRateUnit: material.usageUnit || 'ft',
                                manualUnitRate: toDecimal128('0.00'),
                                calculatedCost: toDecimal128('0.00'),
                                configurationWarning: warningMessage,
                                // Add raw cuts data for debugging
                                rawCutsData: {
                                    cuts: allCuts_ft,
                                    totalLength: allCuts_ft.reduce((sum, cut) => sum + cut, 0),
                                    message: 'No optimization applied - missing standard lengths'
                                }
                            };
                        }
                        
                        console.log(`[EstimationService] Profile ${material.name}: Fallback calculation ${allCuts_ft.reduce((sum, cut) => sum + cut, 0).toFixed(2)} ft total (no optimization applied)`);
                        continue; // Skip to next material
                    }
                    // ---- TEMPORARY LOGGING END ----

                    const consumptionResult = await calculateProfileConsumption(
                        material, // Pass the full material object
                        companyId.toString(),
                        allCuts_ft
                    );

                    // Calculate total weight for profile materials
                    let totalWeight = 0;
                    let weightUnit = material.weightUnit || 'kg'; // Default to kg if not specified
                    let weightCalculationPossible = true;
                    let determinedWeightPerFoot = 0;
                    let gaugeUsedForWeight = estimation.gauge || 'N/A';

                    // Find the weightPerUnitLength (assumed per foot for now)
                    if (estimation.gauge && material.gaugeSpecificWeights && material.gaugeSpecificWeights.length > 0) {
                        const gaugeWeight = material.gaugeSpecificWeights.find(gw => gw.gauge && gw.gauge.toString() === estimation.gauge.toString());
                        if (gaugeWeight && gaugeWeight.weightPerUnitLength != null) {
                            determinedWeightPerFoot = parseFloat(gaugeWeight.weightPerUnitLength.toString());
                        } else {
                            // Gauge specified in estimation, but no matching gauge weight or weightPerUnitLength is null
                            console.warn(`[WeightCalc] ${material.name}: Gauge ${estimation.gauge} specified in estimation, but no matching or valid weight found in gaugeSpecificWeights. Attempting fallback.`);
                        }
                    }
                    
                    // Fallback if determinedWeightPerFoot is still 0 (or was not found above)
                    if (determinedWeightPerFoot === 0 && material.gaugeSpecificWeights && material.gaugeSpecificWeights.length > 0) {
                        // Try defaultGauge on material if it exists
                        let defaultGaugeEntry = null;
                        if (material.defaultGauge) {
                            defaultGaugeEntry = material.gaugeSpecificWeights.find(gw => gw.gauge && gw.gauge.toString() === material.defaultGauge.toString());
                            if (defaultGaugeEntry && defaultGaugeEntry.weightPerUnitLength != null) {
                                determinedWeightPerFoot = parseFloat(defaultGaugeEntry.weightPerUnitLength.toString());
                                gaugeUsedForWeight = material.defaultGauge.toString();
                                console.log(`[WeightCalc] ${material.name}: Used defaultGauge ${gaugeUsedForWeight} from material.`);
                            }
                        }
                        // If no defaultGauge or it wasn't found/valid, try the first available gaugeSpecificWeight
                        if (determinedWeightPerFoot === 0) {
                            const firstValidGaugeWeight = material.gaugeSpecificWeights.find(gw => gw.weightPerUnitLength != null);
                            if (firstValidGaugeWeight) {
                                determinedWeightPerFoot = parseFloat(firstValidGaugeWeight.weightPerUnitLength.toString());
                                gaugeUsedForWeight = firstValidGaugeWeight.gauge ? firstValidGaugeWeight.gauge.toString() : 'first_available';
                                console.warn(`[WeightCalc] ${material.name}: Used first available valid weight from gaugeSpecificWeights (gauge: ${gaugeUsedForWeight}). Estimation gauge was ${estimation.gauge || 'not set'}.`);
                            }
                        }
                    }

                    // Super fallback to material.weightPerUnitLength if still no specific gauge weight
                    if (determinedWeightPerFoot === 0 && material.weightPerUnitLength != null) {
                        determinedWeightPerFoot = parseFloat(material.weightPerUnitLength.toString());
                        gaugeUsedForWeight = 'material_default'; // Indicates it used the material's top-level weightPerUnitLength
                         console.log(`[WeightCalc] ${material.name}: Used material.weightPerUnitLength as fallback.`);
                    }

                    if (isNaN(determinedWeightPerFoot) || determinedWeightPerFoot <= 0) {
                        console.warn(`[WeightCalc] ${material.name}: Determined weightPerUnitLength is invalid or zero (${determinedWeightPerFoot}). Weight calculation not possible.`);
                        weightCalculationPossible = false;
                    } else {
                        // Assumption: determinedWeightPerFoot is per FOOT.
                        // TODO: Make this robust by checking a unit field associated with weightPerUnitLength (e.g., material.weightPerUnitLengthUnit)
                        const weightPerInch = determinedWeightPerFoot / 12.0;
                        for (const pipeInfo of consumptionResult.pipesTakenPerStandardLength) {
                            const pipeLengthInches = pipeInfo.lengthInInches;
                            totalWeight += pipeInfo.count * pipeLengthInches * weightPerInch;
                        }
                    }
                    
                    if (!weightCalculationPossible) totalWeight = 0; 

                    console.log(`[WeightCalc] ${material.name}:`, {
                        gaugeUsed: gaugeUsedForWeight,
                        finalWeightPerFoot: weightCalculationPossible ? determinedWeightPerFoot : 'N/A',
                        breakdownForWeightCalc: consumptionResult.pipesTakenPerStandardLength.map(p => ({ l_in: p.lengthInInches, c: p.count})),
                        calculatedTotalWeight: totalWeight,
                        finalWeightUnit: weightCalculationPossible ? weightUnit : 'N/A'
                    });

                    // --- Auto-fill rate (Profile) ---
                    let candidateRateValue;
                    let candidateRateUnit = material.purchaseUnit || material.usageUnit || 'pcs'; // Default purchase/usage unit

                    // Prioritize unitRateForStockUnit if stockUnit is defined and is a weight unit (matches weightUnit for costing)
                    // or if it's the primary way this material is priced.
                    if (material.unitRateForStockUnit != null && material.stockUnit) {
                        // If material.stockUnit is a weight unit (e.g., 'kg', 'lb') and matches the calculated weightUnit, this is ideal.
                        // Or, if stockUnit implies the pricing (e.g. company always buys/prices this profile per kg)
                        candidateRateValue = material.unitRateForStockUnit;
                        candidateRateUnit = material.stockUnit; 
                    } else if (material.unitRate != null) {
                        // Fallback to the general material.unitRate and its purchaseUnit
                        candidateRateValue = material.unitRate;
                        candidateRateUnit = material.purchaseUnit || candidateRateUnit; // Keep original candidateRateUnit if purchaseUnit is null
                    } else {
                        // No rate found on material or stockByLength specifically for this logic
                        candidateRateValue = '0'; // Default to 0 if no rate is found
                        // candidateRateUnit remains the default from initialization
                    }

                    const autoUnitRate = toDecimal128(candidateRateValue);
                    const autoRateUnit = candidateRateUnit;
            
                    if (parseFloat(autoUnitRate.toString()) === 0 && candidateRateValue != null && parseFloat(candidateRateValue.toString()) !== 0) {
                         console.log(`[EstimationService] Profile Rate for ${material.name} (ID: ${material._id}) was processed as 0. Original value: ${candidateRateValue}, Original Unit: ${candidateRateUnit}`);
                    }
                    if (candidateRateValue == null || (typeof candidateRateValue === 'string' && parseFloat(candidateRateValue) === 0)) {
                        console.log(`[EstimationService] Profile Rate not found or was zero for ${material.name} (ID: ${material._id}). AutoRateUnit: ${autoRateUnit}. Fallback to 0 rate.`);
                    }
                    // --- End Auto-fill rate (Profile) ---

                    // Now, add/update this profile material in calculatedMaterialsMap
                    if (!calculatedMaterialsMap[materialIdString]) {
                        calculatedMaterialsMap[materialIdString] = {
                            materialId: material._id,
                            materialNameSnapshot: material.name,
                            materialCategorySnapshot: material.category,
                            totalQuantity: toDecimal128(consumptionResult.totalPipesFromStock.toString()),
                            quantityUnit: 'pipes',
                            pipeBreakdown: consumptionResult.pipesTakenPerStandardLength.map(p => ({ 
                                ...p, 
                                length: toDecimal128(p.length.toString())
                            })),
                            totalWeight: toDecimal128(totalWeight.toFixed(3), '0.000'),
                            weightUnit: weightCalculationPossible ? weightUnit : 'N/A',
                            autoUnitRate: autoUnitRate, 
                            autoRateUnit: autoRateUnit,
                            manualUnitRate: toDecimal128('0.00'),
                            calculatedCost: toDecimal128('0.00')
                        };
                    } else {
                        console.warn(`Profile material ${material.name} was unexpectedly found in calculatedMaterialsMap before profile calculation. Overwriting.`);
                        calculatedMaterialsMap[materialIdString].totalQuantity = toDecimal128(consumptionResult.totalPipesFromStock.toString());
                        calculatedMaterialsMap[materialIdString].quantityUnit = 'pipes';
                        calculatedMaterialsMap[materialIdString].pipeBreakdown = consumptionResult.pipesTakenPerStandardLength.map(p => ({ 
                            ...p, 
                            length: toDecimal128(p.length.toString())
                        }));
                        calculatedMaterialsMap[materialIdString].totalWeight = toDecimal128(totalWeight.toFixed(3), '0.000');
                        calculatedMaterialsMap[materialIdString].weightUnit = weightCalculationPossible ? weightUnit : 'N/A';
                        calculatedMaterialsMap[materialIdString].autoUnitRate = autoUnitRate;
                        calculatedMaterialsMap[materialIdString].autoRateUnit = autoRateUnit;
                        calculatedMaterialsMap[materialIdString].manualUnitRate = calculatedMaterialsMap[materialIdString].manualUnitRate || toDecimal128('0.00');
                    }
                } catch (error) {
                    console.error(`Error calculating profile consumption for material ${material.name} (ID: ${materialIdString}):`, error);
                    throw new Error(`Failed to calculate consumption for profile ${material.name}: ${error.message}`);
                }
            }
        }

        // --- GLASS CALCULATION ---
        // Process glass calculations for all items
        console.log(`[EstimationService] Starting glass calculation for estimation ${estimationId}`);
        const glassCalculations = [];
        for (const item of estimation.items) {
            const productType = await ProductType.findOne({ 
                _id: item.productTypeId, 
                companyId: companyId 
            });

            if (!productType) {
                continue;
            }

            console.log(`[EstimationService] Processing glass for item ${item._id}, selectedGlassTypeId: ${item.selectedGlassTypeId}, productType: ${productType.name}`);

            // Calculate glass for this item
            const glassCalc = await EstimationService.calculateGlassForItem(
                item, 
                productType, 
                estimation.dimensionUnitUsed, 
                companyId
            );

            console.log(`[EstimationService] Glass calculation result:`, {
                hasGlass: glassCalc.hasGlass,
                error: glassCalc.error,
                glassMaterial: glassCalc.glassMaterial ? glassCalc.glassMaterial.name : 'null',
                glassQuantity: glassCalc.glassQuantityPerItem
            });

            // Add item reference for source tracking
            glassCalc.itemId = item._id;
            glassCalculations.push(glassCalc);

            // Update item with glass calculation details
            if (glassCalc.hasGlass && !glassCalc.error) {
                item.calculatedGlassQuantity = toDecimal128(glassCalc.glassQuantityPerItem.toString());
                item.calculatedGlassUnit = glassCalc.glassUnit;
                item.calculatedGlassCost = toDecimal128(glassCalc.totalGlassCost.toString());
                
                // Update glass type name snapshot if material was found
                if (glassCalc.glassMaterial) {
                    item.selectedGlassTypeNameSnapshot = glassCalc.glassMaterial.name;
                }
            }
        }

        // Aggregate glass materials and add to calculatedMaterials
        const aggregatedGlassMap = EstimationService.aggregateGlassMaterials(glassCalculations);
        console.log(`[EstimationService] Aggregated glass materials:`, Object.keys(aggregatedGlassMap).length);
        
        // Add glass materials to calculatedMaterialsMap
        for (const glassMaterial of Object.values(aggregatedGlassMap)) {
            const glassMatIdString = glassMaterial.materialId.toString();
            calculatedMaterialsMap[glassMatIdString] = glassMaterial;
            console.log(`[EstimationService] Added glass material to calculatedMaterialsMap: ${glassMaterial.materialNameSnapshot}`);
        }

        estimation.calculatedMaterials = Object.values(calculatedMaterialsMap);
        
        // --- LABOUR COST CALCULATION ---
        try {
            // Fetch company settings. While specific rounding/minimums for labour area are now in quotationCalculator.js,
            // other settings (like default units) might still be relevant generally or for future enhancements.
            const companySettings = await Setting.findOne({ companyId: companyId }).lean() || {};
            
            // Prepare settings to pass to labourCostService. For now, it doesn't strictly need these
            // for area calculation as `calculateItemDetails` has its own rules, but passing a general settings
            // object is fine and allows for future flexibility if labourCostService needs other settings.
            const settingsForLabour = {
                areaUnitDefault: companySettings.units?.area || 'sqft'
                // No longer passing roundingRuleDefault or minimumAreaDefault explicitly for labour calculations,
                // as those are now handled by the specific logic in `calculateItemDetails`.
            };

            // Fetch all product types with labour cost data
            const productTypeIds = [...new Set(estimation.items.map(item => item.productTypeId.toString()))];
            const productTypes = await ProductType.find({
                _id: { $in: productTypeIds },
                companyId: companyId
            });
            
            // Create product types map
            const productTypesMap = {};
            productTypes.forEach(pt => {
                productTypesMap[pt._id.toString()] = pt;
            });
            
            // Calculate material costs by product type for percentage-based labour
            const materialCostsByProduct = {};
            estimation.items.forEach(item => {
                const productTypeId = item.productTypeId.toString();
                if (!materialCostsByProduct[productTypeId]) {
                    materialCostsByProduct[productTypeId] = 0;
                }
                
                // Sum material costs for this product type
                estimation.calculatedMaterials.forEach(material => {
                    // Find which product type this material belongs to by checking formulas
                    const productType = productTypes.find(pt => 
                        pt.materials.some(mat => mat.materialId.toString() === material.materialId.toString())
                    );
                    if (productType && productType._id.toString() === productTypeId) {
                        materialCostsByProduct[productTypeId] += parseFloat(material.calculatedCost.toString());
                    }
                });
            });
            
            // Calculate labour costs
            const newLabourCharges = calculateLabourCosts(
                estimation.items,
                productTypesMap,
                estimation.dimensionUnitUsed,
                materialCostsByProduct,
                settingsForLabour // Pass the potentially simplified settings object
            );
            
            // Merge with existing manual charges
            estimation.manualCharges = mergeLabourCharges(estimation.manualCharges, newLabourCharges);
            
            console.log(`[EstimationService] Generated ${newLabourCharges.length} labour charges for estimation ${estimationId}`);
            
        } catch (error) {
            console.error(`Error calculating labour costs for estimation ${estimationId}:`, error);
            // Don't throw - labour cost calculation failure shouldn't break material calculation
        }
        // --- END LABOUR COST CALCULATION ---
        
        estimation.status = 'Calculated';
        await estimation.save();

        console.log(`[EstimationService] Material calculation completed for estimation ${estimationId}. Found ${Object.keys(calculatedMaterialsMap).length} materials`);
        
        // Validate estimation object before returning
        if (!estimation || !estimation._id) {
            console.error(`[EstimationService] Invalid estimation object after calculation:`, estimation);
            throw new Error('Invalid estimation object after calculation');
        }

        return estimation;
    }

    /**
     * Create a new estimation
     * @param {Object} estimationData - Estimation data
     * @param {string} companyId - Company ID for multi-tenancy
     * @param {string} userId - User creating the estimation
     * @returns {Object} Created estimation
     */
    async createEstimation(estimationData, companyId, userId) {
        const estimation = new Estimation({
            ...estimationData,
            companyId,
            createdBy: userId,
            status: 'Draft'
        });

        await estimation.save();
        return estimation;
    }

    /**
     * Update an existing estimation
     * @param {string} estimationId - ID of the estimation to update
     * @param {Object} updateData - Data to update
     * @param {string} companyId - Company ID for multi-tenancy
     * @returns {Object} Updated estimation
     */
    async updateEstimation(estimationId, updateData, companyId) {
        const estimation = await Estimation.findOne({ 
            _id: estimationId, 
            companyId: companyId 
        });

        if (!estimation) {
            throw new Error('Estimation not found');
        }

        // Handle top-level fields first (excluding nested arrays we manage manually)
        const { calculatedMaterials: updatedCalculatedMaterials, manualCharges: updatedManualCharges, items: updatedItems, ...otherUpdateData } = updateData;
        Object.assign(estimation, otherUpdateData);

        // Explicitly update calculatedMaterials if provided in updateData
        if (updatedCalculatedMaterials && Array.isArray(updatedCalculatedMaterials)) {
            const materialsToUpdate = [];
            updatedCalculatedMaterials.forEach(updatedMat => {
                const existingMat = estimation.calculatedMaterials.find(em => em.materialId.toString() === updatedMat.materialId.toString());
                
                let rateToStore = '0.00';
                if (updatedMat.manualUnitRate !== undefined && updatedMat.manualUnitRate !== null) {
                    rateToStore = updatedMat.manualUnitRate.toString(); 
                }

                let manualRateUnitToStore = '';
                if (updatedMat.manualRateUnit !== undefined && updatedMat.manualRateUnit !== null) {
                    manualRateUnitToStore = updatedMat.manualRateUnit.toString();
                }

                if (existingMat) {
                    // Update existing material fields directly
                    existingMat.manualUnitRate = mongoose.Types.Decimal128.fromString(rateToStore);
                    existingMat.manualRateUnit = manualRateUnitToStore;
                    
                    // Update other fields if they are part of the updateData and meant to be editable here
                    // For now, focusing on manualUnitRate and manualRateUnit persistence
                    if (updatedMat.autoUnitRate !== undefined) existingMat.autoUnitRate = toDecimal128(updatedMat.autoUnitRate);
                    if (updatedMat.autoRateUnit !== undefined) existingMat.autoRateUnit = updatedMat.autoRateUnit;
                    if (updatedMat.calculatedCost !== undefined) existingMat.calculatedCost = toDecimal128(updatedMat.calculatedCost);
                    // Be cautious about overwriting fields that should only be backend-calculated

                } else {
                    // If the material is new in the update (shouldn't happen if only rates are changed)
                    // This part might need more robust handling if new materials can be added this way
                    console.warn(`[UpdateEstimation] New material ${updatedMat.materialId} found in updateData.calculatedMaterials. Adding it. Ensure this is intended.`);
                    materialsToUpdate.push({
                        ...updatedMat, // spread all fields from updatedMat
                        manualUnitRate: mongoose.Types.Decimal128.fromString(rateToStore),
                        manualRateUnit: manualRateUnitToStore,
                        // ensure other Decimal128 fields are converted if they are part of updatedMat
                        totalQuantity: toDecimal128(updatedMat.totalQuantity, '0'),
                        totalWeight: toDecimal128(updatedMat.totalWeight, '0.000'),
                        autoUnitRate: toDecimal128(updatedMat.autoUnitRate),
                        calculatedCost: toDecimal128(updatedMat.calculatedCost)
                        // pipeBreakdown needs careful handling if present
                    });
                }
            });
            // If new materials were added, push them. Otherwise, existing ones were modified in place.
            if (materialsToUpdate.length > 0 && !estimation.calculatedMaterials.some(em => materialsToUpdate.find(um => um.materialId.toString() === em.materialId.toString()))) {
                 estimation.calculatedMaterials.push(...materialsToUpdate);
            }
        }
        
        // Similarly handle manualCharges if they can be updated
        if (updatedManualCharges && Array.isArray(updatedManualCharges)) {
            estimation.manualCharges = updatedManualCharges.map(charge => ({
                ...charge,
                amount: toDecimal128(charge.amount)
            }));
        }

        // And items (less likely to change in this flow, but for completeness)
        if (updatedItems && Array.isArray(updatedItems)) {
            estimation.items = updatedItems.map(item => ({
                ...item,
                width: toDecimal128(item.width, '0'),
                height: toDecimal128(item.height, '0')
            }));
        }

        await estimation.save();
        return estimation;
    }

    /**
     * Delete an estimation
     * @param {string} estimationId - ID of the estimation to delete
     * @param {string} companyId - Company ID for multi-tenancy
     */
    async deleteEstimation(estimationId, companyId) {
        const result = await Estimation.deleteOne({ 
            _id: estimationId, 
            companyId: companyId 
        });

        if (result.deletedCount === 0) {
            throw new Error('Estimation not found');
        }
    }

    /**
     * Convert an estimation to a quotation
     * @param {string} estimationId - The ID of the estimation to convert
     * @param {string} companyId - Company ID for multi-tenancy
     * @param {string} userId - User performing the conversion
     * @returns {Object} The created quotation document
     * @throws {Error} If estimation not found, or other processing errors
     */
    async convertEstimationToQuotation(estimationId, companyId, userId) {
        // Removed transaction logic for compatibility with standalone MongoDB
        // const session = await mongoose.startSession();
        // session.startTransaction();
        try {
            const estimation = await Estimation.findOne({ _id: estimationId, companyId }); // Removed .session(session)
            if (!estimation) {
                throw new Error('Estimation not found.');
            }

            if (estimation.status !== 'Calculated') {
                throw new Error('Only calculated estimations can be converted to quotations.');
            }

            const client = await Client.findOne({ _id: estimation.clientId, companyId }); // Removed .session(session)
            if (!client) {
                // This case should ideally not happen if clientId is enforced on estimation
                throw new Error('Client associated with the estimation not found.');
            }
            
            const settings = await Setting.findOne({ companyId }); // Removed .session(session)
            // Fallback to company defaults if settings document is not found or some unit settings are missing
            const companyDefaults = await mongoose.model('Company').findById(companyId).select('defaultDimensionUnit defaultAreaUnit'); // Removed .session(session)

            const dimensionUnit = settings?.units?.dimension || companyDefaults?.defaultDimensionUnit || 'inches';
            const areaUnit = settings?.units?.area || companyDefaults?.defaultAreaUnit || 'sqft';
            const priceUnit = areaUnit; // Quotation price is per area unit
            const termsAndConditions = settings?.termsAndConditions?.quotation || '';
            const areaRoundingRule = settings?.areaRoundingRule || 'nearest_0.25'; // Default or from settings
            const minimumChargeableArea = settings?.minimumChargeableArea ? settings.minimumChargeableArea.toString() : '0'; // Default or from settings


            // generateQuotationId needs to handle not being in a session
            const quotationIdDisplay = await QuotationService.generateQuotationId(companyId /*, session*/); 

            const quotationItems = estimation.items.map(estItem => {
                // For converting estimation to quotation, we need a strategy for pricePerAreaUnit.
                // Option 1: Fetch from ProductType's default pricing (if it exists - not in current PRD)
                // Option 2: Use a placeholder/default value (e.g., 0 or a configurable default)
                // Option 3: Leave it to be manually filled in the Quotation module
                // For now, let's use a placeholder. The Quotation's pre-save hook will calculate item subtotals.
                const placeholderPricePerAreaUnit = '0.00'; // This will need to be updated by the user in the quotation

                return {
                    productTypeId: estItem.productTypeId,
                    productTypeNameSnapshot: estItem.productTypeNameSnapshot, // Already a snapshot
                    width: estItem.width, // Already Decimal128
                    height: estItem.height, // Already Decimal128
                    quantity: estItem.quantity,
                    itemLabel: estItem.itemLabel,
                    
                    // NEW: Preserve glass type and frame information from estimation
                    selectedGlassTypeId: estItem.selectedGlassTypeId,
                    selectedGlassTypeNameSnapshot: estItem.selectedGlassTypeNameSnapshot,
                    frameColour: "", // Default empty, to be filled in quotation
                    
                    pricePerAreaUnit: mongoose.Types.Decimal128.fromString(placeholderPricePerAreaUnit),
                    // rawAreaPerItem, convertedAreaPerItem, roundedAreaPerItem, chargeableAreaPerItem, totalChargeableArea, itemSubtotal
                    // will be calculated by Quotation model's pre-save hook.
                    materialsSnapshot: [] // Optionally, can map estimation.calculatedMaterials relevant to this item here.
                                          // For simplicity, leaving it empty now, could be an enhancement.
                };
            });

            const quotationCharges = estimation.manualCharges
                .filter(charge => !charge.autoGenerated) // Filter out auto-generated (labour) charges
                .map(charge => ({
                    description: charge.description,
                    amount: charge.amount, // Already Decimal128
                    isTax: false, 
                    isPredefined: false 
                }));
            
            // Discount from estimation could be an overall markup, not directly a discount line item.
            // The PRD uses markupPercentage in Estimation, and discount (type/value) in Quotation.
            // For now, we won't directly map estimation.markupPercentage to quotation.discount.
            // This can be a manual step in the quotation or a future enhancement.
            const quotationDiscount = {
                type: 'fixed',
                value: mongoose.Types.Decimal128.fromString('0.00')
            };


            const newQuotation = new Quotation({
                companyId,
                quotationIdDisplay,
                clientId: estimation.clientId,
                clientSnapshot: QuotationService.createClientSnapshot(client), // Use existing helper
                status: 'Draft', // Initial status
                dimensionUnit,
                areaUnit,
                priceUnit,
                areaRoundingRule, // from settings
                minimumChargeableArea: mongoose.Types.Decimal128.fromString(minimumChargeableArea), // from settings
                items: quotationItems,
                charges: quotationCharges,
                discount: quotationDiscount,
                termsAndConditions, // from settings
                notes: estimation.notes, // Carry over notes
                createdBy: userId,
                // validUntil: calculate from settings or default
            });

            await newQuotation.save(); // Removed { session }

            estimation.status = 'Converted';
            await estimation.save(); // Removed { session }

            // await session.commitTransaction(); // Removed transaction commit
            return newQuotation;

        } catch (error) {
            // await session.abortTransaction(); // Removed transaction abort
            console.error(`Error converting estimation ${estimationId} to quotation:`, error);
            throw error; // Re-throw to be caught by controller
        } finally {
            // session.endSession(); // Removed session end
        }
    }
}

module.exports = new EstimationService(); 