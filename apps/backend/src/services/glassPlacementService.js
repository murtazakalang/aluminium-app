const EstimationService = require('./estimationService');
const GlassFormulaService = require('./glassFormulaService');

/**
 * Service for generating glass placement sheets and optimization reports
 */
class GlassPlacementService {
    /**
     * Generate a glass placement sheet for an estimation
     * @param {string} estimationId - ID of the estimation
     * @param {string} companyId - Company ID for multi-tenancy
     * @returns {Object} Glass placement sheet with cutting details
     */
    static async generatePlacementSheet(estimationId, companyId) {
        try {
            const Estimation = require('../models/Estimation');
            const ProductType = require('../models/ProductType');

            const estimation = await Estimation.findOne({ 
                _id: estimationId, 
                companyId: companyId 
            });

            if (!estimation) {
                throw new Error('Estimation not found');
            }

            const placementSheet = {
                estimationId: estimationId,
                estimationName: estimation.name,
                clientName: estimation.clientName,
                totalGlassArea: 0,
                glassTypes: {},
                cuttingList: [],
                optimizationSummary: {
                    totalPieces: 0,
                    uniqueSizes: 0,
                    materialTypes: 0
                }
            };

            // Process each estimation item
            for (const item of estimation.items) {
                const productType = await ProductType.findOne({ 
                    _id: item.productTypeId, 
                    companyId: companyId 
                });

                if (!productType) {
                    console.warn(`Product Type not found for ID: ${item.productTypeId}`);
                    continue;
                }

                // Calculate glass for this item
                const glassCalculation = await EstimationService.calculateGlassForItem(
                    item, 
                    productType, 
                    estimation.dimensionUnitUsed, 
                    companyId
                );

                if (!glassCalculation.hasGlass || glassCalculation.error) {
                    continue;
                }

                const glassMaterialId = glassCalculation.glassMaterial._id.toString();
                const glassTypeName = glassCalculation.glassMaterial.name;

                // Initialize glass type if not exists
                if (!placementSheet.glassTypes[glassMaterialId]) {
                    placementSheet.glassTypes[glassMaterialId] = {
                        materialId: glassMaterialId,
                        materialName: glassTypeName,
                        totalArea: 0,
                        totalPieces: 0,
                        unit: glassCalculation.glassUnit,
                        rate: glassCalculation.glassRate,
                        totalCost: 0,
                        items: []
                    };
                    placementSheet.optimizationSummary.materialTypes++;
                }

                // Create cutting list entry
                const cuttingEntry = {
                    itemId: item._id,
                    productTypeName: productType.name,
                    itemDescription: `${item.width}" x ${item.height}" - ${productType.name}`,
                    quantity: item.quantity,
                    glassMaterialId: glassMaterialId,
                    glassMaterialName: glassTypeName,
                    area: glassCalculation.glassQuantityPerItem,
                    totalArea: glassCalculation.totalGlassQuantity,
                    unit: glassCalculation.glassUnit
                };

                // Add cutting details if available (from separate formula approach)
                if (glassCalculation.glassDetails) {
                    const details = glassCalculation.glassDetails;
                    cuttingEntry.cuttingDetails = {
                        piecesPerItem: details.piecesPerItem,
                        totalPieces: details.piecesPerItem * item.quantity,
                        glassCutSize: details.glassCutSize,
                        adjustedWidth: details.adjustedWidth,
                        adjustedHeight: details.adjustedHeight,
                        roundedWidth: details.roundedWidth,
                        roundedHeight: details.roundedHeight,
                        areaPerPiece: details.areaPerPiece
                    };
                    placementSheet.optimizationSummary.totalPieces += details.piecesPerItem * item.quantity;
                } else {
                    // For legacy formulas, estimate 1 piece per item
                    cuttingEntry.cuttingDetails = {
                        piecesPerItem: 1,
                        totalPieces: item.quantity,
                        estimatedCutSize: `${item.width}" x ${item.height}" (estimated)`,
                        note: "Exact glass cutting dimensions require separate width/height formulas"
                    };
                    placementSheet.optimizationSummary.totalPieces += item.quantity;
                }

                placementSheet.cuttingList.push(cuttingEntry);

                // Update glass type totals
                const glassType = placementSheet.glassTypes[glassMaterialId];
                glassType.totalArea += glassCalculation.totalGlassQuantity;
                glassType.totalPieces += cuttingEntry.cuttingDetails.totalPieces;
                glassType.totalCost += glassCalculation.totalGlassCost;
                glassType.items.push({
                    itemId: item._id,
                    productType: productType.name,
                    dimensions: `${item.width}" x ${item.height}"`,
                    quantity: item.quantity,
                    area: glassCalculation.glassQuantityPerItem,
                    pieces: cuttingEntry.cuttingDetails.piecesPerItem,
                    cutSize: cuttingEntry.cuttingDetails.glassCutSize || cuttingEntry.cuttingDetails.estimatedCutSize
                });

                placementSheet.totalGlassArea += glassCalculation.totalGlassQuantity;
            }

            // Count unique glass sizes for optimization
            const uniqueSizes = new Set();
            placementSheet.cuttingList.forEach(entry => {
                if (entry.cuttingDetails.glassCutSize) {
                    uniqueSizes.add(entry.cuttingDetails.glassCutSize);
                }
            });
            placementSheet.optimizationSummary.uniqueSizes = uniqueSizes.size;

            return placementSheet;

        } catch (error) {
            throw new Error(`Glass placement sheet generation error: ${error.message}`);
        }
    }

    /**
     * Generate glass cutting optimization report
     * @param {Object} placementSheet - Glass placement sheet
     * @returns {Object} Optimization recommendations
     */
    static generateOptimizationReport(placementSheet) {
        const report = {
            summary: placementSheet.optimizationSummary,
            recommendations: [],
            costBreakdown: {},
            standardSizeSuggestions: []
        };

        // Analyze glass type efficiency
        Object.values(placementSheet.glassTypes).forEach(glassType => {
            report.costBreakdown[glassType.materialName] = {
                totalArea: glassType.totalArea,
                totalPieces: glassType.totalPieces,
                averageAreaPerPiece: (glassType.totalArea / glassType.totalPieces).toFixed(2),
                totalCost: glassType.totalCost,
                costPerSquareFoot: (glassType.totalCost / glassType.totalArea).toFixed(2)
            };
        });

        // Generate size optimization recommendations
        const sizeFrequency = {};
        placementSheet.cuttingList.forEach(entry => {
            if (entry.cuttingDetails.glassCutSize) {
                const size = entry.cuttingDetails.glassCutSize;
                sizeFrequency[size] = (sizeFrequency[size] || 0) + entry.cuttingDetails.totalPieces;
            }
        });

        // Find most common sizes
        const sortedSizes = Object.entries(sizeFrequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);

        sortedSizes.forEach(([size, count]) => {
            if (count > 1) {
                report.standardSizeSuggestions.push({
                    size: size,
                    quantity: count,
                    recommendation: `Consider ordering ${count} pieces of ${size} - most common size`
                });
            }
        });

        // Add recommendations
        if (report.summary.uniqueSizes > 10) {
            report.recommendations.push({
                type: 'size_optimization',
                message: `You have ${report.summary.uniqueSizes} unique glass sizes. Consider standardizing to reduce cutting complexity.`
            });
        }

        if (report.summary.materialTypes > 3) {
            report.recommendations.push({
                type: 'material_optimization', 
                message: `You have ${report.summary.materialTypes} different glass types. Consider consolidating to reduce inventory complexity.`
            });
        }

        report.recommendations.push({
            type: 'ordering_tip',
            message: `Total of ${report.summary.totalPieces} glass pieces needed. Use the cutting list for precise glass supplier orders.`
        });

        return report;
    }

    /**
     * Export glass placement sheet in CSV format for suppliers
     * @param {Object} placementSheet - Glass placement sheet
     * @returns {string} CSV formatted string
     */
    static exportToCSV(placementSheet) {
        const headers = [
            'Glass Type',
            'Cut Size',
            'Quantity', 
            'Area per Piece',
            'Total Area',
            'Product Type',
            'Item Dimensions',
            'Notes'
        ];

        let csv = headers.join(',') + '\n';

        placementSheet.cuttingList.forEach(entry => {
            const row = [
                `"${entry.glassMaterialName}"`,
                `"${entry.cuttingDetails.glassCutSize || entry.cuttingDetails.estimatedCutSize || 'N/A'}"`,
                entry.cuttingDetails.totalPieces,
                entry.cuttingDetails.areaPerPiece || (entry.area / entry.cuttingDetails.piecesPerItem).toFixed(2),
                entry.totalArea.toFixed(2),
                `"${entry.productTypeName}"`,
                `"${entry.itemDescription}"`,
                `"${entry.cuttingDetails.note || 'Standard cut'}"`
            ];
            csv += row.join(',') + '\n';
        });

        return csv;
    }
}

module.exports = GlassPlacementService; 