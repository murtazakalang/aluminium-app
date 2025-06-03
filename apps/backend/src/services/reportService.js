const Client = require('../models/Client');
const Quotation = require('../models/Quotation');
const Order = require('../models/Order');
const MaterialV2 = require('../models/MaterialV2');
const CuttingPlan = require('../models/CuttingPlan');
const mongoose = require('mongoose');

/**
 * Report Service for generating various business intelligence reports
 */

/**
 * Get client-related reports
 * @param {string} companyId - Company ID for multi-tenancy
 * @param {Object} filters - Filters for date range, status, etc.
 * @returns {Object} Client report data
 */
const getClientReport = async (companyId, filters = {}) => {
    const { startDate, endDate, status, leadSource } = filters;
    
    // Build match conditions
    const matchConditions = { 
        companyId: new mongoose.Types.ObjectId(companyId),
        isActive: true
    };
    
    if (startDate || endDate) {
        matchConditions.createdAt = {};
        if (startDate) matchConditions.createdAt.$gte = new Date(startDate);
        if (endDate) matchConditions.createdAt.$lte = new Date(endDate);
    }
    
    if (status) matchConditions.followUpStatus = status;
    if (leadSource) matchConditions.leadSource = leadSource;

    // Main aggregation pipeline
    const pipeline = [
        { $match: matchConditions },
        {
            $lookup: {
                from: 'quotations',
                localField: '_id',
                foreignField: 'clientId',
                as: 'quotations'
            }
        },
        {
            $lookup: {
                from: 'orders',
                localField: '_id',
                foreignField: 'clientId',
                as: 'orders'
            }
        },
        {
            $addFields: {
                totalQuotations: { $size: '$quotations' },
                totalOrders: { $size: '$orders' },
                quotationValue: {
                    $sum: {
                        $map: {
                            input: '$quotations',
                            as: 'quote',
                            in: { $toDouble: { $ifNull: ['$$quote.grandTotal', 0] } }
                        }
                    }
                },
                orderValue: {
                    $sum: {
                        $map: {
                            input: '$orders',
                            as: 'order',
                            in: { $toDouble: { $ifNull: ['$$order.finalGrandTotal', 0] } }
                        }
                    }
                },
                conversionRate: {
                    $cond: {
                        if: { $gt: [{ $size: '$quotations' }, 0] },
                        then: {
                            $multiply: [
                                { $divide: [{ $size: '$orders' }, { $size: '$quotations' }] },
                                { $literal: 100 }
                            ]
                        },
                        else: 0
                    }
                }
            }
        },
        {
            $group: {
                _id: null,
                totalClients: { $sum: 1 },
                clients: { $push: '$$ROOT' },
                
                // Status breakdown
                statusBreakdown: {
                    $push: {
                        status: '$followUpStatus',
                        count: 1,
                        value: '$quotationValue'
                    }
                },
                
                // Lead source breakdown
                leadSourceBreakdown: {
                    $push: {
                        source: '$leadSource',
                        count: 1,
                        value: '$quotationValue'
                    }
                },
                
                // Summary metrics
                totalQuotationValue: { $sum: '$quotationValue' },
                totalOrderValue: { $sum: '$orderValue' },
                totalQuotations: { $sum: '$totalQuotations' },
                totalOrders: { $sum: '$totalOrders' },
                averageConversionRate: { $avg: '$conversionRate' }
            }
        },
        {
            $addFields: {
                // Process status breakdown
                statusSummary: {
                    $reduce: {
                        input: '$statusBreakdown',
                        initialValue: {},
                        in: {
                            $mergeObjects: [
                                '$$value',
                                {
                                    $arrayToObject: [[{
                                        k: '$$this.status',
                                        v: {
                                            count: { $add: [{ $ifNull: [{ $getField: { field: { $concat: ['$$this.status', '.count'] }, input: '$$value' } }, 0] }, 1] },
                                            value: { $add: [{ $ifNull: [{ $getField: { field: { $concat: ['$$this.status', '.value'] }, input: '$$value' } }, 0] }, '$$this.value'] }
                                        }
                                    }]]
                                }
                            ]
                        }
                    }
                },
                
                // Process lead source breakdown
                leadSourceSummary: {
                    $reduce: {
                        input: '$leadSourceBreakdown',
                        initialValue: {},
                        in: {
                            $mergeObjects: [
                                '$$value',
                                {
                                    $arrayToObject: [[{
                                        k: { $ifNull: ['$$this.source', 'Unknown'] },
                                        v: {
                                            count: { $add: [{ $ifNull: [{ $getField: { field: { $concat: [{ $ifNull: ['$$this.source', 'Unknown'] }, '.count'] }, input: '$$value' } }, 0] }, 1] },
                                            value: { $add: [{ $ifNull: [{ $getField: { field: { $concat: [{ $ifNull: ['$$this.source', 'Unknown'] }, '.value'] }, input: '$$value' } }, 0] }, '$$this.value'] }
                                        }
                                    }]]
                                }
                            ]
                        }
                    }
                }
            }
        },
        {
            $project: {
                totalClients: 1,
                totalQuotationValue: 1,
                totalOrderValue: 1,
                totalQuotations: 1,
                totalOrders: 1,
                averageConversionRate: 1,
                overallConversionRate: {
                    $cond: {
                        if: { $gt: ['$totalQuotations', 0] },
                        then: { $multiply: [{ $divide: ['$totalOrders', '$totalQuotations'] }, { $literal: 100 }] },
                        else: 0
                    }
                },
                statusSummary: 1,
                leadSourceSummary: 1,
                topClients: {
                    $slice: [
                        {
                            $sortArray: {
                                input: '$clients',
                                sortBy: { quotationValue: -1 }
                            }
                        },
                        10
                    ]
                }
            }
        }
    ];

    const result = await Client.aggregate(pipeline);
    return result[0] || {
        totalClients: 0,
        totalQuotationValue: 0,
        totalOrderValue: 0,
        totalQuotations: 0,
        totalOrders: 0,
        overallConversionRate: 0,
        averageConversionRate: 0,
        statusSummary: {},
        leadSourceSummary: {},
        topClients: []
    };
};

/**
 * Get quotation-related reports
 * @param {string} companyId - Company ID for multi-tenancy
 * @param {Object} filters - Filters for date range, status, etc.
 * @returns {Object} Quotation report data
 */
const getQuotationReport = async (companyId, filters = {}) => {
    const { startDate, endDate, status, clientId } = filters;
    
    // Build match conditions
    const matchConditions = { 
        companyId: new mongoose.Types.ObjectId(companyId)
    };
    
    if (startDate || endDate) {
        matchConditions.createdAt = {};
        if (startDate) matchConditions.createdAt.$gte = new Date(startDate);
        if (endDate) matchConditions.createdAt.$lte = new Date(endDate);
    }
    
    if (status) matchConditions.status = status;
    if (clientId) matchConditions.clientId = new mongoose.Types.ObjectId(clientId);

    const pipeline = [
        { $match: matchConditions },
        {
            $lookup: {
                from: 'clients',
                localField: 'clientId',
                foreignField: '_id',
                as: 'client'
            }
        },
        {
            $lookup: {
                from: 'orders',
                localField: '_id',
                foreignField: 'quotationId',
                as: 'orders'
            }
        },
        {
            $addFields: {
                clientName: { $arrayElemAt: ['$client.clientName', 0] },
                hasOrder: { $gt: [{ $size: '$orders' }, 0] },
                grandTotalNumeric: { $toDouble: { $ifNull: ['$grandTotal', 0] } },
                month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                week: { $dateToString: { format: '%Y-W%U', date: '$createdAt' } }
            }
        },
        {
            $facet: {
                // Overall summary
                summary: [
                    {
                        $group: {
                            _id: null,
                            totalQuotations: { $sum: 1 },
                            totalValue: { $sum: '$grandTotalNumeric' },
                            averageValue: { $avg: '$grandTotalNumeric' },
                            convertedQuotations: { $sum: { $cond: ['$hasOrder', 1, 0] } },
                            
                            // Status breakdown
                            statusCounts: {
                                $push: {
                                    status: '$status',
                                    value: '$grandTotalNumeric'
                                }
                            }
                        }
                    },
                    {
                        $addFields: {
                            conversionRate: {
                                $cond: {
                                    if: { $gt: ['$totalQuotations', 0] },
                                    then: { $multiply: [{ $divide: ['$convertedQuotations', '$totalQuotations'] }, { $literal: 100 }] },
                                    else: 0
                                }
                            },
                            statusBreakdown: {
                                $reduce: {
                                    input: '$statusCounts',
                                    initialValue: {},
                                    in: {
                                        $mergeObjects: [
                                            '$$value',
                                            {
                                                $arrayToObject: [[{
                                                    k: '$$this.status',
                                                    v: {
                                                        count: { $add: [{ $ifNull: [{ $getField: { field: { $concat: ['$$this.status', '.count'] }, input: '$$value' } }, 0] }, 1] },
                                                        value: { $add: [{ $ifNull: [{ $getField: { field: { $concat: ['$$this.status', '.value'] }, input: '$$value' } }, 0] }, '$$this.value'] }
                                                    }
                                                }]]
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    }
                ],
                
                // Monthly trends
                monthlyTrends: [
                    {
                        $group: {
                            _id: '$month',
                            count: { $sum: 1 },
                            value: { $sum: '$grandTotalNumeric' },
                            converted: { $sum: { $cond: ['$hasOrder', 1, 0] } }
                        }
                    },
                    {
                        $addFields: {
                            conversionRate: {
                                $cond: {
                                    if: { $gt: ['$count', 0] },
                                    then: { $multiply: [{ $divide: ['$converted', '$count'] }, { $literal: 100 }] },
                                    else: 0
                                }
                            }
                        }
                    },
                    { $sort: { _id: 1 } }
                ],
                
                // Top performing quotations
                topQuotations: [
                    { $sort: { grandTotalNumeric: -1 } },
                    { $limit: 10 },
                    {
                        $project: {
                            quotationIdDisplay: 1,
                            clientName: 1,
                            grandTotal: 1,
                            status: 1,
                            createdAt: 1,
                            hasOrder: 1
                        }
                    }
                ],
                
                // Product type analysis
                productAnalysis: [
                    { $unwind: '$items' },
                    {
                        $group: {
                            _id: '$items.productTypeNameSnapshot',
                            count: { $sum: '$items.quantity' },
                            totalArea: { $sum: { $toDouble: { $ifNull: ['$items.totalChargeableArea', 0] } } },
                            totalValue: { $sum: { $toDouble: { $ifNull: ['$items.itemSubtotal', 0] } } }
                        }
                    },
                    { $sort: { totalValue: -1 } },
                    { $limit: 10 }
                ]
            }
        }
    ];

    const result = await Quotation.aggregate(pipeline);
    const data = result[0];
    
    return {
        summary: data.summary[0] || {
            totalQuotations: 0,
            totalValue: 0,
            averageValue: 0,
            convertedQuotations: 0,
            conversionRate: 0,
            statusBreakdown: {}
        },
        monthlyTrends: data.monthlyTrends || [],
        topQuotations: data.topQuotations || [],
        productAnalysis: data.productAnalysis || []
    };
};

/**
 * Get sales order reports
 * @param {string} companyId - Company ID for multi-tenancy
 * @param {Object} filters - Filters for date range, status, etc.
 * @returns {Object} Sales order report data
 */
const getSalesOrderReport = async (companyId, filters = {}) => {
    const { startDate, endDate, status, clientId } = filters;
    
    // Build match conditions
    const matchConditions = { 
        companyId: new mongoose.Types.ObjectId(companyId)
    };
    
    if (startDate || endDate) {
        matchConditions.createdAt = {};
        if (startDate) matchConditions.createdAt.$gte = new Date(startDate);
        if (endDate) matchConditions.createdAt.$lte = new Date(endDate);
    }
    
    if (status) matchConditions.status = status;
    if (clientId) matchConditions.clientId = new mongoose.Types.ObjectId(clientId);

    const pipeline = [
        { $match: matchConditions },
        {
            $lookup: {
                from: 'clients',
                localField: 'clientId',
                foreignField: '_id',
                as: 'client'
            }
        },
        {
            $lookup: {
                from: 'quotations',
                localField: 'quotationId',
                foreignField: '_id',
                as: 'quotation'
            }
        },
        {
            $addFields: {
                clientName: { $arrayElemAt: ['$client.clientName', 0] },
                finalGrandTotalNumeric: { $toDouble: { $ifNull: ['$finalGrandTotal', 0] } },
                month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                isCompleted: { $in: ['$status', ['Delivered', 'Completed']] },
                isInProduction: { 
                    $in: ['$status', ['In Production', 'Cutting', 'Assembly', 'QC', 'Packed', 'Ready for Dispatch']] 
                },
                daysTaken: {
                    $cond: {
                        if: { $in: ['$status', ['Delivered', 'Completed']] },
                        then: { $divide: [{ $subtract: [new Date(), '$createdAt'] }, { $literal: 86400000 }] }, // Convert to days
                        else: null
                    }
                }
            }
        },
        {
            $facet: {
                // Overall summary
                summary: [
                    {
                        $group: {
                            _id: null,
                            totalOrders: { $sum: 1 },
                            totalValue: { $sum: '$finalGrandTotalNumeric' },
                            averageValue: { $avg: '$finalGrandTotalNumeric' },
                            completedOrders: { $sum: { $cond: ['$isCompleted', 1, 0] } },
                            inProductionOrders: { $sum: { $cond: ['$isInProduction', 1, 0] } },
                            averageCompletionTime: { 
                                $avg: { 
                                    $cond: [
                                        { $ne: ['$daysTaken', null] },
                                        '$daysTaken',
                                        null
                                    ]
                                }
                            },
                            
                            // Status breakdown
                            statusCounts: {
                                $push: {
                                    status: '$status',
                                    value: '$finalGrandTotalNumeric'
                                }
                            }
                        }
                    },
                    {
                        $addFields: {
                            completionRate: {
                                $cond: {
                                    if: { $gt: ['$totalOrders', 0] },
                                    then: { $multiply: [{ $divide: ['$completedOrders', '$totalOrders'] }, { $literal: 100 }] },
                                    else: 0
                                }
                            },
                            statusBreakdown: {
                                $reduce: {
                                    input: '$statusCounts',
                                    initialValue: {},
                                    in: {
                                        $mergeObjects: [
                                            '$$value',
                                            {
                                                $arrayToObject: [[{
                                                    k: '$$this.status',
                                                    v: {
                                                        count: { $add: [{ $ifNull: [{ $getField: { field: { $concat: ['$$this.status', '.count'] }, input: '$$value' } }, 0] }, 1] },
                                                        value: { $add: [{ $ifNull: [{ $getField: { field: { $concat: ['$$this.status', '.value'] }, input: '$$value' } }, 0] }, '$$this.value'] }
                                                    }
                                                }]]
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    }
                ],
                
                // Monthly trends
                monthlyTrends: [
                    {
                        $group: {
                            _id: '$month',
                            count: { $sum: 1 },
                            value: { $sum: '$finalGrandTotalNumeric' },
                            completed: { $sum: { $cond: ['$isCompleted', 1, 0] } }
                        }
                    },
                    {
                        $addFields: {
                            completionRate: {
                                $cond: {
                                    if: { $gt: ['$count', 0] },
                                    then: { $multiply: [{ $divide: ['$completed', '$count'] }, { $literal: 100 }] },
                                    else: 0
                                }
                            }
                        }
                    },
                    { $sort: { _id: 1 } }
                ],
                
                // Top performing orders
                topOrders: [
                    { $sort: { finalGrandTotalNumeric: -1 } },
                    { $limit: 10 },
                    {
                        $project: {
                            orderIdDisplay: 1,
                            clientName: 1,
                            finalGrandTotal: 1,
                            status: 1,
                            createdAt: 1,
                            daysTaken: 1
                        }
                    }
                ],
                
                // Product type analysis
                productAnalysis: [
                    { $unwind: '$items' },
                    {
                        $group: {
                            _id: '$items.productTypeNameSnapshot',
                            count: { $sum: '$items.finalQuantity' },
                            totalArea: { $sum: { $toDouble: { $ifNull: ['$items.finalTotalChargeableArea', 0] } } },
                            totalValue: { $sum: { $toDouble: { $ifNull: ['$items.finalItemSubtotal', 0] } } }
                        }
                    },
                    { $sort: { totalValue: -1 } },
                    { $limit: 10 }
                ]
            }
        }
    ];

    const result = await Order.aggregate(pipeline);
    const data = result[0];
    
    return {
        summary: data.summary[0] || {
            totalOrders: 0,
            totalValue: 0,
            averageValue: 0,
            completedOrders: 0,
            inProductionOrders: 0,
            completionRate: 0,
            averageCompletionTime: 0,
            statusBreakdown: {}
        },
        monthlyTrends: data.monthlyTrends || [],
        topOrders: data.topOrders || [],
        productAnalysis: data.productAnalysis || []
    };
};

/**
 * Get inventory reports (revised for stock by length)
 * @param {string} companyId - Company ID for multi-tenancy
 * @param {Object} filters - Filters for category, low stock, etc.
 * @returns {Object} Inventory report data
 */
const getInventoryReport = async (companyId, filters = {}) => {
    const { category, lowStockOnly } = filters;
    
    // Build match conditions
    const matchConditions = { 
        companyId: new mongoose.Types.ObjectId(companyId),
        isActive: true
    };
    
    if (category) matchConditions.category = category;

    const pipeline = [
        { $match: matchConditions },
        {
            $addFields: {
                // Calculate total stock value for profiles (by length)
                profileStockValue: {
                    $cond: {
                        if: { $eq: ['$category', 'Profile'] },
                        then: {
                            $sum: {
                                $map: {
                                    input: '$stockByLength',
                                    as: 'stock',
                                    in: {
                                        $multiply: [
                                            { $toDouble: { $ifNull: ['$$stock.quantity', 0] } },
                                            { $toDouble: { $ifNull: ['$$stock.unitRate', 0] } }
                                        ]
                                    }
                                }
                            }
                        },
                        else: 0
                    }
                },
                
                // Calculate total stock value for non-profiles
                nonProfileStockValue: {
                    $cond: {
                        if: { $ne: ['$category', 'Profile'] },
                        then: {
                            $multiply: [
                                { $toDouble: { $ifNull: ['$totalStockQuantity', 0] } },
                                { $toDouble: { $ifNull: ['$unitRateForStockUnit', 0] } }
                            ]
                        },
                        else: 0
                    }
                },
                
                // Check if any stock level is low
                hasLowStock: {
                    $cond: {
                        if: { $eq: ['$category', 'Profile'] },
                        then: {
                            $cond: {
                                if: { 
                                    $and: [
                                        { $ne: ['$stockByLength', null] },
                                        { $isArray: '$stockByLength' },
                                        { $gt: [{ $size: '$stockByLength' }, 0] }
                                    ]
                                },
                                then: {
                                    $anyElementTrue: {
                                        $map: {
                                            input: '$stockByLength',
                                            as: 'stock',
                                            in: {
                                                $lt: [
                                                    { $toDouble: { $ifNull: ['$$stock.quantity', 0] } },
                                                    { $toDouble: { $ifNull: ['$$stock.lowStockThreshold', 0] } }
                                                ]
                                            }
                                        }
                                    }
                                },
                                else: false
                            }
                        },
                        else: {
                            $lt: [
                                { $toDouble: { $ifNull: ['$totalStockQuantity', 0] } },
                                { $toDouble: { $ifNull: ['$lowStockThresholdForStockUnit', 0] } }
                            ]
                        }
                    }
                },
                
                totalStockValue: {
                    $add: ['$profileStockValue', '$nonProfileStockValue']
                }
            }
        },
        
        // Filter for low stock if requested
        ...(lowStockOnly ? [{ $match: { hasLowStock: true } }] : []),
        
        {
            $facet: {
                // Overall summary
                summary: [
                    {
                        $group: {
                            _id: null,
                            totalMaterials: { $sum: 1 },
                            totalStockValue: { $sum: '$totalStockValue' },
                            lowStockItems: { $sum: { $cond: ['$hasLowStock', 1, 0] } },
                            
                            // Category breakdown
                            categoryBreakdown: {
                                $push: {
                                    category: '$category',
                                    value: '$totalStockValue',
                                    count: 1,
                                    lowStock: { $cond: ['$hasLowStock', 1, 0] }
                                }
                            }
                        }
                    },
                    {
                        $addFields: {
                            categoryTotals: {
                                $reduce: {
                                    input: '$categoryBreakdown',
                                    initialValue: {},
                                    in: {
                                        $mergeObjects: [
                                            '$$value',
                                            {
                                                $arrayToObject: [[{
                                                    k: '$$this.category',
                                                    v: {
                                                        count: { $add: [{ $ifNull: [{ $getField: { field: { $concat: ['$$this.category', '.count'] }, input: '$$value' } }, 0] }, '$$this.count'] },
                                                        value: { $add: [{ $ifNull: [{ $getField: { field: { $concat: ['$$this.category', '.value'] }, input: '$$value' } }, 0] }, '$$this.value'] },
                                                        lowStock: { $add: [{ $ifNull: [{ $getField: { field: { $concat: ['$$this.category', '.lowStock'] }, input: '$$value' } }, 0] }, '$$this.lowStock'] }
                                                    }
                                                }]]
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    }
                ],
                
                // Profile details with stock by length
                profileDetails: [
                    { $match: { category: 'Profile' } },
                    { $unwind: { path: '$stockByLength', preserveNullAndEmptyArrays: true } },
                    {
                        $group: {
                            _id: {
                                materialId: '$_id',
                                materialName: '$name',
                                length: { $ifNull: ['$stockByLength.length', 'N/A'] },
                                unit: { $ifNull: ['$stockByLength.unit', 'N/A'] }
                            },
                            quantity: { $first: { $ifNull: ['$stockByLength.quantity', 0] } },
                            unitRate: { $first: { $ifNull: ['$stockByLength.unitRate', 0] } },
                            lowStockThreshold: { $first: { $ifNull: ['$stockByLength.lowStockThreshold', 0] } },
                            stockValue: {
                                $first: {
                                    $cond: {
                                        if: { 
                                            $and: [
                                                { $ne: ['$stockByLength', null] },
                                                { $ne: ['$stockByLength.quantity', null] },
                                                { $ne: ['$stockByLength.unitRate', null] }
                                            ]
                                        },
                                        then: {
                                            $multiply: [
                                                { $toDouble: { $ifNull: ['$stockByLength.quantity', 0] } },
                                                { $toDouble: { $ifNull: ['$stockByLength.unitRate', 0] } }
                                            ]
                                        },
                                        else: 0
                                    }
                                }
                            },
                            isLowStock: {
                                $first: {
                                    $cond: {
                                        if: { 
                                            $and: [
                                                { $ne: ['$stockByLength', null] },
                                                { $ne: ['$stockByLength.quantity', null] },
                                                { $ne: ['$stockByLength.lowStockThreshold', null] }
                                            ]
                                        },
                                        then: {
                                            $lt: [
                                                { $toDouble: { $ifNull: ['$stockByLength.quantity', 0] } },
                                                { $toDouble: { $ifNull: ['$stockByLength.lowStockThreshold', 0] } }
                                            ]
                                        },
                                        else: false
                                    }
                                }
                            },
                            supplier: { $first: '$supplier' },
                            gauges: { $first: '$gaugeSpecificWeights.gauge' }
                        }
                    },
                    { $sort: { stockValue: -1 } }
                ],
                
                // Non-profile details
                nonProfileDetails: [
                    { $match: { category: { $ne: 'Profile' } } },
                    {
                        $project: {
                            name: 1,
                            category: 1,
                            totalStockQuantity: 1,
                            stockUnit: 1,
                            unitRateForStockUnit: 1,
                            lowStockThresholdForStockUnit: 1,
                            totalStockValue: 1,
                            hasLowStock: 1,
                            supplier: 1
                        }
                    },
                    { $sort: { totalStockValue: -1 } }
                ],
                
                // Low stock alerts
                lowStockAlerts: [
                    { $match: { hasLowStock: true } },
                    {
                        $project: {
                            name: 1,
                            category: 1,
                            stockByLength: 1,
                            totalStockQuantity: 1,
                            stockUnit: 1,
                            lowStockThresholdForStockUnit: 1,
                            supplier: 1
                        }
                    }
                ]
            }
        }
    ];

    console.log(`[getInventoryReport] Pipeline: ${JSON.stringify(pipeline, null, 2)}`);
    const result = await MaterialV2.aggregate(pipeline);
    const data = result[0];
    
    return {
        summary: data.summary[0] || {
            totalMaterials: 0,
            totalStockValue: 0,
            lowStockItems: 0,
            categoryTotals: {}
        },
        profileDetails: data.profileDetails || [],
        nonProfileDetails: data.nonProfileDetails || [],
        lowStockAlerts: data.lowStockAlerts || []
    };
};

/**
 * Get manufacturing reports (cutting optimization efficiency, scrap analysis)
 * 
 * FIXED: MongoDB aggregation error "$multiply accumulator is a unary operator"
 * - Fixed materialPerformance field mapping to match frontend expectations
 * - Fixed monthlyTrends field names (averageEfficiency, averageScrap)
 * - Fixed lengthUtilization aggregation with proper efficiency calculation
 * 
 * @param {string} companyId - Company ID for multi-tenancy
 * @param {Object} filters - Filters for date range, material, etc.
 * @returns {Object} Manufacturing report data
 */
const getManufacturingReport = async (companyId, filters = {}) => {
    const { startDate, endDate, materialId } = filters;
    
    // Build match conditions
    const matchConditions = { 
        companyId: new mongoose.Types.ObjectId(companyId)
    };
    
    if (startDate || endDate) {
        matchConditions.generatedAt = {};
        if (startDate) matchConditions.generatedAt.$gte = new Date(startDate);
        if (endDate) matchConditions.generatedAt.$lte = new Date(endDate);
    }

    const pipeline = [
        { $match: matchConditions },
        {
            $lookup: {
                from: 'orders',
                localField: 'orderId',
                foreignField: '_id',
                as: 'order'
            }
        },
        { $unwind: '$materialPlans' },
        
        // Filter by specific material if provided
        ...(materialId ? [{ 
            $match: { 
                'materialPlans.materialId': new mongoose.Types.ObjectId(materialId) 
            } 
        }] : []),
        
        { $unwind: '$materialPlans.pipesUsed' },
        {
            $addFields: {
                orderValue: { $toDouble: { $arrayElemAt: ['$order.finalGrandTotal', 0] } },
                standardLengthInUsageUnit: {
                    $cond: {
                        if: { $eq: ['$materialPlans.pipesUsed.standardLengthUnit', 'ft'] },
                        then: { $multiply: [{ $toDouble: { $ifNull: ['$materialPlans.pipesUsed.standardLength', 0] } }, { $literal: 12 }] }, // Convert ft to inches
                        else: { $toDouble: { $ifNull: ['$materialPlans.pipesUsed.standardLength', 0] } }
                    }
                },
                totalCutLength: { $toDouble: { $ifNull: ['$materialPlans.pipesUsed.totalCutLengthOnPipe', 0] } },
                scrapLength: { $toDouble: { $ifNull: ['$materialPlans.pipesUsed.scrapLength', 0] } },
                scrapPercentage: {
                    $cond: {
                        if: { $gt: [{ $toDouble: { $ifNull: ['$materialPlans.pipesUsed.standardLength', 0] } }, 0] },
                        then: {
                            $multiply: [
                                {
                                    $divide: [
                                        { $toDouble: { $ifNull: ['$materialPlans.pipesUsed.scrapLength', 0] } },
                                        {
                                            $cond: {
                                                if: { $eq: ['$materialPlans.pipesUsed.standardLengthUnit', 'ft'] },
                                                then: { $multiply: [{ $toDouble: { $ifNull: ['$materialPlans.pipesUsed.standardLength', 0] } }, { $literal: 12 }] },
                                                else: { $toDouble: { $ifNull: ['$materialPlans.pipesUsed.standardLength', 0] } }
                                            }
                                        }
                                    ]
                                },
                                { $literal: 100 }
                            ]
                        },
                        else: 0
                    }
                },
                month: { $dateToString: { format: '%Y-%m', date: '$generatedAt' } }
            }
        },
        {
            $facet: {
                // Overall efficiency summary
                summary: [
                    {
                        $group: {
                            _id: null,
                            totalPlans: { $sum: 1 },
                            totalPipesUsed: { $sum: 1 },
                            totalScrapLength: { $sum: '$scrapLength' },
                            totalMaterialLength: { $sum: '$standardLengthInUsageUnit' },
                            averageScrapPercentage: { $avg: '$scrapPercentage' },
                            totalOrderValue: { $sum: '$orderValue' },
                            
                            // Scrap efficiency categories
                            excellentEfficiency: { $sum: { $cond: [{ $lt: ['$scrapPercentage', 5] }, 1, 0] } },
                            goodEfficiency: { $sum: { $cond: [{ $and: [{ $gte: ['$scrapPercentage', 5] }, { $lt: ['$scrapPercentage', 10] }] }, 1, 0] } },
                            averageEfficiency: { $sum: { $cond: [{ $and: [{ $gte: ['$scrapPercentage', 10] }, { $lt: ['$scrapPercentage', 20] }] }, 1, 0] } },
                            poorEfficiency: { $sum: { $cond: [{ $gte: ['$scrapPercentage', 20] }, 1, 0] } }
                        }
                    },
                    {
                        $addFields: {
                            overallEfficiencyPercentage: {
                                $cond: {
                                    if: { $gt: ['$totalMaterialLength', 0] },
                                    then: {
                                        $multiply: [
                                            {
                                                $divide: [
                                                    { $subtract: ['$totalMaterialLength', '$totalScrapLength'] },
                                                    '$totalMaterialLength'
                                                ]
                                            },
                                            { $literal: 100 }
                                        ]
                                    },
                                    else: 0
                                }
                            }
                        }
                    }
                ],
                
                // Monthly trends
                monthlyTrends: [
                    {
                        $group: {
                            _id: '$month',
                            planCount: { $sum: 1 },
                            pipesUsed: { $sum: 1 },
                            averageScrap: { $avg: '$scrapPercentage' },
                            totalScrap: { $sum: '$scrapLength' },
                            totalMaterial: { $sum: '$standardLengthInUsageUnit' }
                        }
                    },
                    {
                        $addFields: {
                            month: '$_id',
                            averageEfficiency: {
                                $cond: {
                                    if: { $gt: ['$totalMaterial', 0] },
                                    then: {
                                        $multiply: [
                                            {
                                                $divide: [
                                                    { $subtract: ['$totalMaterial', '$totalScrap'] },
                                                    '$totalMaterial'
                                                ]
                                            },
                                            { $literal: 100 }
                                        ]
                                    },
                                    else: 0
                                }
                            }
                        }
                    },
                    { $sort: { _id: 1 } }
                ],
                
                // MaterialV2-wise performance
                materialPerformance: [
                    {
                        $group: {
                            _id: {
                                materialId: '$materialPlans.materialId',
                                materialName: '$materialPlans.materialNameSnapshot',
                                gauge: '$materialPlans.gaugeSnapshot'
                            },
                            totalPlans: { $sum: 1 },
                            totalPipesUsed: { $sum: 1 },
                            averageScrapPercentage: { $avg: '$scrapPercentage' },
                            totalScrapLength: { $sum: '$scrapLength' },
                            totalMaterialLength: { $sum: '$standardLengthInUsageUnit' }
                        }
                    },
                    {
                        $addFields: {
                            _id: '$_id.materialId',
                            materialName: '$_id.materialName',
                            gauge: '$_id.gauge',
                            averageEfficiencyPercentage: {
                                $cond: {
                                    if: { $gt: ['$totalMaterialLength', 0] },
                                    then: {
                                        $multiply: [
                                            {
                                                $divide: [
                                                    { $subtract: ['$totalMaterialLength', '$totalScrapLength'] },
                                                    '$totalMaterialLength'
                                                ]
                                            },
                                            { $literal: 100 }
                                        ]
                                    },
                                    else: 0
                                }
                            },
                            scrapUnit: 'in' // Since we're converting to inches
                        }
                    },
                    { $sort: { averageEfficiencyPercentage: -1 } }
                ],
                
                // Standard length utilization
                lengthUtilization: [
                    {
                        $group: {
                            _id: {
                                standardLength: '$materialPlans.pipesUsed.standardLength',
                                unit: '$materialPlans.pipesUsed.standardLengthUnit'
                            },
                            totalUsed: { $sum: 1 },
                            totalScrap: { $sum: '$scrapLength' },
                            totalMaterial: { $sum: '$standardLengthInUsageUnit' },
                            averageScrapPercentage: { $avg: '$scrapPercentage' }
                        }
                    },
                    {
                        $addFields: {
                            efficiencyPercentage: {
                                $cond: {
                                    if: { $gt: ['$totalMaterial', 0] },
                                    then: {
                                        $multiply: [
                                            {
                                                $divide: [
                                                    { $subtract: ['$totalMaterial', '$totalScrap'] },
                                                    '$totalMaterial'
                                                ]
                                            },
                                            { $literal: 100 }
                                        ]
                                    },
                                    else: 0
                                }
                            },
                            standardLength: '$_id.standardLength',
                            unit: '$_id.unit'
                        }
                    },
                    { $sort: { efficiencyPercentage: -1 } }
                ]
            }
        }
    ];

    console.log(`[getManufacturingReport] Pipeline: ${JSON.stringify(pipeline, null, 2)}`);
    const result = await CuttingPlan.aggregate(pipeline);
    const data = result[0];
    
    return {
        summary: data.summary[0] || {
            totalPlans: 0,
            totalPipesUsed: 0,
            totalScrapLength: 0,
            totalMaterialLength: 0,
            averageScrapPercentage: 0,
            overallEfficiencyPercentage: 0,
            excellentEfficiency: 0,
            goodEfficiency: 0,
            averageEfficiency: 0,
            poorEfficiency: 0
        },
        monthlyTrends: data.monthlyTrends || [],
        materialPerformance: data.materialPerformance || [],
        lengthUtilization: data.lengthUtilization || []
    };
};

module.exports = {
    getClientReport,
    getQuotationReport,
    getSalesOrderReport,
    getInventoryReport,
    getManufacturingReport
}; 