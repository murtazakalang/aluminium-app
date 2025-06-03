/**
 * Get valid stock units based on material category
 * @param {string} category - Material category ('Profile', 'Glass', 'Hardware', 'Accessories', 'Consumables')
 * @returns {string[]} - Array of valid stock units for the given category
 */
export const getValidStockUnits = (category) => {
  switch (category) {
    case 'Profile':
      return ['pipe', 'kg', 'lbs'];
    case 'Glass':
      return ['sqft', 'sqm'];
    case 'Hardware':
    case 'Accessories':
    case 'Consumables':
      return ['pcs', 'box', 'carton', 'kg'];
    default:
      return ['pcs'];
  }
};

/**
 * Get valid usage units based on material category
 * @param {string} category - Material category ('Profile', 'Glass', 'Wire Mesh', 'Hardware', 'Accessories', 'Consumables')
 * @returns {string[]} - Array of valid usage units for the given category
 */
export const getValidUsageUnits = (category) => {
  switch (category) {
    case 'Profile':
      return ['ft', 'inches', 'mm', 'm'];
    case 'Glass':
    case 'Wire Mesh':
      return ['sqft', 'sqm'];
    case 'Hardware':
    case 'Accessories':
    case 'Consumables':
      return ['pcs'];
    default:
      return ['pcs'];
  }
};

/**
 * Get default stock unit based on material category
 * @param {string} category - Material category
 * @returns {string} - Default stock unit for the given category
 */
export const getDefaultStockUnit = (category) => {
  switch (category) {
    case 'Profile':
      return 'pipe';
    case 'Glass':
    case 'Wire Mesh':
      return 'sqft';
    case 'Hardware':
    case 'Accessories':
    case 'Consumables':
      return 'pcs';
    default:
      return 'pcs';
  }
};

/**
 * Get default usage unit based on material category
 * @param {string} category - Material category
 * @returns {string} - Default usage unit for the given category
 */
export const getDefaultUsageUnit = (category) => {
  switch (category) {
    case 'Profile':
      return 'ft';
    case 'Glass':
    case 'Wire Mesh':
      return 'sqft';
    case 'Hardware':
    case 'Accessories':
    case 'Consumables':
      return 'pcs';
    default:
      return 'pcs';
  }
};

/**
 * Format a unit for display
 * @param {string} unit - Unit code
 * @returns {string} - Formatted unit string for display
 */
export const formatUnit = (unit) => {
  switch (unit) {
    case 'ft':
      return 'feet';
    case 'sqft':
      return 'sq.ft';
    case 'sqm':
      return 'sq.m';
    case 'mm':
      return 'mm';
    case 'pcs':
      return 'pieces';
    default:
      return unit;
  }
}; 