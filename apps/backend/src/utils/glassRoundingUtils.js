/**
 * Glass Rounding Utilities
 * Implements factory glass sheet cutting rules and billing accuracy
 */

/**
 * Rounds width or height dimensions according to glass cutting rules
 * @param {number} value - The dimension value to round
 * @param {string} unit - The unit of the dimension ('inches' or 'mm')
 * @returns {number} Rounded dimension
 */
function roundGlassDimension(value, unit) {
    if (typeof value !== 'number' || value <= 0) {
        return value; // Return original if invalid
    }

    switch (unit.toLowerCase()) {
        case 'inches':
        case 'in':
            // Round up to the nearest 3 inches
            return Math.ceil(value / 3) * 3;
        
        case 'mm':
        case 'millimeters':
            // Round up to the nearest 76.2mm (equivalent to 3 inches)
            return Math.ceil(value / 76.2) * 76.2;
        
        case 'ft':
        case 'feet':
            // Convert to inches, round to nearest 3 inches, convert back
            const inInches = value * 12;
            const roundedInches = Math.ceil(inInches / 3) * 3;
            return roundedInches / 12;
        
        case 'm':
        case 'meters':
            // Convert to mm, round to nearest 76.2mm, convert back
            const inMm = value * 1000;
            const roundedMm = Math.ceil(inMm / 76.2) * 76.2;
            return roundedMm / 1000;
        
        default:
            return value; // No rounding for unknown units
    }
}

/**
 * Rounds area after calculation according to billing rules
 * @param {number} area - The calculated area value
 * @param {string} unit - The area unit ('sqft' or 'sqm')
 * @returns {number} Rounded area
 */
function roundGlassArea(area, unit) {
    if (typeof area !== 'number' || area <= 0) {
        return area; // Return original if invalid
    }

    switch (unit.toLowerCase()) {
        case 'sqft':
            // Round to nearest 0.25 sqft using specific scale:
            // .00 – .25 ➝ .25
            // .251 – .50 ➝ .50
            // .501 – .75 ➝ .75
            // .751 – .999 ➝ next whole number
            
            const wholeNumber = Math.floor(area);
            const fraction = area - wholeNumber;
            
            let roundedFraction;
            if (fraction === 0) {
                roundedFraction = 0.25; // .00 goes to .25
            } else if (fraction <= 0.25) {
                roundedFraction = 0.25;
            } else if (fraction <= 0.50) {
                roundedFraction = 0.50;
            } else if (fraction <= 0.75) {
                roundedFraction = 0.75;
            } else {
                // .751 - .999 rounds to next whole number
                return wholeNumber + 1;
            }
            
            return wholeNumber + roundedFraction;
        
        case 'sqm':
            // Apply similar logic for square meters (0.025 increments for finer control)
            const wholeSqm = Math.floor(area);
            const fractionSqm = area - wholeSqm;
            
            let roundedFractionSqm;
            if (fractionSqm <= 0.025) {
                roundedFractionSqm = 0.025;
            } else if (fractionSqm <= 0.05) {
                roundedFractionSqm = 0.05;
            } else if (fractionSqm <= 0.075) {
                roundedFractionSqm = 0.075;
            } else {
                // Round to next 0.1 increment
                roundedFractionSqm = Math.ceil(fractionSqm * 10) / 10;
            }
            
            return wholeSqm + roundedFractionSqm;
        
        default:
            return area; // No rounding for unknown units
    }
}

/**
 * Calculates glass area with proper pre and post rounding
 * @param {number} adjustedWidth - Width after formula calculation
 * @param {number} adjustedHeight - Height after formula calculation
 * @param {string} dimensionUnit - Unit of dimensions ('inches', 'mm', etc.)
 * @param {string} outputUnit - Desired output unit ('sqft', 'sqm')
 * @returns {{area: number, roundedWidth: number, roundedHeight: number}}
 */
function calculateGlassAreaWithRounding(adjustedWidth, adjustedHeight, dimensionUnit, outputUnit) {
    // Step 1: Round dimensions according to glass cutting rules
    const roundedWidth = roundGlassDimension(adjustedWidth, dimensionUnit);
    const roundedHeight = roundGlassDimension(adjustedHeight, dimensionUnit);
    
    // Step 2: Calculate area using rounded dimensions
    let area;
    
    // Convert to appropriate area unit first
    switch (dimensionUnit.toLowerCase()) {
        case 'inches':
        case 'in':
            // Area in square inches
            area = roundedWidth * roundedHeight;
            
            // Convert to output unit if needed
            if (outputUnit.toLowerCase() === 'sqft') {
                area = area / 144; // Convert sq inches to sq feet
            } else if (outputUnit.toLowerCase() === 'sqm') {
                area = area / 1550.0031; // Convert sq inches to sq meters
            }
            break;
            
        case 'mm':
        case 'millimeters':
            // Area in square mm
            area = roundedWidth * roundedHeight;
            
            // Convert to output unit if needed
            if (outputUnit.toLowerCase() === 'sqft') {
                area = area / 92903.04; // Convert sq mm to sq feet
            } else if (outputUnit.toLowerCase() === 'sqm') {
                area = area / 1000000; // Convert sq mm to sq meters
            }
            break;
            
        case 'ft':
        case 'feet':
            // Area in square feet
            area = roundedWidth * roundedHeight;
            
            // Convert to output unit if needed
            if (outputUnit.toLowerCase() === 'sqm') {
                area = area / 10.764; // Convert sq feet to sq meters
            }
            break;
            
        case 'm':
        case 'meters':
            // Area in square meters
            area = roundedWidth * roundedHeight;
            
            // Convert to output unit if needed
            if (outputUnit.toLowerCase() === 'sqft') {
                area = area * 10.764; // Convert sq meters to sq feet
            }
            break;
            
        default:
            // Assume same unit calculation
            area = roundedWidth * roundedHeight;
    }
    
    // Step 3: Round the final area according to billing rules
    const roundedArea = roundGlassArea(area, outputUnit);
    
    return {
        area: roundedArea,
        roundedWidth: roundedWidth,
        roundedHeight: roundedHeight
    };
}

/**
 * Formats dimension value for display
 * @param {number} value - The dimension value
 * @param {string} unit - The unit
 * @returns {string} Formatted dimension string
 */
function formatDimension(value, unit) {
    return `${value.toFixed(2)} ${unit}`;
}

/**
 * Formats area value for display
 * @param {number} area - The area value
 * @param {string} unit - The area unit
 * @returns {string} Formatted area string
 */
function formatArea(area, unit) {
    return `${area.toFixed(2)} ${unit}`;
}

module.exports = {
    roundGlassDimension,
    roundGlassArea,
    calculateGlassAreaWithRounding,
    formatDimension,
    formatArea
}; 