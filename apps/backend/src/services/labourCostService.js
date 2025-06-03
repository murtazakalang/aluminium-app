const mongoose = require('mongoose');
const { convertUnit } = require('../utils/unitConverter');
const { calculateItemDetails } = require('../utils/quotationCalculator');

/**
 * Labour Cost Service
 * Handles calculation of labour costs for estimation items based on product definitions
 */

// Helper utility to robustly convert values to Mongoose Decimal128
const toDecimal128 = (value, defaultValue = '0.00') => {
    if (value === null || value === undefined) {
        return mongoose.Types.Decimal128.fromString(defaultValue);
    }
    if (value instanceof mongoose.Types.Decimal128) {
        return value; // Already a Decimal128
    }
    if (typeof value === 'number') {
        return mongoose.Types.Decimal128.fromString(value.toFixed(2)); 
    }
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        if (isNaN(parsed)) {
            return mongoose.Types.Decimal128.fromString(defaultValue);
        }
        return mongoose.Types.Decimal128.fromString(parsed.toFixed(2));
    }
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

/**
 * Calculate labour cost for a single product type
 * @param {Object} productType - Product type with populated labour cost
 * @param {Array} items - Estimation items for this product type
 * @param {string} dimensionUnitUsed - Dimension unit used in estimation items (e.g. 'inches', 'mm')
 * @param {number} materialSubtotalForProduct - Material subtotal for this product (for percentage calculation)
 * @param {Object} companySettings - Company settings including area calculation rules. Note: areaUnitDefault might still be used if labour type implies a unit.
 * @param {string} companySettings.areaUnitDefault - Default area unit for the company (e.g. 'sqft', 'sqm')
 * @returns {Object} Labour cost details
 */
const calculateLabourCostForProduct = (productType, items, dimensionUnitUsed, materialSubtotalForProduct = 0, companySettings = {}) => {
    if (!productType.labourCost || !productType.labourCost.type) {
        return null;
    }
    
    const labourType = productType.labourCost.type;
    const labourValue = parseFloat(productType.labourCost.value.toString());
    
    if (labourValue <= 0) {
        return null;
    }
    
    let totalLabourCost = 0;
    let description = '';
    let rateDescription = '';
    let totalCalculatedArea = 0;
    let totalQuantity = 0;

    items.forEach(item => {
        const itemWidth = parseFloat(item.width.toString());
        const itemHeight = parseFloat(item.height.toString());
        const itemQuantity = item.quantity;
        
        totalQuantity += itemQuantity;
        
        if (labourType === 'perSqft' || labourType === 'perSqm') {
            const targetAreaUnitForLabour = labourType === 'perSqft' ? 'sqft' : 'sqm';
            
            const details = calculateItemDetails(
                { width: itemWidth, height: itemHeight, quantity: 1, pricePerAreaUnit: 0 },
                dimensionUnitUsed,
                targetAreaUnitForLabour
            );
            
            totalCalculatedArea += details.finalChargeableAreaPerItem * itemQuantity;
        }
    });
    
    // Calculate labour cost based on type
    switch (labourType) {
        case 'fixed':
            totalLabourCost = labourValue * totalQuantity;
            description = `Labour - ${productType.name}`;
            rateDescription = `₹${labourValue.toFixed(2)} per item`;
            break;
            
        case 'perSqft':
            totalLabourCost = labourValue * totalCalculatedArea;
            description = `Labour - ${productType.name}`;
            rateDescription = `₹${labourValue.toFixed(2)} per sqft (Area: ${totalCalculatedArea.toFixed(2)} sqft)`;
            break;
            
        case 'perSqm':
            totalLabourCost = labourValue * totalCalculatedArea;
            description = `Labour - ${productType.name}`;
            rateDescription = `₹${labourValue.toFixed(2)} per sqm (Area: ${totalCalculatedArea.toFixed(2)} sqm)`;
            break;
            
        case 'percentage':
            totalLabourCost = (labourValue / 100) * materialSubtotalForProduct;
            description = `Labour - ${productType.name}`;
            rateDescription = `${labourValue}% of material cost`;
            break;
            
        default:
            return null;
    }
    
    return {
        description,
        amount: toDecimal128(totalLabourCost),
        isLabourCharge: true,
        labourCostType: labourType,
        labourRate: toDecimal128(labourValue),
        productTypeId: productType._id,
        calculatedArea: totalCalculatedArea > 0 ? toDecimal128(totalCalculatedArea.toFixed(4)) : undefined,
        itemQuantity: totalQuantity,
        autoGenerated: true,
        manuallyModified: false,
        rateDescription
    };
};

/**
 * Calculate labour costs for all products in an estimation
 * @param {Array} estimationItems - All estimation items
 * @param {Object} productTypesMap - Map of productTypeId to populated ProductType
 * @param {string} dimensionUnitUsed - Dimension unit used in estimation items
 * @param {Object} materialCostsByProduct - Map of productTypeId to material subtotal
 * @param {Object} companySettings - Company settings for area calculation (currently only areaUnitDefault might be relevant if not inferable)
 * @returns {Array} Array of labour charge objects
 */
const calculateLabourCosts = (estimationItems, productTypesMap, dimensionUnitUsed, materialCostsByProduct = {}, companySettings = {}) => {
    const labourCharges = [];
    
    // Group items by product type
    const itemsByProductType = {};
    estimationItems.forEach(item => {
        const productTypeId = item.productTypeId.toString();
        if (!itemsByProductType[productTypeId]) {
            itemsByProductType[productTypeId] = [];
        }
        itemsByProductType[productTypeId].push(item);
    });
    
    // Calculate labour cost for each product type
    Object.keys(itemsByProductType).forEach(productTypeId => {
        const productType = productTypesMap[productTypeId];
        const items = itemsByProductType[productTypeId];
        const materialSubtotal = materialCostsByProduct[productTypeId] || 0;
        
        if (productType) {
            const labourCost = calculateLabourCostForProduct(
                productType, 
                items, 
                dimensionUnitUsed, 
                materialSubtotal,
                companySettings
            );
            
            if (labourCost) {
                labourCharges.push(labourCost);
            }
        }
    });
    
    return labourCharges;
};

/**
 * Merge existing manual charges with new auto-generated labour charges
 * Preserves manually modified charges and removes old auto-generated ones
 * @param {Array} existingCharges - Existing manual charges
 * @param {Array} newLabourCharges - New auto-generated labour charges
 * @returns {Array} Merged charges array
 */
const mergeLabourCharges = (existingCharges = [], newLabourCharges = []) => {
    // Keep existing charges that are either:
    // 1. Not labour charges
    // 2. Labour charges that have been manually modified
    const preservedCharges = existingCharges.filter(charge => 
        !charge.isLabourCharge || charge.manuallyModified
    );
    
    // Add new auto-generated labour charges
    return [...preservedCharges, ...newLabourCharges];
};

module.exports = {
    calculateLabourCosts,
    calculateLabourCostForProduct,
    mergeLabourCharges,
    toDecimal128
}; 