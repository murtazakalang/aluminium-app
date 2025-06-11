const Order = require('../models/Order');
const Quotation = require('../models/Quotation');
const ProductType = require('../models/ProductType');
const MaterialV2 = require('../models/MaterialV2');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/appError');
const orderService = require('../services/orderService');
const CuttingOptimizationService = require('../services/cuttingOptimizationService');
const Company = require('../models/Company');
const { generateStockAvailabilityPDF } = require('../utils/stockAvailabilityPdfGenerator');

// Import to access the optimization lock (we'll need to export it from manufacturingController)
// For now, we'll create our own check here, but ideally this should be shared
const backgroundOptimizationInProgress = new Set();

// Utility function to generate unique orderIdDisplay (placeholder)
async function generateOrderIdDisplay(companyId) {
    const currentYear = new Date().getFullYear();
    const prefix = `SO-${currentYear}-`;
    
    // Count existing orders for this year and company to get the next sequential number
    const count = await Order.countDocuments({
        companyId,
        orderIdDisplay: { $regex: `^${prefix}` }
    });
    
    const nextNumber = count + 1;
    return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
}

exports.createOrderFromQuotation = catchAsync(async (req, res, next) => {
    const { quotationId } = req.params;
    const { companyId } = req.user;

    const quotation = await Quotation.findOne({ _id: quotationId, companyId }).populate('items.productTypeId');

    if (!quotation) {
        return next(new AppError('Quotation not found', 404));
    }

    if (quotation.status !== 'Accepted') {
        return next(new AppError('Quotation must be in "Accepted" status to create an order', 400));
    }

    const orderIdDisplay = await generateOrderIdDisplay(companyId);

    const orderData = await orderService.prepareOrderDataFromQuotation(quotation, companyId, req.user._id, orderIdDisplay);

    const order = await Order.create(orderData);

    // Optionally, update quotation status to 'Converted'
    quotation.status = 'Converted';
    await quotation.save();

    res.status(201).json({
        status: 'success',
        data: {
            order,
        },
    });
});

exports.listOrders = catchAsync(async (req, res, next) => {
    const { companyId } = req.user;
    // TODO: Add pagination, filtering, sorting
    const orders = await Order.find({ companyId })
        .populate('clientId', 'clientName contactPerson')
        .sort({ createdAt: -1 });

    res.status(200).json({
        status: 'success',
        results: orders.length,
        data: {
            orders,
        },
    });
});

exports.getOrderById = catchAsync(async (req, res, next) => {
    const { orderId } = req.params;
    const { companyId } = req.user;

    const order = await Order.findOne({ _id: orderId, companyId })
        .populate('clientId', 'clientName contactPerson email')
        .populate('items.productTypeId', 'name materials glassAreaFormula') // Populate product type for material calculations
        .populate('measurementConfirmedBy', 'firstName lastName email')
        .populate('history.updatedBy', 'firstName lastName email');

    if (!order) {
        return next(new AppError('Order not found', 404));
    }

    res.status(200).json({
        status: 'success',
        data: {
            order,
        },
    });
});

exports.confirmMeasurements = catchAsync(async (req, res, next) => {
    const { orderId } = req.params;
    const { companyId, _id: userId } = req.user;
    const { items } = req.body; // Expecting an array of items with finalWidth, finalHeight, finalQuantity

    if (!items || !Array.isArray(items) || items.length === 0) {
        return next(new AppError('Please provide items with final measurements.', 400));
    }

    const order = await Order.findOne({ _id: orderId, companyId }).populate('items.productTypeId');

    if (!order) {
        return next(new AppError('Order not found', 404));
    }

    if (!['Pending', 'Measurement Confirmed'].includes(order.status)) {
        return next(new AppError(`Order measurements can only be confirmed if status is Pending or Measurement Confirmed. Current status: ${order.status}`, 400));
    }

    const updatedOrder = await orderService.updateAndRecalculateOrderItems(order, items, companyId, userId);

    updatedOrder.measurementConfirmedBy = userId;
    updatedOrder.measurementConfirmedAt = Date.now();
    updatedOrder.status = 'Measurement Confirmed';
    updatedOrder.history.push({
        status: 'Measurement Confirmed',
        notes: 'Final measurements confirmed.',
        updatedBy: userId,
        timestamp: Date.now(),
    });

    await updatedOrder.save();

    res.status(200).json({
        status: 'success',
        data: {
            order: updatedOrder,
        },
    });
});

exports.getRequiredCuts = catchAsync(async (req, res, next) => {
    const { orderId } = req.params;
    const { companyId } = req.user;

    const order = await Order.findOne({ _id: orderId, companyId })
        .populate({
            path: 'items',
            populate: {
                path: 'productTypeId',
                select: 'name'
            }
        })
        .populate({
            path: 'items.requiredMaterialCuts.materialId',
            select: 'name usageUnit category'
        });

    if (!order) {
        return next(new AppError('Order not found', 404));
    }

    if (!order.status || !['Measurement Confirmed', 'Ready for Optimization', 'Optimization Complete', 'In Production', 'Cutting'].includes(order.status)) {
        return next(new AppError('Raw required cuts can only be retrieved for orders with confirmed measurements or in production stages.', 400));
    }

    const aggregatedMaterialData = {};

    for (const item of order.items) {
        for (const matDetail of item.requiredMaterialCuts) {
            // Handle both populated and non-populated material references
            let material = matDetail.materialId;
            let materialIdStr;
            
            // If materialId is not populated (V2 materials), fetch it manually
            if (!material || !material._id || !material.name) {
                const rawMaterialId = material || matDetail.materialId;
                if (rawMaterialId) {
                    materialIdStr = rawMaterialId.toString();
                    // Use OrderService instance method to find material in both V2 and V1 systems
                    const foundMaterial = await orderService.findMaterialById(rawMaterialId, companyId);
                    if (foundMaterial) {
                        material = {
                            _id: foundMaterial._id,
                            name: foundMaterial.name,
                            category: foundMaterial.category,
                            usageUnit: foundMaterial.usageUnit
                        };
                    } else {
                        console.warn(`MaterialV2 not found for ID: ${materialIdStr} in order ${orderId}. Using snapshot data.`);
                        // Use snapshot data as fallback
                        material = {
                            _id: rawMaterialId,
                            name: matDetail.materialNameSnapshot || 'Unknown MaterialV2',
                            category: 'Unknown',
                            usageUnit: matDetail.lengthUnit || 'unknown'
                        };
                    }
                } else {
                    console.warn(`Skipping material detail in order ${orderId} due to missing materialId:`, matDetail);
                    continue;
                }
            } else {
                materialIdStr = material._id.toString();
            }

            if (matDetail.isCutRequired || material.category === 'Profile') {
                if (!aggregatedMaterialData[materialIdStr]) {
                    aggregatedMaterialData[materialIdStr] = {
                        materialId: materialIdStr,
                        materialName: material.name,
                        usageUnit: matDetail.lengthUnit || material.usageUnit, // Use lengthUnit from matDetail if present
                        category: material.category,
                        requiredCuts: [] // This will store raw cut lengths
                    };
                }
                if (matDetail.cutLengths && matDetail.cutLengths.length > 0) {
                    matDetail.cutLengths.forEach(l => {
                        if (l && typeof l.toString === 'function') {
                             aggregatedMaterialData[materialIdStr].requiredCuts.push(parseFloat(l.toString()));
                        }
                    });
                }
            }
        }
    }

    res.status(200).json({
        status: 'success',
        data: {
            requiredCuts: Object.values(aggregatedMaterialData).map(agg => {
                // Group the raw cuts for display
                const groupedCuts = agg.requiredCuts
                    .map(rc => ({ length: rc, unit: agg.usageUnit, count: 1 }))
                    .reduce((acc, curr) => {
                        const existing = acc.find(x => 
                            Math.abs(x.length - curr.length) < 0.01 && // Tolerance for float comparison
                            x.unit === curr.unit
                        );
                        if (existing) {
                            existing.count++;
                        } else {
                            acc.push({ length: parseFloat(curr.length.toFixed(2)), unit: curr.unit, count: curr.count });
                        }
                        return acc;
                    }, [])
                    .sort((a, b) => a.length - b.length);

                return {
                    materialId: agg.materialId,
                    materialName: agg.materialName,
                    usageUnit: agg.usageUnit,
                    category: agg.category,
                    requiredCuts: agg.requiredCuts, // The flat list of raw cuts
                    requiredCutsDetail: groupedCuts, // The grouped display for the frontend
                };
            }),
        },
    });
});

exports.checkStock = catchAsync(async (req, res, next) => {
    const { orderId } = req.params;
    const { companyId } = req.user;

    const order = await Order.findOne({ _id: orderId, companyId });

    if (!order) {
        return next(new AppError('Order not found', 404));
    }

    if (!order.status || !['Measurement Confirmed', 'Ready for Optimization', 'Optimization Complete', 'In Production', 'Cutting'].includes(order.status)) {
        return next(new AppError('Stock check can only be performed for orders with confirmed measurements, ready for optimization, or in production stages.', 400));
    }

    const detailedStockAvailability = await orderService.getDetailedStockAvailabilityForOrder(order, companyId);

    res.status(200).json({
        status: 'success',
        data: {
            detailedStockAvailability,
        },
    });
});

exports.updateOrderStatus = catchAsync(async (req, res, next) => {
    const { orderId } = req.params;
    const { companyId, _id: userId } = req.user;
    const { status: newStatus, notes } = req.body;

    if (!newStatus) {
        return next(new AppError('Please provide a status to update.', 400));
    }
    
    const order = await Order.findOne({ _id: orderId, companyId });

    if (!order) {
        return next(new AppError('Order not found', 404));
    }

    if (!orderService.isValidStatusTransition(order.status, newStatus)) {
        return next(new AppError(`Invalid status transition from ${order.status} to ${newStatus}.`, 400));
    }

    const previousStatus = order.status;
    order.status = newStatus;
    order.history.push({
        status: newStatus,
        notes: notes || `Status changed from ${previousStatus} to ${newStatus}`,
        updatedBy: userId,
        timestamp: Date.now(),
    });

    // If order is moving to Ready for Optimization, clear any previous cutting plan IDs/statuses
    // to allow a fresh optimization run. This is important if an order was previously optimized,
    // then reverted or changed, and is now being sent for optimization again.
    if (newStatus === 'Ready for Optimization') {
        order.cuttingPlanId = null;
        order.cuttingPlanStatus = 'Pending'; // Or some other appropriate initial status
    }

    await order.save({ session: req.mongoSession || null }); // Save the status change first

    // If status is 'Ready for Optimization', trigger the optimization process
    if (newStatus === 'Ready for Optimization' && previousStatus !== 'Ready for Optimization') {
        console.log(`Order ${orderId} transitioned to 'Ready for Optimization'. Triggering optimization process...`);
        
        // Check if optimization is already in progress to avoid race conditions
        if (backgroundOptimizationInProgress.has(orderId)) {
            console.log(`Optimization already in progress for order ${orderId}, skipping background trigger.`);
        } else {
            backgroundOptimizationInProgress.add(orderId);
            
            try {
                const optimizer = new CuttingOptimizationService(); // Instantiate the service
                // Note: This runs in the background and doesn't wait for completion.
                // The actual cutting plan generation updates order status upon completion/failure.
                optimizer.optimizeCuts(order._id.toString(), companyId.toString(), userId.toString())
                    .then(cuttingPlan => {
                        console.log(`Optimization successfully initiated for order ${order._id}. Plan ID: ${cuttingPlan._id}`);
                        // Further actions after successful initiation, if any (e.g., notifications)
                    })
                    .catch(err => {
                        console.error(`Background optimization failed to initiate for order ${order._id}:`, err);
                        // Handle initiation failure, e.g., by setting a specific order note or a different status
                        // This is tricky because the main request has already responded.
                        // Consider a more robust background job system for production.
                        order.notes = (order.notes ? order.notes + '\n' : '') + `Automated optimization initiation failed: ${err.message}`;
                        order.status = 'Optimization Failed'; // Or a custom status indicating initiation failure
                        order.cuttingPlanStatus = 'Failed';
                        order.save().catch(saveErr => console.error(`Failed to save order status after optimization initiation error for order ${order._id}:`, saveErr));
                    })
                    .finally(() => {
                        // Always remove from the set when done
                        backgroundOptimizationInProgress.delete(orderId);
                    });
            } catch (err) {
                // This catch is for synchronous errors during the instantiation or immediate call
                console.error(`Failed to start optimization process for order ${orderId}:`, err);
                backgroundOptimizationInProgress.delete(orderId);
                // Potentially revert status or add a note, though this part of the code is less likely to be hit with async optimizeCuts
                // For simplicity, we'll rely on the .catch() of the promise for async errors.
            }
        }
    }

    res.status(200).json({
        status: 'success',
        data: {
            order, // Return the order with its new status
        },
    });
});

exports.getOrderHistory = catchAsync(async (req, res, next) => {
    const { orderId } = req.params;
    const { companyId } = req.user;

    const order = await Order.findOne({ _id: orderId, companyId })
        .select('history orderIdDisplay')
        .populate('history.updatedBy', 'firstName lastName email');

    if (!order) {
        return next(new AppError('Order not found or no history available', 404));
    }

    res.status(200).json({
        status: 'success',
        data: {
            orderIdDisplay: order.orderIdDisplay,
            history: order.history,
        },
    });
});

exports.generateStockAvailabilityPDF = catchAsync(async (req, res, next) => {
    const { orderId } = req.params;
    const { companyId } = req.user;

    console.log(`[generateStockAvailabilityPDF] Starting PDF generation for order: ${orderId}`);

    const order = await Order.findOne({ _id: orderId, companyId }).populate([
        { path: 'clientId', select: 'clientName email contactNumber billingAddress siteAddress gstin' },
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'items.productTypeId', select: 'name materials glassAreaFormula' } // Populate product types for glass calculations
    ]);

    if (!order) {
        return next(new AppError('Order not found', 404));
    }

    if (!order.status || !['Measurement Confirmed', 'Ready for Optimization', 'Optimization Complete', 'In Production', 'Cutting'].includes(order.status)) {
        return next(new AppError('Stock availability PDF can only be generated for orders with confirmed measurements or in production stages.', 400));
    }

    try {
        // Get stock availability data
        const stockAvailability = await orderService.getDetailedStockAvailabilityForOrder(order, companyId);
        
        // Calculate glass requirements from order items
        const glassRequirements = [];
        
        // Simple formula evaluator function (matching frontend logic)
        const evaluateFormula = (formula, variables) => {
            try {
                // Replace variables in formula
                let expression = formula;
                for (const [variable, value] of Object.entries(variables)) {
                    const regex = new RegExp(variable, 'g');
                    expression = expression.replace(regex, value.toString());
                }
                
                // Basic safety check - only allow numbers, operators, and parentheses
                if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
                    return { result: null, error: 'Formula contains invalid characters' };
                }
                
                // Evaluate the expression
                const result = eval(expression);
                
                if (typeof result !== 'number' || isNaN(result)) {
                    return { result: null, error: 'Formula did not evaluate to a valid number' };
                }
                
                return { result, error: null };
            } catch (err) {
                return { result: null, error: 'Invalid formula syntax' };
            }
        };
        
        order.items.forEach((item, index) => {
            if (item.selectedGlassTypeNameSnapshot) {
                // Get glass formula from product type (now properly populated)
                const productType = item.productTypeId;
                const glassFormula = productType?.glassAreaFormula;
                
                let calculatedWidth = parseFloat(item.finalWidth.toString()) || 0;
                let calculatedHeight = parseFloat(item.finalHeight.toString()) || 0;
                let totalGlassPieces = 1; // Default to 1 piece per item
                
                if (glassFormula && glassFormula.widthFormula && glassFormula.heightFormula) {
                    const widthInput = parseFloat(item.finalWidth.toString());
                    const heightInput = parseFloat(item.finalHeight.toString());
                    
                    // Apply width formula
                    if (glassFormula.widthFormula.trim()) {
                        const widthResult = evaluateFormula(glassFormula.widthFormula, { W: widthInput, H: heightInput });
                        if (!widthResult.error && widthResult.result !== null) {
                            calculatedWidth = widthResult.result;
                        }
                    }
                    
                    // Apply height formula
                    if (glassFormula.heightFormula.trim()) {
                        const heightResult = evaluateFormula(glassFormula.heightFormula, { W: widthInput, H: heightInput });
                        if (!heightResult.error && heightResult.result !== null) {
                            calculatedHeight = heightResult.result;
                        }
                    }
                    
                    // Use glass quantity from formula
                    totalGlassPieces = glassFormula.glassQuantity || 1;
                }
                
                glassRequirements.push({
                    itemNumber: index + 1,
                    material: item.selectedGlassTypeNameSnapshot,
                    category: 'Glass',
                    width: calculatedWidth,
                    height: calculatedHeight,
                    widthUnit: order.dimensionUnit || 'inches',
                    heightUnit: order.dimensionUnit || 'inches',
                    totalGlassPieces: totalGlassPieces,
                });
            }
        });

        // Get company details
        const company = await Company.findById(companyId).select('name address phone email');
        
        console.log(`[generateStockAvailabilityPDF] Generating PDF with ${stockAvailability.length} materials and ${glassRequirements.length} glass types`);

        // Generate PDF
        const pdfBuffer = await generateStockAvailabilityPDF(order, stockAvailability, glassRequirements, company);
        
        if (!pdfBuffer || pdfBuffer.length === 0) {
            throw new Error('Generated PDF is empty');
        }

        console.log(`[generateStockAvailabilityPDF] PDF generated successfully. Buffer length: ${pdfBuffer.length}`);

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="stock-check-${order.orderIdDisplay}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        // Send PDF
        res.end(pdfBuffer);
        return;

    } catch (error) {
        console.error('Error generating stock availability PDF:', error);
        return next(new AppError(`Failed to generate stock availability PDF: ${error.message}`, 500));
    }
}); 