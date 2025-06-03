const BatchInventoryService = require('../services/batchInventoryService');
const { protect } = require('./authController');
const rbac = require('../middleware/rbac');

/**
 * POST /api/v2/inventory/stock-inward
 * Record new stock inward as a batch
 */
const recordStockInward = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const userId = req.user._id;

        const {
            materialId,
            length, lengthUnit, gauge,
            quantity, actualWeight, actualWeightUnit,
            totalCost, supplier, invoiceNumber, lotNumber, notes,
            // For new material creation
            name, category, stockUnit, usageUnit, brand, hsnCode, description
        } = req.body;

        // Validate required fields
        if (!quantity || !totalCost) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: quantity, totalCost'
            });
        }

        const result = await BatchInventoryService.recordStockInward(companyId, userId, {
            materialId,
            length, lengthUnit, gauge,
            quantity, actualWeight, actualWeightUnit,
            totalCost, supplier, invoiceNumber, lotNumber, notes,
            name, category, stockUnit, usageUnit, brand, hsnCode, description
        });

        // Convert Decimal128 values to strings for frontend
        const responseData = {
            ...result,
            material: {
                id: result.material._id,
                name: result.material.name,
                category: result.material.category,
                stockUnit: result.material.stockUnit,
                usageUnit: result.material.usageUnit,
                supplier: result.material.supplier,
                brand: result.material.brand,
                aggregatedTotals: {
                    totalCurrentStock: result.material.aggregatedTotals?.totalCurrentStock?.toString() || '0',
                    totalCurrentWeight: result.material.aggregatedTotals?.totalCurrentWeight?.toString() || '0',
                    totalCurrentValue: result.material.aggregatedTotals?.totalCurrentValue?.toString() || '0',
                    averageRatePerPiece: result.material.aggregatedTotals?.averageRatePerPiece?.toString() || '0',
                    averageRatePerKg: result.material.aggregatedTotals?.averageRatePerKg?.toString() || '0',
                    lastUpdated: result.material.aggregatedTotals?.lastUpdated || new Date()
                }
            },
            batch: (() => {
                const baseBatchData = {
                    batchId: result.batch.batchId,
                    originalQuantity: result.batch.originalQuantity.toString(),
                    currentQuantity: result.batch.currentQuantity.toString(),
                    totalCostPaid: result.batch.totalCostPaid.toString(),
                    supplier: result.batch.supplier,
                    purchaseDate: result.batch.purchaseDate,
                    invoiceNumber: result.batch.invoiceNumber,
                    lotNumber: result.batch.lotNumber,
                    isActive: result.batch.isActive,
                    isCompleted: result.batch.isCompleted
                };

                // Handle different batch structures based on material category
                if (result.material.category === 'Profile') {
                    return {
                        ...baseBatchData,
                        length: result.batch.length ? result.batch.length.toString() : null,
                        lengthUnit: result.batch.lengthUnit || null,
                        gauge: result.batch.gauge,
                        actualTotalWeight: result.batch.actualTotalWeight?.toString(),
                        actualWeightUnit: result.batch.actualWeightUnit,
                        ratePerPiece: result.batch.ratePerPiece.toString(),
                        ratePerKg: result.batch.ratePerKg?.toString()
                    };
                } else {
                    // Non-Profile materials (Wire Mesh, Glass, Hardware, etc.)
                    if (result.material.category === 'Wire Mesh') {
                        return {
                            ...baseBatchData,
                            selectedWidth: result.batch.selectedWidth?.toString(),
                            widthUnit: result.batch.widthUnit,
                            rollLength: result.batch.rollLength?.toString(),
                            rollLengthUnit: result.batch.rollLengthUnit,
                            areaPerRoll: result.batch.areaPerRoll?.toString(),
                            totalArea: result.batch.totalArea?.toString(),
                            areaUnit: result.batch.areaUnit,
                            ratePerUnit: result.batch.ratePerUnit.toString(), // Rate per roll
                            ratePerArea: result.batch.ratePerArea?.toString() // Rate per sqft
                        };
                    } else {
                        return {
                            ...baseBatchData,
                            ratePerUnit: result.batch.ratePerUnit.toString()
                        };
                    }
                }
            })()
        };

        res.status(201).json({
            success: true,
            message: `Stock inward recorded successfully! Batch ID: ${result.batchId}`,
            data: responseData
        });

    } catch (error) {
        console.error('Stock inward error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to record stock inward',
            error: error.message
        });
    }
};

/**
 * POST /api/v2/inventory/consume-stock
 * Consume stock from batches (FIFO/LIFO)
 */
const consumeStock = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const userId = req.user._id;

        const {
            materialId,
            length, lengthUnit, gauge,
            quantityNeeded,
            consumptionType = 'Production',
            sortOrder = 'FIFO',
            notes
        } = req.body;

        // Validate required fields
        if (!materialId || !quantityNeeded) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: materialId, quantityNeeded'
            });
        }

        const result = await BatchInventoryService.consumeStock(materialId, {
            companyId,
            length, lengthUnit, gauge,
            quantityNeeded,
            consumptionType,
            sortOrder,
            notes,
            userId
        });

        res.status(200).json({
            success: true,
            message: `Stock consumed successfully. Total consumed: ${result.totalConsumed} pieces`,
            data: result
        });

    } catch (error) {
        console.error('[BatchInventoryController] Stock consumption error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * GET /api/v2/inventory/stock-report/:materialId
 * Get detailed stock report for a material
 */
const getStockReport = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const { materialId } = req.params;

        if (!materialId) {
            return res.status(400).json({
                success: false,
                message: 'Material ID is required'
            });
        }

        const report = await BatchInventoryService.getStockReport(materialId, companyId);

        res.status(200).json({
            success: true,
            data: report
        });

    } catch (error) {
        console.error('[BatchInventoryController] Stock report error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * GET /api/v2/inventory/batch-history/:materialId
 * Get batch history for a material
 */
const getBatchHistory = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const { materialId } = req.params;
        const {
            startDate, endDate, supplier, gauge,
            includeCompleted = 'true'
        } = req.query;

        if (!materialId) {
            return res.status(400).json({
                success: false,
                message: 'Material ID is required'
            });
        }

        const filters = {
            startDate,
            endDate,
            supplier,
            gauge,
            includeCompleted: includeCompleted === 'true'
        };

        const batches = await BatchInventoryService.getBatchHistory(materialId, companyId, filters);

        res.status(200).json({
            success: true,
            data: batches,
            count: batches.length
        });

    } catch (error) {
        console.error('[BatchInventoryController] Batch history error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * GET /api/v2/inventory/available-batches/:materialId
 * Get available batches for consumption
 */
const getAvailableBatches = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const { materialId } = req.params;
        const {
            length, lengthUnit, gauge,
            sortOrder = 'FIFO',
            minQuantity = '0'
        } = req.query;

        const MaterialV2 = require('../models/MaterialV2');
        const material = await MaterialV2.findOne({ _id: materialId, companyId });
        
        if (!material) {
            return res.status(404).json({
                success: false,
                message: 'Material not found or access denied'
            });
        }

        const filters = {
            length: length ? parseFloat(length) : undefined,
            lengthUnit,
            gauge,
            minQuantity: parseFloat(minQuantity)
        };

        const availableBatches = material.getAvailableBatches(filters, sortOrder);

        const formattedBatches = availableBatches.map(batch => {
            const baseBatchData = {
                batchId: batch.batchId,
                currentQuantity: batch.currentQuantity.toString(),
                supplier: batch.supplier,
                purchaseDate: batch.purchaseDate,
                invoiceNumber: batch.invoiceNumber
            };

            if (material.category === 'Profile') {
                return {
                    ...baseBatchData,
                    length: batch.length.toString(),
                    lengthUnit: batch.lengthUnit,
                    gauge: batch.gauge,
                    actualTotalWeight: batch.actualTotalWeight?.toString(),
                    ratePerPiece: batch.ratePerPiece.toString()
                };
            } else {
                return {
                    ...baseBatchData,
                    ratePerUnit: batch.ratePerUnit.toString()
                };
            }
        });

        res.status(200).json({
            success: true,
            data: formattedBatches,
            count: formattedBatches.length,
            totalAvailable: formattedBatches.reduce((sum, batch) => 
                sum + parseFloat(batch.currentQuantity), 0
            )
        });

    } catch (error) {
        console.error('[BatchInventoryController] Available batches error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * GET /api/v2/inventory/materials
 * List all materials with batch summary (includes both old and new system materials)
 */
const getMaterialsList = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const { category, search, page = 1, limit = 50 } = req.query;

        const MaterialV2 = require('../models/MaterialV2');
        
        // Build queries
        const queryV2 = { companyId, isActive: true };
        
        if (category) {
            queryV2.category = category;
        }
        
        if (search) {
            const searchRegex = { $regex: search, $options: 'i' };
            queryV2.$or = [
                { name: searchRegex },
                { supplier: searchRegex },
                { brand: searchRegex }
            ];
        }

        // Get materials from V2 system only
        const materialsV2 = await MaterialV2.find(queryV2)
                .select('name category stockUnit usageUnit supplier brand aggregatedTotals profileBatches simpleBatches standardLengths referenceGaugeWeights')
            .sort({ name: 1 });

        // Format V2 materials
        const formattedMaterialsV2 = materialsV2.map(material => {
            // Get active batches based on material category
            let activeBatches;
            if (material.category === 'Profile') {
                activeBatches = material.profileBatches.filter(b => b.isActive && !b.isCompleted);
            } else {
                activeBatches = material.simpleBatches.filter(b => b.isActive && !b.isCompleted);
            }
            
            // Convert Decimal128 values to strings
            const aggregatedTotals = {
                totalCurrentStock: material.aggregatedTotals?.totalCurrentStock?.toString() || '0',
                totalCurrentWeight: material.aggregatedTotals?.totalCurrentWeight?.toString() || '0',
                totalCurrentValue: material.aggregatedTotals?.totalCurrentValue?.toString() || '0',
                averageRatePerPiece: material.aggregatedTotals?.averageRatePerPiece?.toString() || '0',
                averageRatePerKg: material.aggregatedTotals?.averageRatePerKg?.toString() || '0',
                lastUpdated: material.aggregatedTotals?.lastUpdated || new Date()
            };
            
            return {
                id: material._id,
                name: material.name,
                category: material.category,
                stockUnit: material.stockUnit,
                usageUnit: material.usageUnit,
                supplier: material.supplier,
                brand: material.brand,
                aggregatedTotals,
                activeBatchCount: activeBatches.length,
                hasLowStock: activeBatches.some(batch => 
                    parseFloat(batch.currentQuantity.toString()) <= parseFloat(batch.lowStockThreshold.toString())
                ),
                systemType: 'v2',
                // Include configuration data for simplified forms
                standardLengths: material.standardLengths ? material.standardLengths.map(sl => ({
                    length: sl.length.toString(),
                    unit: sl.unit
                })) : undefined,
                referenceGaugeWeights: material.referenceGaugeWeights ? material.referenceGaugeWeights.map(g => ({
                    gauge: g.gauge,
                    referenceWeight: g.referenceWeight.toString(),
                    unitLength: g.unitLength
                })) : undefined
            };
        });

        // Apply pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const paginatedMaterials = formattedMaterialsV2.slice(skip, skip + parseInt(limit));

        res.status(200).json({
            success: true,
            data: paginatedMaterials,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(formattedMaterialsV2.length / parseInt(limit)),
                count: paginatedMaterials.length,
                totalRecords: formattedMaterialsV2.length
            }
        });

    } catch (error) {
        console.error('[BatchInventoryController] Materials list error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * POST /api/v2/inventory/create-simplified-material
 * Create a new material with predefined lengths and gauges
 */
const createSimplifiedMaterial = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const userId = req.user._id;

        const {
            name, category, stockUnit, usageUnit,
            standardLengths, gauges, standardWidths,
            supplier, brand, hsnCode, description
        } = req.body;

        // Validate required fields
        if (!name || !category || !stockUnit || !usageUnit) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: name, category, stockUnit, usageUnit'
            });
        }

        // Only require standard lengths for Profile materials
        if (category === 'Profile') {
            if (!standardLengths || !Array.isArray(standardLengths) || standardLengths.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'At least one standard length is required for Profile materials'
                });
            }
        }

        if (category === 'Profile' && (!gauges || !Array.isArray(gauges) || gauges.length === 0)) {
            return res.status(400).json({
                success: false,
                message: 'At least one gauge is required for Profile materials'
            });
        }

        const result = await BatchInventoryService.createSimplifiedMaterial(companyId, userId, {
            name, category, stockUnit, usageUnit,
            standardLengths, gauges, standardWidths,
            supplier, brand, hsnCode, description
        });

        res.status(201).json({
            success: true,
            message: `Material "${name}" created successfully!`,
            data: result
        });

    } catch (error) {
        console.error('[BatchInventoryController] Material creation error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * GET /api/v2/inventory/consumption-history/:materialId
 * Get consumption history with order details for a material
 */
const getConsumptionHistory = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const { materialId } = req.params;
        const {
            startDate, endDate, orderId, 
            page = 1, limit = 50
        } = req.query;

        if (!materialId) {
            return res.status(400).json({
                success: false,
                message: 'Material ID is required'
            });
        }

        const StockTransaction = require('../models/StockTransaction');
        const CuttingPlan = require('../models/CuttingPlan');
        const Order = require('../models/Order');

        // Build query for stock transactions
        const query = {
            companyId,
            materialId,
            type: { $in: ['Outward-OrderCut', 'Outward-Manual'] }
        };

        if (startDate || endDate) {
            query.transactionDate = {};
            if (startDate) query.transactionDate.$gte = new Date(startDate);
            if (endDate) query.transactionDate.$lte = new Date(endDate);
        }

        if (orderId) {
            // If specific order ID is requested, we need to find cutting plans for that order
            const cuttingPlans = await CuttingPlan.find({ orderId }).select('_id');
            const cuttingPlanIds = cuttingPlans.map(cp => cp._id);
            query.relatedDocumentId = { $in: cuttingPlanIds };
        }

        // Get transactions with pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const transactions = await StockTransaction.find(query)
            .sort({ transactionDate: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('createdBy', 'firstName lastName email');

        // Get total count for pagination
        const totalCount = await StockTransaction.countDocuments(query);

        // Enrich transactions with order details
        const enrichedTransactions = [];
        
        for (const transaction of transactions) {
            let orderDetails = null;
            let cuttingPlanDetails = null;

            // Extract order info from transaction
            if (transaction.relatedDocumentType === 'CuttingPlan' && transaction.relatedDocumentId) {
                try {
                    const cuttingPlan = await CuttingPlan.findById(transaction.relatedDocumentId)
                        .select('orderId status');
                    
                    if (cuttingPlan) {
                        cuttingPlanDetails = {
                            cuttingPlanId: cuttingPlan._id,
                            status: cuttingPlan.status
                        };

                        const order = await Order.findById(cuttingPlan.orderId)
                            .select('orderIdDisplay clientSnapshot status');
                        
                        if (order) {
                            orderDetails = {
                                orderId: order._id,
                                orderIdDisplay: order.orderIdDisplay,
                                clientName: order.clientSnapshot?.clientName || 'Unknown Client',
                                orderStatus: order.status
                            };
                        }
                    }
                } catch (error) {
                    console.warn(`Could not fetch order details for transaction ${transaction._id}:`, error.message);
                }
            }

            enrichedTransactions.push({
                transactionId: transaction._id,
                transactionDate: transaction.transactionDate,
                type: transaction.type,
                quantityConsumed: Math.abs(parseFloat(transaction.quantityChange.toString())), // Convert to positive for display
                quantityUnit: transaction.quantityUnit,
                length: transaction.length ? transaction.length.toString() : null,
                lengthUnit: transaction.lengthUnit,
                unitRate: transaction.unitRateAtTransaction ? transaction.unitRateAtTransaction.toString() : '0',
                totalValue: transaction.totalValueChange ? Math.abs(parseFloat(transaction.totalValueChange.toString())) : 0,
                notes: transaction.notes,
                consumedBy: transaction.createdBy ? {
                    name: `${transaction.createdBy.firstName} ${transaction.createdBy.lastName}`,
                    email: transaction.createdBy.email
                } : null,
                orderDetails,
                cuttingPlanDetails
            });
        }

        res.status(200).json({
            success: true,
            data: enrichedTransactions,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(totalCount / parseInt(limit)),
                count: enrichedTransactions.length,
                totalRecords: totalCount
            }
        });

    } catch (error) {
        console.error('[BatchInventoryController] Consumption history error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * DELETE /api/v2/inventory/materials/:materialId
 * Delete a material (only if no active batches exist)
 */
const deleteMaterial = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const { materialId } = req.params;

        if (!materialId) {
            return res.status(400).json({
                success: false,
                message: 'Material ID is required'
            });
        }

        const result = await BatchInventoryService.deleteMaterial(materialId, companyId);

        res.status(200).json({
            success: true,
            message: result.message,
            deletedMaterialId: materialId
        });

    } catch (error) {
        console.error('[BatchInventoryController] Material deletion error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    recordStockInward,
    consumeStock,
    getStockReport,
    getBatchHistory,
    getAvailableBatches,
    getMaterialsList,
    createSimplifiedMaterial,
    getConsumptionHistory,
    deleteMaterial
}; 