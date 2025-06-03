const mongoose = require('mongoose');
// const { convertUnits } = require('./unitConverter'); // Existing unitConverter might not be needed or may need alignment.

/**
 * Calculates detailed area and subtotal for a single quotation item based on new specific rules.
 *
 * @param {object} item - The quotation item.
 * @param {string | number} item.width - Width of the item.
 * @param {string | number} item.height - Height of the item.
 * @param {number} item.quantity - Quantity of the item.
 * @param {string | number} item.pricePerAreaUnit - Price per unit of area.
 * @param {'inches' | 'mm'} dimensionUnit - The unit of the item's dimensions.
 * @param {'sqft' | 'sqm'} areaUnit - The target area unit for calculation.
 * @param {boolean} [applyMinimum=true] - Whether to apply the minimum chargeable area rules.
 * @returns {object} Calculated details: { rawAreaInDimUnits, convertedAreaBeforeRules, roundedArea, finalChargeableAreaPerItem, totalFinalChargeableArea, itemSubtotal }
 */
function calculateItemDetails(item, dimensionUnit, areaUnit, applyMinimum = true) {
  const inputWidth = parseFloat(String(item.width)) || 0;
  const inputHeight = parseFloat(String(item.height)) || 0;
  const quantity = Number(item.quantity) || 1;
  const pricePerAreaUnit = parseFloat(String(item.pricePerAreaUnit)) || 0;

  if (inputWidth === 0 || inputHeight === 0) { // Price check removed, as area might be needed even with 0 price
    return {
      rawAreaInDimUnits: 0, // Area in original dimension units squared (e.g., sq.in, sq.mm)
      convertedAreaBeforeRules: 0, // Area converted to target areaUnit before specific rounding/minima
      roundedArea: 0, // Area after specific rounding rule
      finalChargeableAreaPerItem: 0, // finalArea: Area after minimum rule
      totalFinalChargeableArea: 0,
      itemSubtotal: 0,
    };
  }

  let widthInTargetDimUnit = inputWidth;
  let heightInTargetDimUnit = inputHeight;
  let rawAreaInDimUnits = inputWidth * inputHeight; // e.g., sq.in or sq.mm

  let convertedArea = 0;
  let roundedArea = 0;
  let finalChargeableAreaPerItem = 0;

  if (areaUnit === 'sqft') {
    // Convert dimensions to feet if necessary
    if (dimensionUnit === 'inches') {
      widthInTargetDimUnit = inputWidth / 12;
      heightInTargetDimUnit = inputHeight / 12;
    } else if (dimensionUnit === 'mm') {
      widthInTargetDimUnit = inputWidth / 304.8; // 1 ft = 304.8 mm
      heightInTargetDimUnit = inputHeight / 304.8;
    }
    // If dimensionUnit is already feet (not typical for this app structure, but for completeness)
    // else if (dimensionUnit === 'ft') { /* no change needed */ }

    convertedArea = widthInTargetDimUnit * heightInTargetDimUnit; // This is now in sqft

    // Rounding for sqft:
    if (convertedArea < 4) {
      roundedArea = Math.ceil(convertedArea / 0.5) * 0.5; // Round to nearest 0.5 sqft
    } else {
      roundedArea = Math.ceil(convertedArea / 0.25) * 0.25; // Round to nearest 0.25 sqft
    }

    finalChargeableAreaPerItem = roundedArea;
    if (applyMinimum) {
      const minimumChargeableSqft = 10;
      if (finalChargeableAreaPerItem < minimumChargeableSqft) {
        finalChargeableAreaPerItem = minimumChargeableSqft;
      }
    }

  } else if (areaUnit === 'sqm') {
    // Convert dimensions to meters if necessary
    if (dimensionUnit === 'mm') {
      widthInTargetDimUnit = inputWidth / 1000;
      heightInTargetDimUnit = inputHeight / 1000;
    } else if (dimensionUnit === 'inches') {
      widthInTargetDimUnit = inputWidth * 0.0254; // 1 inch = 0.0254 meters
      heightInTargetDimUnit = inputHeight * 0.0254;
    }
    // If dimensionUnit is already meters (not typical for this app structure, but for completeness)
    // else if (dimensionUnit === 'm') { /* no change needed */ }

    convertedArea = widthInTargetDimUnit * heightInTargetDimUnit; // This is now in sqm

    // Rounding for sqm:
    // 0.372 m² approx 4 sqft. 0.046 m² approx 0.5 sqft. 0.023 m² approx 0.25 sqft.
    if (convertedArea < 0.372) {
      roundedArea = Math.ceil(convertedArea / 0.046) * 0.046; // Round to nearest 0.046 sqm
    } else {
      roundedArea = Math.ceil(convertedArea / 0.023) * 0.023; // Round to nearest 0.023 sqm
    }

    finalChargeableAreaPerItem = roundedArea;
    if (applyMinimum) {
      const minimumChargeableSqm = 0.93; // Approx 10 sqft
      if (finalChargeableAreaPerItem < minimumChargeableSqm) {
        finalChargeableAreaPerItem = minimumChargeableSqm;
      }
    }
  } else {
    // Should not happen with TypeScript, but as a safeguard
    throw new Error(`Unsupported areaUnit: ${areaUnit}`);
  }

  const totalFinalChargeableArea = finalChargeableAreaPerItem * quantity;
  const itemSubtotal = totalFinalChargeableArea * pricePerAreaUnit;

  return {
    rawAreaInDimUnits: parseFloat(rawAreaInDimUnits.toFixed(6)), // Area in original dimension units squared (e.g., sq.in, sq.mm)
    convertedAreaBeforeRules: parseFloat(convertedArea.toFixed(6)), // Area converted to target areaUnit before specific rounding/minima
    roundedArea: parseFloat(roundedArea.toFixed(6)), // Area after specific rounding rule
    finalChargeableAreaPerItem: parseFloat(finalChargeableAreaPerItem.toFixed(6)), // finalArea: Area after minimum rule
    totalFinalChargeableArea: parseFloat(totalFinalChargeableArea.toFixed(6)),
    itemSubtotal: parseFloat(itemSubtotal.toFixed(2)),
  };
}

/**
 * Calculates the overall totals for a quotation.
 * @param {Array<object>} items - Array of quotation items, each should have an itemSubtotal.
 * @param {Array<object>} charges - Array of additional charges, each with an amount.
 * @param {object} discount - Discount object with type ('percentage' or 'fixed') and value.
 * @returns {object} Calculated totals: { subtotal, totalChargesAmount, discountAmount, grandTotal }
 */
function calculateQuotationTotals(items = [], charges = [], discount = { type: 'fixed', value: 0 }) {
  const subtotal = items.reduce((sum, item) => sum + (parseFloat(String(item.itemSubtotal)) || 0), 0);
  const totalChargesAmount = charges.reduce((sum, charge) => sum + (parseFloat(String(charge.amount)) || 0), 0);

  let calculatedDiscountAmount = 0;
  const grossTotal = subtotal + totalChargesAmount; // Total before discount

  if (discount && discount.value) { // Check if discount.value is present and not zero
    const discountValue = parseFloat(String(discount.value)) || 0;
    if (discountValue > 0) {
        if (discount.type === 'percentage') {
            calculatedDiscountAmount = (grossTotal * discountValue) / 100;
        } else { // Fixed
            calculatedDiscountAmount = discountValue;
        }
    }
  }
  
  // Ensure discount doesn't exceed gross total
  calculatedDiscountAmount = Math.min(calculatedDiscountAmount, grossTotal);

  const grandTotal = grossTotal - calculatedDiscountAmount;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    totalChargesAmount: parseFloat(totalChargesAmount.toFixed(2)),
    discountAmount: parseFloat(calculatedDiscountAmount.toFixed(2)),
    grandTotal: parseFloat(grandTotal.toFixed(2)),
  };
}

module.exports = {
  calculateItemDetails,
  calculateQuotationTotals,
}; 