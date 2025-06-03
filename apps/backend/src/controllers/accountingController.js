const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const MaterialV2 = require('../models/MaterialV2');
const StockTransaction = require('../models/StockTransaction');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/appError');

/**
 * Get sales ledger data (invoices and payments summary)
 */
exports.getSalesLedger = catchAsync(async (req, res, next) => {
    const { companyId } = req.user;
    const { 
        startDate, 
        endDate, 
        clientId, 
        page = 1, 
        limit = 50,
        sortBy = 'invoiceDate',
        sortOrder = 'desc'
    } = req.query;

    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
        dateFilter.invoiceDate = {};
        if (startDate) dateFilter.invoiceDate.$gte = new Date(startDate);
        if (endDate) dateFilter.invoiceDate.$lte = new Date(endDate);
    }

    // Build main filter
    const filter = { 
        companyId,
        ...dateFilter
    };
    if (clientId) filter.clientId = clientId;

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get invoices with payment details
    const invoices = await Invoice.find(filter)
        .populate('clientId', 'clientName contactPerson email')
        .populate('orderId', 'orderIdDisplay')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Invoice.countDocuments(filter);

    // Calculate summary statistics
    const summaryPipeline = [
        { $match: { companyId: new mongoose.Types.ObjectId(companyId), ...dateFilter } },
        {
            $group: {
                _id: null,
                totalInvoices: { $sum: 1 },
                totalInvoiceAmount: { $sum: { $toDouble: '$grandTotal' } },
                totalAmountPaid: { $sum: { $toDouble: '$amountPaid' } },
                totalBalanceDue: { $sum: { $toDouble: '$balanceDue' } },
                draftInvoices: {
                    $sum: { $cond: [{ $eq: ['$status', 'Draft'] }, 1, 0] }
                },
                sentInvoices: {
                    $sum: { $cond: [{ $eq: ['$status', 'Sent'] }, 1, 0] }
                },
                paidInvoices: {
                    $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, 1, 0] }
                },
                partiallyPaidInvoices: {
                    $sum: { $cond: [{ $eq: ['$status', 'Partially Paid'] }, 1, 0] }
                },
                overdueInvoices: {
                    $sum: { $cond: [{ $eq: ['$status', 'Overdue'] }, 1, 0] }
                }
            }
        }
    ];

    const summaryResult = await Invoice.aggregate(summaryPipeline);
    const summary = summaryResult[0] || {
        totalInvoices: 0,
        totalInvoiceAmount: 0,
        totalAmountPaid: 0,
        totalBalanceDue: 0,
        draftInvoices: 0,
        sentInvoices: 0,
        paidInvoices: 0,
        partiallyPaidInvoices: 0,
        overdueInvoices: 0
    };

    // Get recent payments
    const recentPaymentsFilter = { companyId };
    if (startDate || endDate) {
        recentPaymentsFilter.updatedAt = {};
        if (startDate) recentPaymentsFilter.updatedAt.$gte = new Date(startDate);
        if (endDate) recentPaymentsFilter.updatedAt.$lte = new Date(endDate);
    }

    const recentPayments = await Invoice.find(recentPaymentsFilter)
        .populate('clientId', 'clientName contactPerson')
        .sort({ 'payments.recordedAt': -1 })
        .limit(20)
        .select('invoiceIdDisplay clientId payments grandTotal');

    // Flatten payments with invoice context
    const flattenedPayments = [];
    recentPayments.forEach(invoice => {
        invoice.payments.forEach(payment => {
            flattenedPayments.push({
                invoiceId: invoice._id,
                invoiceIdDisplay: invoice.invoiceIdDisplay,
                client: invoice.clientId,
                payment: payment
            });
        });
    });

    // Sort and limit flattened payments
    flattenedPayments.sort((a, b) => new Date(b.payment.recordedAt) - new Date(a.payment.recordedAt));
    const limitedPayments = flattenedPayments.slice(0, 20);

    res.status(200).json({
        status: 'success',
        data: {
            invoices,
            summary,
            recentPayments: limitedPayments,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalResults: total,
                resultsPerPage: parseInt(limit)
            }
        }
    });
});

/**
 * Get simplified P&L data
 */
exports.getPnLSimple = catchAsync(async (req, res, next) => {
    const { companyId } = req.user;
    const { startDate, endDate, period = 'monthly' } = req.query;

    // Default to current year if no dates provided
    let start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    let end = endDate ? new Date(endDate) : new Date();

    // Revenue calculation from invoices
    const revenueQuery = [
        {
            $match: {
                companyId: new mongoose.Types.ObjectId(companyId),
                invoiceDate: { $gte: start, $lte: end },
                status: { $nin: ['Draft', 'Void'] } // Only count sent/paid invoices
            }
        },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: { $toDouble: '$grandTotal' } },
                totalCollected: { $sum: { $toDouble: '$amountPaid' } },
                totalPending: { $sum: { $toDouble: '$balanceDue' } },
                invoiceCount: { $sum: 1 }
            }
        }
    ];

    const revenueResult = await Invoice.aggregate(revenueQuery);
    const revenue = revenueResult[0] || {
        totalRevenue: 0,
        totalCollected: 0,
        totalPending: 0,
        invoiceCount: 0
    };

    // Cost calculation (simplified - based on order material costs)
    // This is a simplified approach. In practice, you might want to track actual costs more precisely
    const costQuery = [
        {
            $match: {
                companyId: new mongoose.Types.ObjectId(companyId),
                createdAt: { $gte: start, $lte: end },
                status: { $in: ['Delivered', 'Completed'] } // Only completed orders
            }
        },
        {
            $unwind: '$aggregatedOrderMaterials'
        },
        {
            $group: {
                _id: null,
                // This is a simplified cost calculation
                // In practice, you'd want to track actual material costs used
                estimatedMaterialCost: { 
                    $sum: { 
                        $multiply: [
                            { $toDouble: '$aggregatedOrderMaterials.totalQuantity' },
                            { $literal: 10 } // Placeholder rate - should be actual material cost
                        ]
                    }
                },
                orderCount: { $addToSet: '$_id' }
            }
        },
        {
            $project: {
                estimatedMaterialCost: 1,
                orderCount: { $size: '$orderCount' }
            }
        }
    ];

    const costResult = await Order.aggregate(costQuery);
    const costs = costResult[0] || {
        estimatedMaterialCost: 0,
        orderCount: 0
    };

    // Calculate basic P&L
    const grossProfit = revenue.totalRevenue - costs.estimatedMaterialCost;
    const grossProfitMargin = revenue.totalRevenue > 0 ? (grossProfit / revenue.totalRevenue) * 100 : 0;

    // Period-wise breakdown
    let groupByPeriod;
    switch (period) {
        case 'daily':
            groupByPeriod = {
                year: { $year: '$invoiceDate' },
                month: { $month: '$invoiceDate' },
                day: { $dayOfMonth: '$invoiceDate' }
            };
            break;
        case 'weekly':
            groupByPeriod = {
                year: { $year: '$invoiceDate' },
                week: { $week: '$invoiceDate' }
            };
            break;
        case 'quarterly':
            groupByPeriod = {
                year: { $year: '$invoiceDate' },
                quarter: { 
                    $ceil: { 
                        $divide: [{ $month: '$invoiceDate' }, { $literal: 3 }] 
                    } 
                }
            };
            break;
        case 'yearly':
            groupByPeriod = {
                year: { $year: '$invoiceDate' }
            };
            break;
        default: // monthly
            groupByPeriod = {
                year: { $year: '$invoiceDate' },
                month: { $month: '$invoiceDate' }
            };
    }

    const periodWiseRevenueQuery = [
        {
            $match: {
                companyId: new mongoose.Types.ObjectId(companyId),
                invoiceDate: { $gte: start, $lte: end },
                status: { $nin: ['Draft', 'Void'] }
            }
        },
        {
            $group: {
                _id: groupByPeriod,
                revenue: { $sum: { $toDouble: '$grandTotal' } },
                collected: { $sum: { $toDouble: '$amountPaid' } },
                invoiceCount: { $sum: 1 }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1, '_id.quarter': 1 } }
    ];

    const periodWiseRevenue = await Invoice.aggregate(periodWiseRevenueQuery);

    res.status(200).json({
        status: 'success',
        data: {
            summary: {
                period: `${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`,
                totalRevenue: revenue.totalRevenue,
                totalCollected: revenue.totalCollected,
                totalPending: revenue.totalPending,
                estimatedCosts: costs.estimatedMaterialCost,
                grossProfit: grossProfit,
                grossProfitMargin: Math.round(grossProfitMargin * 100) / 100,
                invoiceCount: revenue.invoiceCount,
                orderCount: costs.orderCount
            },
            periodWiseBreakdown: periodWiseRevenue.map(item => ({
                period: item._id,
                revenue: item.revenue,
                collected: item.collected,
                invoiceCount: item.invoiceCount
            })),
            notes: [
                'Cost calculation is simplified and uses estimated material costs.',
                'For accurate P&L, implement detailed cost tracking for materials, labor, and overhead.',
                'Revenue includes all invoices except drafts and void invoices.'
            ]
        }
    });
});

/**
 * Get payment summary for a specific period
 */
exports.getPaymentSummary = catchAsync(async (req, res, next) => {
    const { companyId } = req.user;
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate || endDate) {
        dateFilter['payments.paymentDate'] = {};
        if (startDate) dateFilter['payments.paymentDate'].$gte = new Date(startDate);
        if (endDate) dateFilter['payments.paymentDate'].$lte = new Date(endDate);
    }

    const paymentSummaryQuery = [
        {
            $match: {
                companyId: new mongoose.Types.ObjectId(companyId),
                'payments.0': { $exists: true } // Has at least one payment
            }
        },
        { $unwind: '$payments' },
        {
            $match: dateFilter
        },
        {
            $group: {
                _id: {
                    method: '$payments.method',
                    year: { $year: '$payments.paymentDate' },
                    month: { $month: '$payments.paymentDate' }
                },
                totalAmount: { $sum: { $toDouble: '$payments.amount' } },
                paymentCount: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: '$_id.method',
                totalAmount: { $sum: '$totalAmount' },
                paymentCount: { $sum: '$paymentCount' },
                monthlyBreakdown: {
                    $push: {
                        year: '$_id.year',
                        month: '$_id.month',
                        amount: '$totalAmount',
                        count: '$paymentCount'
                    }
                }
            }
        },
        { $sort: { totalAmount: -1 } }
    ];

    const paymentSummary = await Invoice.aggregate(paymentSummaryQuery);

    res.status(200).json({
        status: 'success',
        data: {
            paymentSummary
        }
    });
}); 