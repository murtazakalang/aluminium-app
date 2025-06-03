const WireMeshOptimizationService = require('../services/wireMeshOptimizationService');
const MaterialV2 = require('../models/MaterialV2');
const { protect } = require('./authController');

/**
 * Test Wire Mesh width optimization for a material
 */
const testWireMeshOptimization = async (req, res) => {
    try {
        const { materialId, requiredWidth, requiredLength, dimensionUnit = 'ft' } = req.body;
        const companyId = req.user.companyId;

        // Validate inputs
        if (!materialId || !requiredWidth || !requiredLength) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: materialId, requiredWidth, requiredLength'
            });
        }

        // Get material
        const material = await MaterialV2.findOne({ _id: materialId, companyId });
        if (!material) {
            return res.status(404).json({
                success: false,
                error: 'Wire Mesh material not found'
            });
        }

        if (material.category !== 'Wire Mesh') {
            return res.status(400).json({
                success: false,
                error: 'Material is not Wire Mesh category'
            });
        }

        // Run optimization
        const optimizationResult = await WireMeshOptimizationService.calculateWireMeshConsumption(
            material,
            parseFloat(requiredWidth),
            parseFloat(requiredLength),
            dimensionUnit
        );

        res.json({
            success: true,
            data: {
                material: {
                    id: material._id,
                    name: material.name,
                    category: material.category,
                    standardWidths: material.standardLengths?.map(sl => ({
                        width: sl.length.toString(),
                        unit: sl.unit
                    })) || []
                },
                optimization: optimizationResult,
                input: {
                    requiredWidth: parseFloat(requiredWidth),
                    requiredLength: parseFloat(requiredLength),
                    dimensionUnit
                }
            }
        });

    } catch (error) {
        console.error('Wire Mesh optimization test error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get Wire Mesh efficiency analysis
 */
const getWireMeshEfficiencyAnalysis = async (req, res) => {
    try {
        const { materialId } = req.params;
        const companyId = req.user.companyId;

        // Get material
        const material = await MaterialV2.findOne({ _id: materialId, companyId });
        if (!material) {
            return res.status(404).json({
                success: false,
                error: 'Wire Mesh material not found'
            });
        }

        if (material.category !== 'Wire Mesh') {
            return res.status(400).json({
                success: false,
                error: 'Material is not Wire Mesh category'
            });
        }

        // For demo purposes, generate sample usage history
        // In production, this would come from actual usage records
        const sampleUsageHistory = [
            { efficiency: 85, wastagePercentage: 15 },
            { efficiency: 92, wastagePercentage: 8 },
            { efficiency: 78, wastagePercentage: 22 },
            { efficiency: 95, wastagePercentage: 5 },
            { efficiency: 88, wastagePercentage: 12 }
        ];

        const analysisResult = WireMeshOptimizationService.analyzeWireMeshEfficiency(
            materialId,
            sampleUsageHistory
        );

        res.json({
            success: true,
            data: {
                material: {
                    id: material._id,
                    name: material.name,
                    category: material.category,
                    standardWidths: material.standardLengths?.map(sl => ({
                        width: sl.length.toString(),
                        unit: sl.unit
                    })) || []
                },
                analysis: analysisResult
            }
        });

    } catch (error) {
        console.error('Wire Mesh efficiency analysis error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Calculate Wire Mesh requirements for a window size
 */
const calculateWireMeshForWindow = async (req, res) => {
    try {
        const { materialId, windowWidth, windowHeight, margin = 0.1, quantity = 1 } = req.body;
        const companyId = req.user.companyId;

        // Get material
        const material = await MaterialV2.findOne({ _id: materialId, companyId });
        if (!material) {
            return res.status(404).json({
                success: false,
                error: 'Wire Mesh material not found'
            });
        }

        // Calculate required dimensions with margin
        const requiredWidth = parseFloat(windowWidth) + parseFloat(margin);
        const requiredLength = parseFloat(windowHeight) + parseFloat(margin);

        // Run optimization for single window
        const singleWindowResult = await WireMeshOptimizationService.calculateWireMeshConsumption(
            material,
            requiredWidth,
            requiredLength,
            'ft'
        );

        // Calculate for total quantity
        const totalOptimizedArea = singleWindowResult.actualArea * quantity;
        const totalWastage = singleWindowResult.wastageArea * quantity;
        const totalRequiredArea = singleWindowResult.requiredArea * quantity;

        res.json({
            success: true,
            data: {
                material: {
                    id: material._id,
                    name: material.name
                },
                window: {
                    width: parseFloat(windowWidth),
                    height: parseFloat(windowHeight),
                    margin: parseFloat(margin),
                    quantity: parseInt(quantity)
                },
                perWindow: singleWindowResult,
                totals: {
                    totalRequiredArea,
                    totalOptimizedArea,
                    totalWastage,
                    totalWastagePercentage: (totalWastage / totalOptimizedArea * 100).toFixed(2),
                    areaUnit: singleWindowResult.areaUnit
                }
            }
        });

    } catch (error) {
        console.error('Wire Mesh window calculation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * POST /api/v2/inventory/wire-mesh/test-consumption
 * Test Wire Mesh consumption for manufacturing
 */
const testWireMeshConsumption = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const userId = req.user._id;
        const { 
            materialId, 
            requiredWidth, 
            requiredLength, 
            quantity = 1,
            consumptionType = 'Production'
        } = req.body;

        if (!materialId || !requiredWidth || !requiredLength) {
            return res.status(400).json({
                success: false,
                message: 'materialId, requiredWidth, and requiredLength are required'
            });
        }

        // Import the service here to avoid circular dependencies
        const BatchInventoryService = require('../services/batchInventoryService');
        
        const result = await BatchInventoryService.consumeWireMeshStock(materialId, {
            companyId,
            requiredWidth: parseFloat(requiredWidth),
            requiredLength: parseFloat(requiredLength),
            quantity: parseInt(quantity),
            consumptionType,
            sortOrder: 'FIFO',
            notes: `Test consumption for ${requiredWidth}ft × ${requiredLength}ft window`,
            userId
        });

        res.status(200).json({
            success: true,
            message: `Wire Mesh consumed successfully! Total area: ${result.totalAreaConsumed} sqft, Wastage: ${result.totalWastage.toFixed(2)} sqft (${result.wastePercentage.toFixed(1)}%)`,
            data: {
                ...result,
                consumedBatches: result.consumedBatches.map(batch => ({
                    ...batch,
                    selectedWidth: batch.selectedWidth.toString(),
                    rollsConsumed: batch.rollsConsumed.toFixed(3),
                    areaConsumed: batch.areaConsumed.toFixed(2),
                    cost: batch.cost.toFixed(2)
                }))
            }
        });

    } catch (error) {
        console.error('Wire Mesh consumption test error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    testWireMeshOptimization,
    getWireMeshEfficiencyAnalysis,
    calculateWireMeshForWindow,
    testWireMeshConsumption
}; 