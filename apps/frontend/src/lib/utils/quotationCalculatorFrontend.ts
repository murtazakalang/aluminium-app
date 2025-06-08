/**
 * Calculates detailed area and subtotal for a single quotation item for frontend preview,
 * mirroring the backend logic with new specific rules.
 *
 * @param item - The quotation item (plain object with width, height, quantity, pricePerAreaUnit as numbers or strings).
 * @param dimensionUnit - The unit of the item's dimensions (e.g., 'inches', 'mm').
 * @param areaUnit - The target area unit for calculation (e.g., 'sqft', 'sqm').
 * @param {boolean} [applyMinimum=true] - Whether to apply the minimum chargeable area rules.
 * @returns Calculated details: { rawAreaInDimUnits, convertedAreaBeforeRules, roundedArea, finalChargeableAreaPerItem, totalFinalChargeableArea, itemSubtotal }
 */
export function calculateItemDetailsFrontend(
  item: { width: string | number; height: string | number; quantity: number; pricePerAreaUnit: string | number },
  dimensionUnit: 'inches' | 'mm',
  areaUnit: 'sqft' | 'sqm',
  applyMinimum: boolean = true // New parameter, settings removed
): {
  rawAreaInDimUnits: number;
  convertedAreaBeforeRules: number;
  roundedArea: number;
  finalChargeableAreaPerItem: number;
  totalFinalChargeableArea: number;
  itemSubtotal: number;
} {
  const inputWidth = parseFloat(String(item.width)) || 0;
  const inputHeight = parseFloat(String(item.height)) || 0;
  const quantity = Number(item.quantity) || 1;
  const pricePerAreaUnit = parseFloat(String(item.pricePerAreaUnit)) || 0;

  if (inputWidth === 0 || inputHeight === 0) {
    return {
      rawAreaInDimUnits: 0,
      convertedAreaBeforeRules: 0,
      roundedArea: 0,
      finalChargeableAreaPerItem: 0,
      totalFinalChargeableArea: 0,
      itemSubtotal: 0,
    };
  }

  let widthInTargetDimUnit = inputWidth;
  let heightInTargetDimUnit = inputHeight;
  const rawAreaInDimUnits = inputWidth * inputHeight;

  let convertedArea = 0;
  let roundedArea = 0;
  let finalChargeableAreaPerItem = 0;

  if (areaUnit === 'sqft') {
    if (dimensionUnit === 'inches') {
      widthInTargetDimUnit = inputWidth / 12;
      heightInTargetDimUnit = inputHeight / 12;
    } else if (dimensionUnit === 'mm') {
      widthInTargetDimUnit = inputWidth / 304.8;
      heightInTargetDimUnit = inputHeight / 304.8;
    }
    convertedArea = widthInTargetDimUnit * heightInTargetDimUnit;
    if (convertedArea < 4) {
      roundedArea = Math.ceil(convertedArea / 0.5) * 0.5;
    } else {
      roundedArea = Math.ceil(convertedArea / 0.25) * 0.25;
    }
    finalChargeableAreaPerItem = roundedArea;
    if (applyMinimum) {
      const minimumChargeableSqft = 10;
      if (finalChargeableAreaPerItem < minimumChargeableSqft) {
        finalChargeableAreaPerItem = minimumChargeableSqft;
      }
    }
  } else if (areaUnit === 'sqm') {
    if (dimensionUnit === 'mm') {
      widthInTargetDimUnit = inputWidth / 1000;
      heightInTargetDimUnit = inputHeight / 1000;
    } else if (dimensionUnit === 'inches') {
      widthInTargetDimUnit = inputWidth * 0.0254;
      heightInTargetDimUnit = inputHeight * 0.0254;
    }
    convertedArea = widthInTargetDimUnit * heightInTargetDimUnit;
    if (convertedArea < 0.372) {
      roundedArea = Math.ceil(convertedArea / 0.046) * 0.046;
    } else {
      roundedArea = Math.ceil(convertedArea / 0.023) * 0.023;
    }
    finalChargeableAreaPerItem = roundedArea;
    if (applyMinimum) {
      const minimumChargeableSqm = 0.93;
      if (finalChargeableAreaPerItem < minimumChargeableSqm) {
        finalChargeableAreaPerItem = minimumChargeableSqm;
      }
    }
  } else {
    throw new Error(`Unsupported areaUnit: ${areaUnit}`);
  }

  const totalFinalChargeableArea = finalChargeableAreaPerItem * quantity;
  const itemSubtotal = totalFinalChargeableArea * pricePerAreaUnit;

  return {
    rawAreaInDimUnits: parseFloat(rawAreaInDimUnits.toFixed(6)),
    convertedAreaBeforeRules: parseFloat(convertedArea.toFixed(6)),
    roundedArea: parseFloat(roundedArea.toFixed(6)),
    finalChargeableAreaPerItem: parseFloat(finalChargeableAreaPerItem.toFixed(6)),
    totalFinalChargeableArea: parseFloat(totalFinalChargeableArea.toFixed(6)),
    itemSubtotal: parseFloat(itemSubtotal.toFixed(2)),
  };
}

/**
 * Calculates the overall totals for a quotation for frontend preview.
 * @param items - Array of quotation items, each should have an itemSubtotal (number).
 * @param charges - Array of additional charges, each with an amount (number or string).
 * @param discount - Discount object with type ('percentage' or 'fixed') and value (number or string).
 * @returns Calculated totals: { subtotal, totalChargesAmount, discountAmount, grandTotal }
 */
export function calculateQuotationTotalsFrontend(
  items: Array<{ itemSubtotal?: number | string }> = [],
  charges: Array<{ amount?: number | string }> = [],
  discount: { type?: 'percentage' | 'fixed'; value?: number | string } = { type: 'fixed', value: 0 }
): {
  subtotal: number;
  totalChargesAmount: number;
  discountAmount: number;
  grandTotal: number;
} {
  const subtotal = items.reduce((sum, item) => sum + (parseFloat(String(item.itemSubtotal)) || 0), 0);
  const totalChargesAmount = charges.reduce((sum, charge) => sum + (parseFloat(String(charge.amount)) || 0), 0);

  let calculatedDiscountAmount = 0;
  const grossTotal = subtotal + totalChargesAmount;

  if (discount && discount.value && parseFloat(String(discount.value)) > 0) {
    const discountValue = parseFloat(String(discount.value)) || 0;
    if (discount.type === 'percentage') {
      calculatedDiscountAmount = (grossTotal * discountValue) / 100;
    } else { // Fixed
      calculatedDiscountAmount = discountValue;
    }
  }
  
  calculatedDiscountAmount = Math.min(calculatedDiscountAmount, grossTotal);
  const grandTotal = grossTotal - calculatedDiscountAmount;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    totalChargesAmount: parseFloat(totalChargesAmount.toFixed(2)),
    discountAmount: parseFloat(calculatedDiscountAmount.toFixed(2)),
    grandTotal: parseFloat(grandTotal.toFixed(2)),
  };
} 