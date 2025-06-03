const LINEAR_CONVERSION_TO_FEET = {
  inches: 1 / 12,
  ft: 1,
  mm: 1 / 304.8,
  cm: 1 / 30.48,
  m: 1 / 0.3048,
};

const AREA_CONVERSION_TO_SQFT = {
  sqin: 1 / 144,
  sqft: 1,
  sqmm: 1 / (304.8 * 304.8),
  sqcm: 1 / (30.48 * 30.48),
  sqm: 1 / (0.3048 * 0.3048),
};

const COUNT_UNITS = ['pcs', 'piece', 'item', 'unit', 'set'];
const SUPPORTED_WEIGHT_UNITS = ['kg', 'g', 'lb', 'ton', 'tonne', 'quintal'];

const SUPPORTED_LINEAR_UNITS = Object.keys(LINEAR_CONVERSION_TO_FEET);
const SUPPORTED_AREA_UNITS = Object.keys(AREA_CONVERSION_TO_SQFT);

/**
 * Converts a value from one unit to another.
 * Supports linear, area, and count units.
 *
 * @param {number} value The numeric value to convert.
 * @param {string} fromUnit The unit of the input value.
 * @param {string} toUnit The target unit to convert to.
 * @returns {{result: number | null, error: string | null}}
 */
function convertUnit(value, fromUnit, toUnit) {
  if (typeof value !== 'number' || isNaN(value)) {
    return { result: null, error: 'Invalid input value. Must be a number.' };
  }

  const from = String(fromUnit).toLowerCase();
  const to = String(toUnit).toLowerCase();

  if (from === to) {
    return { result: value, error: null };
  }

  // Handle count units (pcs, etc.)
  if (COUNT_UNITS.includes(to)) {
    if (COUNT_UNITS.includes(from)) {
      return { result: value, error: null }; // pcs to pcs, no change
    }
    // If converting from a dimensional unit to pcs, it implies the formula already calculated the count.
    // For example, formula "1" for 1 piece, where formulaInputUnit might be incidentally 'inches'
    // but the quantity is 1 piece. So, we assume the value is already the count.
    // This is a simplification; more complex scenarios might need explicit handling.
    return { result: value, error: null }; 
  }
  if (COUNT_UNITS.includes(from) && !COUNT_UNITS.includes(to)){
    return { result: null, error: `Cannot convert from count unit '${fromUnit}' to dimensional unit '${toUnit}'.` };
  }

  // Handle linear units
  if (SUPPORTED_LINEAR_UNITS.includes(from) && SUPPORTED_LINEAR_UNITS.includes(to)) {
    try {
      const valueInFeet = value * LINEAR_CONVERSION_TO_FEET[from];
      const result = valueInFeet / LINEAR_CONVERSION_TO_FEET[to];
      return { result, error: isNaN(result) ? 'Conversion resulted in NaN.' : null };
    } catch (err) {
      return { result: null, error: 'Error during linear unit conversion.' };
    }
  }

  // Handle area units
  if (SUPPORTED_AREA_UNITS.includes(from) && SUPPORTED_AREA_UNITS.includes(to)) {
    try {
      const valueInSqFt = value * AREA_CONVERSION_TO_SQFT[from];
      const result = valueInSqFt / AREA_CONVERSION_TO_SQFT[to];
      return { result, error: isNaN(result) ? 'Conversion resulted in NaN.' : null };
    } catch (err) {
      return { result: null, error: 'Error during area unit conversion.' };
    }
  }
  
  // If units are of different types (e.g., linear to area) or unsupported
  return { 
    result: null, 
    error: `Unsupported unit conversion from '${fromUnit}' (type: ${getUnitType(from)}) to '${toUnit}' (type: ${getUnitType(to)}). Check unit compatibility.` 
  };
}

function getUnitType(unit) {
    const lowerUnit = String(unit).toLowerCase();
    if (SUPPORTED_LINEAR_UNITS.includes(lowerUnit)) return 'linear';
    if (SUPPORTED_AREA_UNITS.includes(lowerUnit)) return 'area';
    if (COUNT_UNITS.includes(lowerUnit)) return 'count';
    if (SUPPORTED_WEIGHT_UNITS.includes(lowerUnit)) return 'weight';
    return 'unknown';
}

module.exports = {
  convertUnit,
  SUPPORTED_LINEAR_UNITS,
  SUPPORTED_AREA_UNITS,
  COUNT_UNITS,
  SUPPORTED_WEIGHT_UNITS,
  getUnitType
}; 