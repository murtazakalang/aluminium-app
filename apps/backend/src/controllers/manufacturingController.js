const mongoose = require('mongoose');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/appError');
const CuttingOptimizationService = require('../services/cuttingOptimizationService');
const Order = require('../models/Order');
const CuttingPlan = require('../models/CuttingPlan');
const MaterialV2 = require('../models/MaterialV2');
const StockTransaction = require('../models/StockTransaction');
const Company = require('../models/Company');
const svgGenerator = require('../utils/cuttingPlanSvgGenerator');
const { generateCuttingPlanPDF } = require('../utils/cuttingPlanPdfGenerator');
const fs = require('fs');
const path = require('path');
const OrderService = require('../services/orderService');

/**
 * @controller ManufacturingController
 * @description Handles all manufacturing related operations.
 */

// Simple in-memory set to track orders currently being optimized (prevents race conditions)
const optimizationInProgress = new Set();

/**
 * @function optimizeCutsForOrder
 * @description Controller to trigger the cutting optimization process for a given order.
 * Delegates to cuttingOptimizationService.optimizeCuts.
 * Updates Order status and cuttingPlanId upon successful plan generation.
 */
exports.optimizeCutsForOrder = catchAsync(async (req, res, next) => {
    const { orderId } = req.body;
    const { companyId, _id: userId } = req.user;

    if (!orderId) {
        return next(new AppError('Order ID is required to optimize cuts.', 400));
    }

    // Check if optimization is already in progress for this order
    if (optimizationInProgress.has(orderId)) {
        return next(new AppError('Optimization is already in progress for this order. Please wait for it to complete.', 409)); // 409 Conflict
    }

    // Mark this order as being optimized
    optimizationInProgress.add(orderId);

    try {
        // It's good practice to fetch the order within the same session if a transaction is active
        const order = await Order.findOne({ _id: orderId, companyId }).session(req.mongoSession || null);
        if (!order) {
            return next(new AppError('Order not found.', 404));
        }

        // Check current order status and if a plan already exists and is committed.
        // If a plan is generated but not committed, re-optimizing might be allowed (overwrites previous uncommitted plan)
        if (order.cuttingPlanStatus === 'Committed') {
            return next(new AppError('A cutting plan has already been committed for this order. No further optimizations allowed unless reverted.', 400));
        }

        if (order.status !== 'Ready for Optimization' && order.status !== 'Optimization Failed' && order.status !== 'Optimization Complete') {
            // Allow re-optimization if complete or failed, or if ready.
            return next(new AppError(`Order status is '${order.status}'. Must be 'Ready for Optimization', 'Optimization Complete', or 'Optimization Failed' to re-run optimization.`, 400));
        }

        let cuttingPlan; // Declare here to be accessible in the scope
        try {
            const optimizer = new CuttingOptimizationService();
            cuttingPlan = await optimizer.optimizeCuts(orderId, companyId.toString(), userId.toString());
            
            // The optimizeCuts method now handles updating the order, so we don't need to do it here
            // order.cuttingPlanId = cuttingPlan._id;
            // order.cuttingPlanStatus = 'Generated'; 
            // order.status = 'Optimization Complete'; 
            // await order.save({ session: req.mongoSession || null });

            res.status(200).json({
                status: 'success',
                message: 'Cutting optimization performed and plan generated successfully.',
                data: {
                    cuttingPlanId: cuttingPlan._id,
                    orderStatus: cuttingPlan.status || 'Generated'
                },
            });

        } catch (error) {
            console.error('[ManufacturingController] Error during optimizeCutsForOrder:', error);
            // Update order status to indicate failure if specific error types
            if (order && (order.status === 'Ready for Optimization' || order.status === 'Optimization Complete')) {
                try {
                    order.status = 'Optimization Failed';
                    order.cuttingPlanStatus = 'Failed';
                    order.notes = (order.notes ? order.notes + '\n' : '') + `Optimization failed: ${error.message}`;
                    await order.save({ session: req.mongoSession || null });
                } catch (saveError) {
                    console.error('[ManufacturingController] Critical: Failed to update order status after optimization error:', saveError);
                    // If saving order status fails, the original error is more important to report
                }
            }
            // Forward the original error to the global error handler
            return next(error); 
        }
    } finally {
        // Always remove the order from the optimization in progress set
        optimizationInProgress.delete(orderId);
    }
});

/**
 * @function getCuttingPlanByOrderId
 * @description Controller to retrieve the cutting plan for a specific order.
 */
exports.getCuttingPlanByOrderId = catchAsync(async (req, res, next) => {
    const { orderId } = req.params;
    const { companyId } = req.user;

    console.log(`[getCuttingPlanByOrderId] Searching for cutting plan with orderId: ${orderId}, companyId: ${companyId}`);

    const cuttingPlan = await CuttingPlan.findOne({ orderId, companyId })
        .populate('materialPlans.materialId')
        .lean();

    console.log(`[getCuttingPlanByOrderId] Found cutting plan:`, cuttingPlan ? `ID: ${cuttingPlan._id}, Status: ${cuttingPlan.status}` : 'null');

    if (!cuttingPlan) {
        console.log(`[getCuttingPlanByOrderId] No cutting plan found. Checking if order exists...`);
        const order = await Order.findOne({ _id: orderId, companyId }).select('_id orderIdDisplay cuttingPlanId cuttingPlanStatus status notes');
        console.log(`[getCuttingPlanByOrderId] Order found:`, order ? `ID: ${order._id}, Display: ${order.orderIdDisplay}, CuttingPlanId: ${order.cuttingPlanId}, Status: ${order.status}` : 'null');
        if (order) {
            // If optimization failed, extract and return the detailed error message
            if (order.status === 'Optimization Failed') {
                let errorMessage = `Optimization failed for order ${order.orderIdDisplay}.`;
                
                // Try to extract the detailed error message from notes
                if (order.notes) {
                    console.log(`[getCuttingPlanByOrderId] Order notes:`, order.notes);
                    const lines = order.notes.split('\n');
                    const optimizationFailedLine = lines.find(line => 
                        line.startsWith('Optimization failed:') || 
                        line.startsWith('Automated optimization initiation failed:')
                    );
                    
                    if (optimizationFailedLine) {
                        // Extract the actual error message after the prefix
                        let detailedError = optimizationFailedLine;
                        if (optimizationFailedLine.startsWith('Optimization failed:')) {
                            detailedError = optimizationFailedLine.replace('Optimization failed: ', '').trim();
                        } else if (optimizationFailedLine.startsWith('Automated optimization initiation failed:')) {
                            detailedError = optimizationFailedLine.replace('Automated optimization initiation failed: ', '').trim();
                        }
                        errorMessage = detailedError;
                    }
                }
                
                console.log(`[getCuttingPlanByOrderId] Returning optimization failure details:`, errorMessage);
                return res.status(400).json({
                    status: 'fail',
                    message: errorMessage,
                    data: {
                        orderStatus: order.status,
                        orderIdDisplay: order.orderIdDisplay,
                        errorType: 'OptimizationFailed'
                    }
                });
            }
            
            // For other statuses, return the generic message
            return res.status(404).json({
                status: 'fail',
                message: `Cutting plan not yet generated for order ${order.orderIdDisplay}. Current order status: ${order.status}.`,
                data: {
                    orderStatus: order.status,
                    orderIdDisplay: order.orderIdDisplay
                }
            });
        }
        return next(new AppError('Cutting plan not found for the specified order, and the order itself was not found.', 404));
    }

    // Convert ObjectIds and Decimal128 to strings for frontend compatibility
    const serializedCuttingPlan = {
        ...cuttingPlan,
        _id: cuttingPlan._id.toString(),
        orderId: cuttingPlan.orderId.toString(),
        companyId: cuttingPlan.companyId.toString(),
        generatedBy: cuttingPlan.generatedBy ? cuttingPlan.generatedBy.toString() : null,
        materialPlans: cuttingPlan.materialPlans?.map(mp => ({
            ...mp,
            materialId: mp.materialId ? mp.materialId.toString() : mp.materialId,
            totalWeight: mp.totalWeight ? mp.totalWeight.toString() : '0',
            pipesUsed: mp.pipesUsed?.map(pipe => ({
                ...pipe,
                standardLength: pipe.standardLength ? pipe.standardLength.toString() : '0',
                totalCutLengthOnPipe: pipe.totalCutLengthOnPipe ? pipe.totalCutLengthOnPipe.toString() : '0',
                scrapLength: pipe.scrapLength ? pipe.scrapLength.toString() : '0',
                calculatedWeight: pipe.calculatedWeight ? pipe.calculatedWeight.toString() : '0',
                cutsMade: pipe.cutsMade?.map(cut => ({
                    ...cut,
                    requiredLength: cut.requiredLength ? cut.requiredLength.toString() : '0',
                    identifier: cut.identifier
                })) || []
            })) || [],
            totalPipesPerLength: mp.totalPipesPerLength?.map(tppl => ({
                ...tppl,
                totalScrap: tppl.totalScrap ? tppl.totalScrap.toString() : '0'
            })) || []
        })) || []
    };

    res.status(200).json({
        status: 'success',
        data: {
            cuttingPlan: serializedCuttingPlan,
        },
    });
    
    console.log(`[getCuttingPlanByOrderId] Successfully returned cutting plan with ${serializedCuttingPlan.materialPlans?.length || 0} material plans`);
    console.log(`[getCuttingPlanByOrderId] Response structure:`, {
        status: 'success',
        data: {
            cuttingPlan: {
                _id: serializedCuttingPlan._id,
                orderId: serializedCuttingPlan.orderId,
                status: serializedCuttingPlan.status,
                materialPlansCount: serializedCuttingPlan.materialPlans?.length || 0
            }
        }
    });
});

/**
 * @function getCuttingPlanSvgByOrderId
 * @description Controller to generate and return an SVG representation of the cutting plan.
 * Placeholder: Actual SVG generation logic will be in a utility/service.
 */
exports.getCuttingPlanSvgByOrderId = catchAsync(async (req, res, next) => {
    const { orderId } = req.params;
    const { companyId } = req.user;

    console.log(`[getCuttingPlanSvgByOrderId] Searching for cutting plan SVG with orderId: ${orderId}, companyId: ${companyId}`);

    const cuttingPlan = await CuttingPlan.findOne({ orderId, companyId })
        .populate('materialPlans.materialId')
        .lean();

    console.log(`[getCuttingPlanSvgByOrderId] Found cutting plan:`, cuttingPlan ? `ID: ${cuttingPlan._id}, Status: ${cuttingPlan.status}` : 'null');

    if (!cuttingPlan) {
        console.log(`[getCuttingPlanSvgByOrderId] No cutting plan found for SVG generation.`);
        return next(new AppError('Cutting plan not found, cannot generate SVG.', 404));
    }

    try {
        // Check if materialPlans exists and has at least one plan
        if (!cuttingPlan.materialPlans || cuttingPlan.materialPlans.length === 0) {
            console.error(`[ManufacturingController] No material plans found in cutting plan ${cuttingPlan._id} for SVG generation.`);
            return next(new AppError('No material plans available in the cutting plan to generate SVG.', 404));
        }

        // Generate SVG for all material plans
        console.log(`[ManufacturingController] Generating SVG for ${cuttingPlan.materialPlans.length} material plans`);
        cuttingPlan.materialPlans.forEach((mp, index) => {
            console.log(`[ManufacturingController] Material ${index + 1}: ${mp.materialNameSnapshot} (${mp.pipesUsed?.length || 0} pipes)`);
        });

        const svgOutput = svgGenerator.generateCuttingPlanSVG(cuttingPlan.materialPlans);
        res.header('Content-Type', 'image/svg+xml');
        res.send(svgOutput);
    } catch (error) {
        console.error(`[ManufacturingController] Error generating SVG for cutting plan ${cuttingPlan._id}:`, error);
        return next(new AppError('Failed to generate SVG for cutting plan.', 500));
    }
});

/**
 * @function getPipeOrderSummaryByOrderId
 * @description Controller to retrieve a summary of pipes needed for an order, based on its cutting plan.
 * This involves reading the CuttingPlan.materialPlans.totalPipesPerLength and totalWeight.
 */
exports.getPipeOrderSummaryByOrderId = catchAsync(async (req, res, next) => {
    const { orderId } = req.params;
    const { companyId } = req.user;

    console.log(`[getPipeOrderSummaryByOrderId] Searching for pipe order summary with orderId: ${orderId}, companyId: ${companyId}`);

    const cuttingPlan = await CuttingPlan.findOne({ orderId, companyId })
        .select('materialPlans.materialId materialPlans.materialNameSnapshot materialPlans.gaugeSnapshot materialPlans.totalPipesPerLength materialPlans.totalWeight materialPlans.usageUnit');

    if (!cuttingPlan || !cuttingPlan.materialPlans || cuttingPlan.materialPlans.length === 0) {
        console.log(`[getPipeOrderSummaryByOrderId] No cutting plan or material plans found for orderId: ${orderId}`);
        return next(new AppError('Cutting plan with material summary not found for this order.', 404));
    }

    const summary = cuttingPlan.materialPlans.map(mp => ({
        materialId: mp.materialId,
        materialNameSnapshot: mp.materialNameSnapshot,
        gaugeSnapshot: mp.gaugeSnapshot,
        usageUnit: mp.usageUnit,
        totalPipesPerLength: mp.totalPipesPerLength.map(p => ({ 
            length: p.length.toString(), 
            unit: p.unit, 
            quantity: p.quantity, 
            totalScrap: p.totalScrap.toString(),
            scrapUnit: p.scrapUnit || mp.usageUnit // Use scrapUnit if available, fallback to material's usageUnit
        })),
        totalWeight: mp.totalWeight ? mp.totalWeight.toString() : '0',
    }));

    console.log(`[getPipeOrderSummaryByOrderId] Successfully returning summary with ${summary.length} materials. First material total weight: ${summary[0]?.totalWeight || 'N/A'}`);

    res.status(200).json({
        status: 'success',
        data: {
            summary,
        },
    });
});

/**
 * @function updateOrderStage
 * @description Controller to update the manufacturing stage of an order.
 */
exports.updateOrderStage = catchAsync(async (req, res, next) => {
    const { orderId } = req.params;
    const { status: newStatus, notes } = req.body;
    const { companyId, _id: userId } = req.user;

    const validStatuses = ['Cutting', 'Assembly', 'QC', 'Packed', 'Ready for Dispatch', 'On Hold'];
    if (!validStatuses.includes(newStatus)) {
        return next(new AppError(`Invalid manufacturing stage: ${newStatus}.`, 400));
    }

    const order = await Order.findOne({ _id: orderId, companyId });

    if (!order) {
        return next(new AppError('Order not found.', 404));
    }

    // Add more sophisticated status transition logic if needed
    const previousStatus = order.status;
    order.status = newStatus;
    
    const historyEntry = {
        status: newStatus,
        notes: notes || `Stage changed from ${previousStatus} to ${newStatus}`,
        updatedBy: userId,
        timestamp: new Date(),
    };
    order.history.push(historyEntry);

    await order.save({ session: req.mongoSession });

    res.status(200).json({
        status: 'success',
        data: {
            order,
        },
    });
});

/**
 * @function commitCutsForOrder
 * @description Controller to commit the cutting plan. 
 * This involves updating inventory (Material.stockByLength or MaterialV2.profileBatches) by creating StockTransaction records
 * and updating CuttingPlan & Order statuses.
 * This operation MUST be atomic or have rollback capabilities.
 */
exports.commitCutsForOrder = catchAsync(async (req, res, next) => {
    const { orderId } = req.params;
    const { companyId, _id: userId } = req.user;

    try {
        const order = await Order.findOne({ _id: orderId, companyId });
        if (!order) {
            return next(new AppError('Order not found.', 404));
        }

        if (!order.cuttingPlanId) {
            return next(new AppError('No cutting plan associated with this order.', 400));
        }

        const cuttingPlan = await CuttingPlan.findById(order.cuttingPlanId);
        if (!cuttingPlan) {
            return next(new AppError('Cutting plan not found.', 404));
        }

        if (cuttingPlan.status === 'Committed' || order.cuttingPlanStatus === 'Committed') {
            return next(new AppError('This cutting plan has already been committed.', 400));
        }
        if (cuttingPlan.status !== 'Generated') {
            return next(new AppError(`Cutting plan status is '${cuttingPlan.status}'. Must be 'Generated' to commit.`, 400));
        }

        // Pre-validate all stock requirements before starting the commit process
        const stockValidationErrors = [];
        
        for (const materialPlan of cuttingPlan.materialPlans) {
            for (const pipeUsed of materialPlan.pipesUsed) {
                // Try to find material in V2 system first, then V1
                let materialV2 = await MaterialV2.findOne({ 
                    _id: materialPlan.materialId, 
                    companyId: companyId 
                });
                
                let materialV1 = null;
                if (!materialV2) {
                    materialV1 = await MaterialV2.findOne({ 
                        _id: materialPlan.materialId, 
                        companyId: companyId 
                    });
                }

                if (!materialV2 && !materialV1) {
                    stockValidationErrors.push(`Material ${materialPlan.materialNameSnapshot} not found`);
                    continue;
                }

                if (materialV2) {
                    // VALIDATION ONLY: Calculate consolidated quantity for the required length
                    const requiredLength = pipeUsed.standardLength.toString();
                    const requiredUnit = pipeUsed.standardLengthUnit;
                    
                    let totalAvailableQuantity = 0;
                    let foundAnyBatch = false;
                    
                    materialV2.profileBatches.forEach(batch => {
                        if (batch.length.toString() === requiredLength && batch.lengthUnit === requiredUnit) {
                            foundAnyBatch = true;
                            const batchQty = parseFloat(batch.currentQuantity.toString());
                            if (batchQty > 0) {
                                totalAvailableQuantity += batchQty;
                            }
                        }
                    });

                    if (!foundAnyBatch) {
                        stockValidationErrors.push(`No stock entry found for ${materialV2.name} of length ${requiredLength} ${requiredUnit}`);
                        continue;
                    }
                    
                    if (totalAvailableQuantity < 1) {
                        stockValidationErrors.push(`Insufficient stock for ${materialV2.name} of length ${requiredLength} ${requiredUnit}. Available: ${totalAvailableQuantity}, Required: 1`);
                    }

                } else if (materialV1) {
                    const stockLengthEntry = materialV1.stockByLength.find(
                        sl => sl.length.toString() === pipeUsed.standardLength.toString() && sl.unit === pipeUsed.standardLengthUnit
                    );

                    if (!stockLengthEntry) {
                        stockValidationErrors.push(`No stock entry found for ${materialV1.name} of length ${pipeUsed.standardLength.toString()} ${pipeUsed.standardLengthUnit}`);
                        continue;
                    }
                    
                    const currentQuantityNum = parseFloat(stockLengthEntry.quantity.toString());
                    if (currentQuantityNum < 1) {
                        stockValidationErrors.push(`Insufficient stock for ${materialV1.name} of length ${pipeUsed.standardLength.toString()} ${pipeUsed.standardLengthUnit}. Available: ${currentQuantityNum}, Required: 1`);
                    }
                }
            }
        }

        // If there are any stock validation errors, return them all at once
        if (stockValidationErrors.length > 0) {
            const errorMessage = `Cannot commit cutting plan due to insufficient inventory:\n• ${stockValidationErrors.join('\n• ')}`;
            return next(new AppError(errorMessage, 400));
        }

        // Continue with actual commit process only if validation passes
        for (const materialPlan of cuttingPlan.materialPlans) {
            for (const pipeUsed of materialPlan.pipesUsed) {
                console.log(`[Commit Cuts Debug] Processing pipe: ${pipeUsed.standardLength}${pipeUsed.standardLengthUnit} for material ${materialPlan.materialNameSnapshot}`);
                
                // Try to find material in V2 system first, then V1
                let materialV2 = await MaterialV2.findOne({ 
                    _id: materialPlan.materialId, 
                    companyId: companyId 
                });
                
                let materialV1 = null;
                if (!materialV2) {
                    materialV1 = await MaterialV2.findOne({ 
                        _id: materialPlan.materialId, 
                        companyId: companyId 
                    });
                }

                if (!materialV2 && !materialV1) {
                    throw new AppError(`Material ${materialPlan.materialNameSnapshot} not found during commit.`, 500);
                }

                if (materialV2) {
                    console.log(`[Commit Cuts Debug] Found MaterialV2: ${materialV2.name}, profileBatches count: ${materialV2.profileBatches.length}`);
                    
                    // COMMIT: Handle MaterialV2 - find a batch with available quantity
                    const requiredLength = pipeUsed.standardLength.toString();
                    const requiredUnit = pipeUsed.standardLengthUnit;
                    
                    // Find batches that match the required length and have available quantity
                    const availableBatches = materialV2.profileBatches.filter(
                        batch => batch.length.toString() === requiredLength && 
                                batch.lengthUnit === requiredUnit &&
                                parseFloat(batch.currentQuantity.toString()) > 0
                    );

                    if (availableBatches.length === 0) {
                        console.log(`[Commit Cuts Debug] Available batches for ${materialV2.name}:`);
                        materialV2.profileBatches.forEach((batch, index) => {
                            console.log(`  Batch ${index}: ${batch.length}${batch.lengthUnit}, quantity: ${batch.currentQuantity}, gauge: ${batch.gauge}`);
                        });
                        throw new AppError(`No available stock for length ${requiredLength} ${requiredUnit} of material ${materialV2.name}.`, 400);
                    }
                    
                    // Use the first available batch (you could implement FIFO, LIFO, or other strategies here)
                    const batchToUse = availableBatches[0];
                    
                    console.log(`[Commit Cuts Debug] Using batch: ${batchToUse.batchId}, length: ${batchToUse.length}${batchToUse.lengthUnit}, current quantity: ${batchToUse.currentQuantity}`);
                    
                    // Convert quantity to number for comparison and calculation
                    const currentQuantityNum = parseFloat(batchToUse.currentQuantity.toString());

                    if (currentQuantityNum < 1) {
                        throw new AppError(`Insufficient stock in selected batch for ${materialV2.name} of length ${requiredLength} ${requiredUnit}. Available: ${currentQuantityNum}, Required: 1`, 400);
                    }

                    // Deduct 1 pipe from this batch
                    const newQuantity = currentQuantityNum - 1;
                    console.log(`[Commit Cuts Debug] Updating batch ${batchToUse.batchId} quantity from ${currentQuantityNum} to ${newQuantity}`);
                    batchToUse.currentQuantity = mongoose.Types.Decimal128.fromString(newQuantity.toString());
                    
                    // Create Stock Transaction
                    const unitRate = parseFloat(batchToUse.ratePerPiece.toString());
                    const totalValue = unitRate * 1; // 1 piece consumed
                    
                    const stockTransaction = new StockTransaction({
                        companyId,
                        materialId: materialPlan.materialId,
                        type: 'Outward-OrderCut',
                        length: pipeUsed.standardLength, 
                        lengthUnit: pipeUsed.standardLengthUnit,
                        quantityChange: mongoose.Types.Decimal128.fromString("-1"),
                        quantityUnit: 'pcs', // Assuming one pipe is one piece
                        unitRateAtTransaction: batchToUse.ratePerPiece,
                        totalValueChange: mongoose.Types.Decimal128.fromString((-totalValue).toString()), // Negative because it's consumption
                        relatedDocumentType: 'CuttingPlan',
                        relatedDocumentId: cuttingPlan._id,
                        notes: `Cut for Order ${order.orderIdDisplay}, Cutting Plan ${cuttingPlan._id.toString().slice(-6)}. Material: ${materialPlan.materialNameSnapshot}, Pipe: ${pipeUsed.standardLength.toString()} ${pipeUsed.standardLengthUnit}, Batch: ${batchToUse.batchId}`,
                        createdBy: userId,
                        transactionDate: new Date(),
                    });
                    await stockTransaction.save();
                    console.log(`[Commit Cuts Debug] Stock transaction created: ${stockTransaction._id}`);
                    
                    await materialV2.save();
                    console.log(`[Commit Cuts Debug] MaterialV2 saved successfully for ${materialV2.name}`);

                } else if (materialV1) {
                    console.log(`[Commit Cuts Debug] Found MaterialV1: ${materialV1.name}, stockByLength count: ${materialV1.stockByLength.length}`);
                    
                    // Handle MaterialV1 - update stockByLength
                    const stockLengthEntry = materialV1.stockByLength.find(
                        sl => sl.length.toString() === pipeUsed.standardLength.toString() && sl.unit === pipeUsed.standardLengthUnit
                    );

                    if (!stockLengthEntry) {
                        console.log(`[Commit Cuts Debug] Available stock entries for ${materialV1.name}:`);
                        materialV1.stockByLength.forEach((entry, index) => {
                            console.log(`  Entry ${index}: ${entry.length}${entry.unit}, quantity: ${entry.quantity}`);
                        });
                        throw new AppError(`Stock entry for length ${pipeUsed.standardLength.toString()} ${pipeUsed.standardLengthUnit} of material ${materialV1.name} not found.`, 400);
                    }
                    
                    console.log(`[Commit Cuts Debug] Found stock entry: ${stockLengthEntry.length}${stockLengthEntry.unit}, current quantity: ${stockLengthEntry.quantity}`);
                    
                    // Convert quantity to number for comparison and calculation
                    const currentQuantityNum = parseFloat(stockLengthEntry.quantity.toString());

                    if (currentQuantityNum < 1) {
                        throw new AppError(`Insufficient stock for ${materialV1.name} of length ${pipeUsed.standardLength.toString()} ${pipeUsed.standardLengthUnit}. Available: ${currentQuantityNum}, Required: 1`, 400);
                    }

                    // Deduct 1 pipe of this standard length
                    const newQuantity = currentQuantityNum - 1;
                    console.log(`[Commit Cuts Debug] Updating quantity from ${currentQuantityNum} to ${newQuantity}`);
                    stockLengthEntry.quantity = mongoose.Types.Decimal128.fromString(newQuantity.toString());
                    
                    // Create Stock Transaction
                    const unitRate = parseFloat(stockLengthEntry.unitRate.toString());
                    const totalValue = unitRate * 1; // 1 piece consumed
                    
                    const stockTransaction = new StockTransaction({
                        companyId,
                        materialId: materialPlan.materialId,
                        type: 'Outward-OrderCut',
                        length: pipeUsed.standardLength, 
                        lengthUnit: pipeUsed.standardLengthUnit,
                        quantityChange: mongoose.Types.Decimal128.fromString("-1"),
                        quantityUnit: 'pcs', // Assuming one pipe is one piece
                        unitRateAtTransaction: stockLengthEntry.unitRate, // Cost of the pipe
                        totalValueChange: mongoose.Types.Decimal128.fromString((-totalValue).toString()), // Negative because it's consumption
                        relatedDocumentType: 'CuttingPlan',
                        relatedDocumentId: cuttingPlan._id,
                        notes: `Cut for Order ${order.orderIdDisplay}, Cutting Plan ${cuttingPlan._id.toString().slice(-6)}. Material: ${materialPlan.materialNameSnapshot}, Pipe: ${pipeUsed.standardLength.toString()} ${pipeUsed.standardLengthUnit}`,
                        createdBy: userId,
                        transactionDate: new Date(),
                    });
                    await stockTransaction.save();
                    console.log(`[Commit Cuts Debug] Stock transaction created: ${stockTransaction._id}`);
                    
                    await materialV1.save();
                    console.log(`[Commit Cuts Debug] MaterialV1 saved successfully for ${materialV1.name}`);
                }

                // TODO: Handle scrap logging if required (e.g. create 'Scrap' StockTransaction)
            }
        }

        cuttingPlan.status = 'Committed';
        order.cuttingPlanStatus = 'Committed';
        order.status = 'Cutting'; // Or 'In Production'
        
        const historyEntry = {
            status: order.status,
            notes: `Cutting plan ${cuttingPlan._id.toString().slice(-6)} committed. Production stage: ${order.status}`,
            updatedBy: userId,
            timestamp: new Date(),
        };
        order.history.push(historyEntry);

        await cuttingPlan.save();
        await order.save();

        res.status(200).json({
            status: 'success',
            message: 'Cuts committed successfully. Inventory updated and order status changed.',
            data: {
                order,
                cuttingPlan,
            },
        });

    } catch (error) {
        // Log the detailed error for server-side inspection
        console.error("Error during commit-cuts: ", error);
        // Send a more generic error to the client or specific if it's an AppError
        if (error instanceof AppError) {
            return next(error);
        }
        return next(new AppError('Failed to commit cuts due to an internal error.', 500));
    }
});

/**
 * @function getManufacturingQueue
 * @description Get orders that are in the manufacturing queue with optional filters
 */
exports.getManufacturingQueue = catchAsync(async (req, res, next) => {
    const { status, search, page = 1, limit = 10 } = req.query;
    const { companyId } = req.user;

    // Build query
    const query = { companyId };
    
    // Add status filter if provided
    if (status) {
        query.status = status;
    }

    // Add search filter if provided
    if (search) {
        query.$or = [
            { orderIdDisplay: { $regex: search, $options: 'i' } },
            { 'clientSnapshot.clientName': { $regex: search, $options: 'i' } }
        ];
    }

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const orders = await Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

    // Get total count for pagination
    const total = await Order.countDocuments(query);

    res.status(200).json({
        status: 'success',
        data: {
            orders,
            results: total
        }
    });
});

/**
 * @function getCuttingPlanPdfByOrderId
 * @description Controller to generate and return a PDF of the cutting plan with company details and client information.
 */
exports.getCuttingPlanPdfByOrderId = catchAsync(async (req, res, next) => {
    const { orderId } = req.params;
    const { companyId } = req.user;

    console.log(`[getCuttingPlanPdfByOrderId] Generating PDF for cutting plan with orderId: ${orderId}, companyId: ${companyId}`);

    // Get the cutting plan
    const cuttingPlan = await CuttingPlan.findOne({ orderId, companyId })
        .populate('materialPlans.materialId')
        .lean();

    if (!cuttingPlan) {
        console.log(`[getCuttingPlanPdfByOrderId] No cutting plan found for PDF generation.`);
        return next(new AppError('Cutting plan not found, cannot generate PDF.', 404));
    }

    // Get the order details
    const order = await Order.findById(orderId).lean();
    if (!order) {
        console.log(`[getCuttingPlanPdfByOrderId] Order not found for PDF generation.`);
        return next(new AppError('Order not found, cannot generate PDF.', 404));
    }

    // Get company details
    const company = await Company.findById(companyId).select('name address phone email logoUrl').lean();
    if (!company) {
        console.log(`[getCuttingPlanPdfByOrderId] Company not found for PDF generation.`);
        return next(new AppError('Company details not found, cannot generate PDF.', 404));
    }

    try {
        // Check if materialPlans exists and has at least one plan
        if (!cuttingPlan.materialPlans || cuttingPlan.materialPlans.length === 0) {
            console.error(`[getCuttingPlanPdfByOrderId] No material plans found in cutting plan ${cuttingPlan._id} for PDF generation.`);
            return next(new AppError('No material plans available in the cutting plan to generate PDF.', 404));
        }

        console.log(`[getCuttingPlanPdfByOrderId] Generating PDF for ${cuttingPlan.materialPlans.length} material plans`);

        // Generate SVG for embedding in PDF
        const svgOutput = svgGenerator.generateCuttingPlanSVG(cuttingPlan.materialPlans);
        
        // Generate PDF
        const pdfBuffer = await generateCuttingPlanPDF({
            cuttingPlan,
            order,
            company,
            svgOutput
        });

        if (!pdfBuffer || pdfBuffer.length === 0) {
            console.error(`[getCuttingPlanPdfByOrderId] PDF generation failed for cutting plan ${cuttingPlan._id}: Buffer is empty.`);
            return next(new AppError('Failed to generate PDF: Empty buffer.', 500));
        }

        // Validate if it's a PDF (starts with %PDF)
        if (!isValidPDFBuffer(pdfBuffer)) {
            console.error(`[getCuttingPlanPdfByOrderId] PDF generation failed for cutting plan ${cuttingPlan._id}: Invalid PDF buffer.`);
            return next(new AppError('Failed to generate PDF: Invalid PDF format.', 500));
        }

        // Set headers and send PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Cutting-Plan-${order.orderIdDisplay}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);

    } catch (error) {
        console.error(`[getCuttingPlanPdfByOrderId] Error generating PDF for cutting plan ${cuttingPlan._id}:`, error);
        return next(new AppError('Failed to generate PDF for cutting plan.', 500));
    }
});

/**
 * Helper function to validate PDF buffer
 * @param {Buffer} pdfBuffer - PDF buffer to validate
 * @returns {boolean} - True if valid PDF, false otherwise
 */
const isValidPDFBuffer = (pdfBuffer) => {
    return pdfBuffer && pdfBuffer.length > 0 && 
           pdfBuffer[0] === 0x25 && // %
           pdfBuffer[1] === 0x50 && // P  
           pdfBuffer[2] === 0x44 && // D
           pdfBuffer[3] === 0x46;   // F
};