const reportService = require('../services/reportService');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/appError');

/**
 * Report Controller - Handles all reporting endpoints
 */

/**
 * Get client analytics report
 * @route GET /api/reports/clients
 * @access Private (Admin, Manager, Staff)
 */
const getClientReport = catchAsync(async (req, res, next) => {
    const { companyId } = req.user;
    const filters = req.query;

    const reportData = await reportService.getClientReport(companyId, filters);

    res.status(200).json({
        success: true,
        data: reportData
    });
});

/**
 * Get quotation analytics report
 * @route GET /api/reports/quotations
 * @access Private (Admin, Manager, Staff)
 */
const getQuotationReport = catchAsync(async (req, res, next) => {
    const { companyId } = req.user;
    const filters = req.query;

    const reportData = await reportService.getQuotationReport(companyId, filters);

    res.status(200).json({
        success: true,
        data: reportData
    });
});

/**
 * Get sales order analytics report
 * @route GET /api/reports/sales-orders
 * @access Private (Admin, Manager, Staff)
 */
const getSalesOrderReport = catchAsync(async (req, res, next) => {
    const { companyId } = req.user;
    const filters = req.query;

    const reportData = await reportService.getSalesOrderReport(companyId, filters);

    res.status(200).json({
        success: true,
        data: reportData
    });
});

/**
 * Get inventory analytics report
 * @route GET /api/reports/inventory
 * @access Private (Admin, Manager, Staff)
 */
const getInventoryReport = catchAsync(async (req, res, next) => {
    const { companyId } = req.user;
    const filters = req.query;

    const reportData = await reportService.getInventoryReport(companyId, filters);

    res.status(200).json({
        success: true,
        data: reportData
    });
});

/**
 * Get manufacturing analytics report
 * @route GET /api/reports/manufacturing
 * @access Private (Admin, Manager, Staff)
 */
const getManufacturingReport = catchAsync(async (req, res, next) => {
    const { companyId } = req.user;
    const filters = req.query;

    const reportData = await reportService.getManufacturingReport(companyId, filters);

    res.status(200).json({
        success: true,
        data: reportData
    });
});

/**
 * Get overview dashboard data (combines key metrics from all reports)
 * @route GET /api/reports/dashboard
 * @access Private (Admin, Manager, Staff)
 */
const getDashboardOverview = catchAsync(async (req, res, next) => {
    const { companyId } = req.user;
    const filters = req.query;

    console.log("[DEBUG] Running report dashboard aggregation...");

    // Get summary data from all reports
    const [
        clientReport,
        quotationReport,
        salesOrderReport,
        inventoryReport,
        manufacturingReport
    ] = await Promise.all([
        reportService.getClientReport(companyId, filters),
        reportService.getQuotationReport(companyId, filters),
        reportService.getSalesOrderReport(companyId, filters),
        reportService.getInventoryReport(companyId, filters),
        reportService.getManufacturingReport(companyId, filters)
    ]);

    // Combine key metrics for dashboard overview
    const dashboardData = {
        clients: {
            total: clientReport.totalClients,
            conversionRate: clientReport.overallConversionRate,
            topClients: clientReport.topClients?.slice(0, 5) || []
        },
        quotations: {
            total: quotationReport.summary?.totalQuotations || 0,
            totalValue: quotationReport.summary?.totalValue || 0,
            conversionRate: quotationReport.summary?.conversionRate || 0,
            recentTrend: quotationReport.monthlyTrends?.slice(-3) || []
        },
        orders: {
            total: salesOrderReport.summary?.totalOrders || 0,
            totalValue: salesOrderReport.summary?.totalValue || 0,
            completionRate: salesOrderReport.summary?.completionRate || 0,
            inProduction: salesOrderReport.summary?.inProductionOrders || 0
        },
        inventory: {
            totalItems: inventoryReport.summary?.totalMaterials || 0,
            totalValue: inventoryReport.summary?.totalStockValue || 0,
            lowStockItems: inventoryReport.summary?.lowStockItems || 0,
            categoryBreakdown: inventoryReport.summary?.categoryTotals || {}
        },
        manufacturing: {
            totalPlans: manufacturingReport.summary?.totalPlans || 0,
            averageEfficiency: manufacturingReport.summary?.overallEfficiencyPercentage || 0,
            averageScrap: manufacturingReport.summary?.averageScrapPercentage || 0,
            topMaterials: manufacturingReport.materialPerformance?.slice(0, 5) || []
        }
    };

    res.status(200).json({
        success: true,
        data: dashboardData
    });
});

module.exports = {
    getClientReport,
    getQuotationReport,
    getSalesOrderReport,
    getInventoryReport,
    getManufacturingReport,
    getDashboardOverview
}; 