const mongoose = require('mongoose');
const Decimal = require('decimal.js');
const MaterialV2 = require('../models/MaterialV2');
const { convertUnit } = require('../utils/unitConverter');

/**
 * Wire Mesh Width Optimization Service
 * Handles width-based optimization for Wire Mesh materials similar to Profile cutting optimization
 */
class WireMeshOptimizationService {

    /**
     * Find optimal standard width for required width
     * @param {Array} standardWidths - Array of {length: Decimal, unit: string} (stored as standardLengths)
     * @param {number} requiredWidth - Required width in same unit as standardWidths
     * @param {string} unit - Unit of measurement
     * @returns {object} - Optimal width selection result
     */
    static findOptimalWidth(standardWidths, requiredWidth, unit) {
        if (!standardWidths || standardWidths.length === 0) {
            throw new Error('No standard widths available for Wire Mesh material');
        }

        // Convert all widths to same unit for comparison
        const normalizedWidths = standardWidths.map(sw => ({
            width: parseFloat(sw.length.toString()), // standardWidths stored as standardLengths
            unit: sw.unit,
            originalIndex: standardWidths.indexOf(sw)
        })).filter(w => w.unit === unit); // Only use widths in the same unit

        if (normalizedWidths.length === 0) {
            throw new Error(`No standard widths available in unit: ${unit}`);
        }

        // Find smallest width that can accommodate requirement
        const suitableWidths = normalizedWidths.filter(w => w.width >= requiredWidth);
        
        if (suitableWidths.length === 0) {
            // If no standard width can accommodate, find the largest available
            const largestWidth = normalizedWidths.reduce((max, current) => 
                current.width > max.width ? current : max
            );
            
            throw new Error(
                `Required width ${requiredWidth}${unit} exceeds largest available standard width ${largestWidth.width}${unit}`
            );
        }

        // Select the smallest suitable width to minimize wastage
        const optimalWidth = suitableWidths.reduce((min, current) => 
            current.width < min.width ? current : min
        );

        return {
            selectedWidth: optimalWidth.width,
            unit: optimalWidth.unit,
            originalIndex: optimalWidth.originalIndex
        };
    }

    /**
     * Calculate Wire Mesh consumption with width optimization
     * @param {object} materialDoc - MaterialV2 document for Wire Mesh
     * @param {number} requiredWidth - Required width
     * @param {number} requiredLength - Required length  
     * @param {string} dimensionUnit - Unit of required dimensions
     * @returns {object} - Consumption calculation result
     */
    static async calculateWireMeshConsumption(materialDoc, requiredWidth, requiredLength, dimensionUnit) {
        if (materialDoc.category !== 'Wire Mesh') {
            throw new Error('Material is not Wire Mesh category');
        }

        // Get standard widths (stored as standardLengths in database)
        const standardWidths = materialDoc.standardLengths || [];
        
        if (standardWidths.length === 0) {
            // Fallback to simple area calculation without optimization
            const requiredArea = requiredWidth * requiredLength;
            return {
                optimizationType: 'simple_area',
                requiredArea,
                selectedWidth: requiredWidth,
                requiredLength: requiredLength,
                actualArea: requiredArea,
                wastageArea: 0,
                wastagePercentage: 0,
                efficiency: 100,
                unit: dimensionUnit,
                areaUnit: dimensionUnit === 'ft' ? 'sqft' : 'sqm'
            };
        }

        // Try both orientations to find the best fit
        let optimalSelection = null;
        let bestOrientation = null;
        let orientationUsed = 'original'; // Track which orientation was used
        
        // Try original orientation (requiredWidth as width)
        try {
            optimalSelection = this.findOptimalWidth(standardWidths, requiredWidth, dimensionUnit);
            bestOrientation = {
                selectedWidth: optimalSelection.selectedWidth,
                actualLength: requiredLength,
                requiredWidth: requiredWidth,
                requiredLength: requiredLength
            };
            orientationUsed = 'original';
        } catch (originalError) {
            console.log(`[WireMesh] Original orientation failed: ${originalError.message}`);
            
            // Try swapped orientation (requiredLength as width)
            try {
                optimalSelection = this.findOptimalWidth(standardWidths, requiredLength, dimensionUnit);
                bestOrientation = {
                    selectedWidth: optimalSelection.selectedWidth,
                    actualLength: requiredWidth,
                    requiredWidth: requiredLength, // Now length becomes width
                    requiredLength: requiredWidth  // Now width becomes length
                };
                orientationUsed = 'swapped';
                console.log(`[WireMesh] Using swapped orientation: ${requiredLength}${dimensionUnit} (length) fits as width, ${requiredWidth}${dimensionUnit} (width) becomes length`);
            } catch (swappedError) {
                // Both orientations failed
                throw new Error(
                    `Wire Mesh optimization failed: Neither orientation works. ` +
                    `Original: ${originalError.message}. ` +
                    `Swapped: ${swappedError.message}`
                );
            }
        }
        
        // Calculate areas using the best orientation
        const requiredArea = requiredWidth * requiredLength; // Original required area
        const actualArea = bestOrientation.selectedWidth * bestOrientation.actualLength; // Actual consumed area
        const wastageArea = actualArea - requiredArea;
        const wastagePercentage = (wastageArea / actualArea) * 100;
        const efficiency = (requiredArea / actualArea) * 100;

        // Determine area unit
        const areaUnit = dimensionUnit === 'ft' ? 'sqft' : 
                        dimensionUnit === 'm' ? 'sqm' :
                        dimensionUnit === 'mm' ? 'sqmm' : 'sqft';

        return {
            optimizationType: 'width_optimized',
            requiredWidth: requiredWidth, // Keep original required dimensions for reference
            requiredLength: requiredLength,
            requiredArea,
            selectedWidth: bestOrientation.selectedWidth, // Width of the standard material used
            actualLength: bestOrientation.actualLength,   // Length cut from the standard material
            actualArea,
            wastageArea,
            wastagePercentage: parseFloat(wastagePercentage.toFixed(2)),
            efficiency: parseFloat(efficiency.toFixed(2)),
            unit: dimensionUnit,
            areaUnit,
            orientationUsed, // Track which orientation was used
            dimensionMapping: {
                // Help understand how original dimensions map to material dimensions
                materialWidth: bestOrientation.selectedWidth,
                materialLength: bestOrientation.actualLength,
                originalRequiredWidth: requiredWidth,
                originalRequiredLength: requiredLength
            },
            standardWidthUsed: {
                width: bestOrientation.selectedWidth,
                unit: dimensionUnit,
                index: optimalSelection.originalIndex
            }
        };
    }

    /**
     * Process Wire Mesh formula results with width optimization
     * @param {object} materialDoc - MaterialV2 document 
     * @param {object} formulaResult - Result from formula evaluation {width: number, length: number}
     * @param {string} dimensionUnit - Unit of formula inputs
     * @returns {object} - Optimized consumption result
     */
    static async processWireMeshFormula(materialDoc, formulaResult, dimensionUnit) {
        // Expect formulaResult to have both width and length for Wire Mesh
        if (!formulaResult.width || !formulaResult.length) {
            throw new Error('Wire Mesh formula must provide both width and length requirements');
        }

        const optimizationResult = await this.calculateWireMeshConsumption(
            materialDoc,
            formulaResult.width,
            formulaResult.length,
            dimensionUnit
        );

        // Convert to usage unit if needed
        const finalAreaUnit = materialDoc.usageUnit;
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
                throw new Error(`Unit conversion error: ${areaConversion.error || wastageConversion.error}`);
            }

            finalArea = areaConversion.result;
            finalWastage = wastageConversion.result;
        }

        return {
            ...optimizationResult,
            finalQuantity: finalArea,
            finalWastage,
            finalUnit: finalAreaUnit,
            conversionApplied: optimizationResult.areaUnit !== finalAreaUnit
        };
    }

    /**
     * Get Wire Mesh material efficiency report
     * @param {string} materialId - Material ID
     * @param {Array} usageHistory - Array of usage records
     * @returns {object} - Efficiency analysis
     */
    static analyzeWireMeshEfficiency(materialId, usageHistory) {
        if (!usageHistory || usageHistory.length === 0) {
            return {
                materialId,
                totalUsages: 0,
                averageEfficiency: 0,
                totalWastage: 0,
                recommendations: ['No usage data available']
            };
        }

        const totalUsages = usageHistory.length;
        const efficiencies = usageHistory.map(usage => usage.efficiency || 0);
        const wastages = usageHistory.map(usage => usage.wastagePercentage || 0);
        
        const averageEfficiency = efficiencies.reduce((sum, eff) => sum + eff, 0) / totalUsages;
        const averageWastage = wastages.reduce((sum, waste) => sum + waste, 0) / totalUsages;
        
        // Generate recommendations
        const recommendations = [];
        if (averageWastage > 30) {
            recommendations.push('Consider adding more standard width options to reduce wastage');
        }
        if (averageEfficiency < 70) {
            recommendations.push('Review standard widths - current options may not match common requirements');
        }
        if (averageWastage < 10) {
            recommendations.push('Excellent width optimization - current standard widths work well');
        }

        return {
            materialId,
            totalUsages,
            averageEfficiency: parseFloat(averageEfficiency.toFixed(2)),
            averageWastage: parseFloat(averageWastage.toFixed(2)),
            maxWastage: Math.max(...wastages),
            minWastage: Math.min(...wastages),
            recommendations
        };
    }
}

module.exports = WireMeshOptimizationService; 