const { evaluateFormula, validateFormulaString } = require('../utils/formulaEvaluator');
const { convertUnit } = require('../utils/unitConverter');
const { calculateGlassAreaWithRounding } = require('../utils/glassRoundingUtils');

/**
 * Service for handling glass area formula calculations
 */
class GlassFormulaService {
    /**
     * Validates a glass area formula string
     * @param {string} formula - The formula string to validate
     * @returns {{valid: boolean, error?: string}}
     */
    static validateFormula(formula) {
        if (!formula || typeof formula !== 'string') {
            return { valid: false, error: 'Formula is required and must be a string' };
        }

        // Check if formula contains only allowed variables (W, H), math operators, and Math functions
        const allowedPattern = /^[WHwh0-9+\-*/().\s,Mathabcdefghijklmnopqrstuvwxyz]+$/;
        if (!allowedPattern.test(formula)) {
            return { valid: false, error: 'Formula can only contain variables W, H, mathematical operators (+, -, *, /, parentheses), and Math functions' };
        }

        // Validate using existing formula validator with normalized variables
        // Convert Math.function() to function() for mathjs compatibility FIRST
        let normalizedFormula = formula.replace(/Math\./g, '');
        
        // Then normalize case for variables
        normalizedFormula = normalizedFormula.replace(/w/g, 'W').replace(/h/g, 'H');
        
        return validateFormulaString(normalizedFormula);
    }

    /**
     * Calculates glass area using formula and dimensions with proper rounding
     * @param {string} formula - The formula string
     * @param {number} width - Width in input unit
     * @param {number} height - Height in input unit  
     * @param {string} inputUnit - Unit of width/height (inches, mm, ft, m)
     * @param {string} outputUnit - Desired output unit (sqft, sqm)
     * @returns {{result: number | null, error: string | null, adjustedWidth?: number, adjustedHeight?: number, roundedWidth?: number, roundedHeight?: number}}
     */
    static calculateGlassArea(formula, width, height, inputUnit = 'inches', outputUnit = 'sqft') {
        // Validate inputs
        if (!formula || typeof formula !== 'string') {
            return { result: null, error: 'Formula is required' };
        }

        if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
            return { result: null, error: 'Width and height must be positive numbers' };
        }

        // Validate formula first
        const formulaValidation = this.validateFormula(formula);
        if (!formulaValidation.valid) {
            return { result: null, error: formulaValidation.error };
        }

        try {
            // Normalize formula variables and convert Math.function() to function()
            // Convert Math.function() to function() for mathjs compatibility FIRST
            let normalizedFormula = formula.replace(/Math\./g, '');
            // Then normalize case for variables
            normalizedFormula = normalizedFormula.replace(/w/g, 'W').replace(/h/g, 'H');

            // Check if formula contains Math functions - handle differently
            if (formula.includes('Math.') || normalizedFormula.includes('max(') || normalizedFormula.includes('min(') || normalizedFormula.includes('abs(')) {
                // For Math functions, evaluate directly without dimension rounding
                const evaluationResult = evaluateFormula(normalizedFormula, { W: width, H: height });
                
                if (evaluationResult.error) {
                    return { result: null, error: `Formula evaluation error: ${evaluationResult.error}` };
                }

                // For Math functions, assume the formula handles its own unit conversions
                // The result is returned as-is, assuming the formula author knows what units they want
                return { result: evaluationResult.result, error: null };
            }

            // For standard formulas, parse components and apply rounding
            const { adjustedWidth, adjustedHeight } = this._parseFormulaComponents(normalizedFormula, width, height);
            
            // Apply glass rounding logic
            const roundingResult = calculateGlassAreaWithRounding(adjustedWidth, adjustedHeight, inputUnit, outputUnit);
            
            return { 
                result: roundingResult.area,
                error: null,
                adjustedWidth: adjustedWidth,
                adjustedHeight: adjustedHeight,
                roundedWidth: roundingResult.roundedWidth,
                roundedHeight: roundingResult.roundedHeight
            };

        } catch (error) {
            return { result: null, error: `Calculation error: ${error.message}` };
        }
    }

    /**
     * Parses formula to extract individual width and height adjustments
     * @param {string} formula - Normalized formula string
     * @param {number} width - Original width
     * @param {number} height - Original height
     * @returns {{adjustedWidth: number, adjustedHeight: number}}
     * @private
     */
    static _parseFormulaComponents(formula, width, height) {
        // Common patterns we need to handle:
        // 1. "W * H" -> no adjustment
        // 2. "(W - 4.75) * (H - 5)" -> width adjustment: W - 4.75, height adjustment: H - 5
        // 3. "(W - 4.75) / 2 * (H - 5)" -> width adjustment: (W - 4.75) / 2, height adjustment: H - 5
        
        // Pattern 1: Simple W * H
        if (formula.trim() === 'W * H') {
            return { adjustedWidth: width, adjustedHeight: height };
        }
        
        // Pattern 2: Handle formulas like "(width_expr) * (height_expr)" or "((width_expr)) * (height_expr)"
        const basicPattern = /^(.+W.+?)\s*\*\s*(.+H.+?)$/;
        const basicMatch = formula.match(basicPattern);
        
        if (basicMatch) {
            let widthExpression = basicMatch[1].trim();
            let heightExpression = basicMatch[2].trim();
            
            // Remove outer parentheses if present
            if (widthExpression.startsWith('(') && widthExpression.endsWith(')')) {
                widthExpression = widthExpression.slice(1, -1).trim();
            }
            if (heightExpression.startsWith('(') && heightExpression.endsWith(')')) {
                heightExpression = heightExpression.slice(1, -1).trim();
            }
            
            // Evaluate width component
            const widthResult = evaluateFormula(widthExpression, { W: width, H: height });
            if (widthResult.error) {
                throw new Error(`Width component error: ${widthResult.error}`);
            }
            
            // Evaluate height component
            const heightResult = evaluateFormula(heightExpression, { W: width, H: height });
            if (heightResult.error) {
                throw new Error(`Height component error: ${heightResult.error}`);
            }
            
            return { adjustedWidth: widthResult.result, adjustedHeight: heightResult.result };
        }
        
        // Pattern 3: Math functions and other complex formulas
        // For formulas with Math functions, we need special handling
        if (formula.includes('Math.')) {
            // For Math functions, evaluate the formula directly and don't apply dimension rounding
            // This is because Math functions typically work on areas, not individual dimensions
            const evaluationResult = evaluateFormula(formula, { W: width, H: height });
            if (evaluationResult.error) {
                throw new Error(`Formula evaluation error: ${evaluationResult.error}`);
            }
            
            // For Math functions, return the original dimensions since the formula handles the logic
            return { adjustedWidth: width, adjustedHeight: height };
        }
        
        // Pattern 4: Other complex formulas - try to evaluate and approximate
        const evaluationResult = evaluateFormula(formula, { W: width, H: height });
        if (evaluationResult.error) {
            throw new Error(`Formula evaluation error: ${evaluationResult.error}`);
        }
        
        // Approximate based on the total result
        // This is a fallback for complex formulas that don't fit standard patterns
        const totalResult = evaluationResult.result;
        
        // If the formula result is in area units (like sqin), we need to extract dimensions
        // For now, assume equal scaling of both dimensions
        const originalArea = width * height;
        const scaleFactor = Math.sqrt(totalResult / originalArea);
        
        return { 
            adjustedWidth: width * scaleFactor, 
            adjustedHeight: height * scaleFactor 
        };
    }

    /**
     * Tests a formula with sample dimensions
     * @param {string} formula - The formula to test
     * @param {Array} testCases - Array of test cases with {width, height, expected?} 
     * @returns {{results: Array, error?: string}}
     */
    static testFormula(formula, testCases = []) {
        const validation = this.validateFormula(formula);
        if (!validation.valid) {
            return { results: [], error: validation.error };
        }

        // Default test cases if none provided
        const defaultTestCases = [
            { width: 48, height: 60 },
            { width: 36, height: 48 },
            { width: 24, height: 36 }
        ];

        const casesToTest = testCases.length > 0 ? testCases : defaultTestCases;
        const results = [];

        for (const testCase of casesToTest) {
            const calculation = this.calculateGlassArea(
                formula, 
                testCase.width, 
                testCase.height, 
                testCase.inputUnit || 'inches',
                testCase.outputUnit || 'sqft'
            );

            results.push({
                width: testCase.width,
                height: testCase.height,
                inputUnit: testCase.inputUnit || 'inches',
                outputUnit: testCase.outputUnit || 'sqft',
                result: calculation.result,
                error: calculation.error,
                expected: testCase.expected || null
            });
        }

        return { results, error: null };
    }

    /**
     * Converts glass area between units
     * @param {number} area - Area value
     * @param {string} fromUnit - Source unit (sqft, sqm, sqin, sqmm)
     * @param {string} toUnit - Target unit (sqft, sqm, sqin, sqmm)
     * @returns {{result: number | null, error: string | null}}
     */
    static convertGlassArea(area, fromUnit, toUnit) {
        if (typeof area !== 'number' || area < 0) {
            return { result: null, error: 'Area must be a non-negative number' };
        }

        return convertUnit(area, fromUnit, toUnit);
    }

    /**
     * Gets supported units for glass formulas
     * @returns {{inputUnits: string[], outputUnits: string[]}}
     */
    static getSupportedUnits() {
        return {
            inputUnits: ['inches', 'mm', 'ft', 'm'],
            outputUnits: ['sqft', 'sqm']
        };
    }

    /**
     * Calculates glass area using separate width and height formulas with quantity multiplier
     * This is ideal for multi-track windows where you need multiple pieces of the same glass size
     * @param {string} widthFormula - Formula for calculating adjusted width (e.g., "(W - 4.75) / 2")
     * @param {string} heightFormula - Formula for calculating adjusted height (e.g., "H - 5") 
     * @param {number} width - Width in input unit
     * @param {number} height - Height in input unit
     * @param {number} glassQuantity - Number of glass pieces (e.g., 2 for 2-track)
     * @param {string} inputUnit - Unit of width/height (inches, mm, ft, m)
     * @param {string} outputUnit - Desired output unit (sqft, sqm)
     * @returns {{result: number | null, error: string | null, adjustedWidth?: number, adjustedHeight?: number, roundedWidth?: number, roundedHeight?: number, areaPerPiece?: number, totalArea?: number, glassQuantity?: number}}
     */
    static calculateGlassAreaWithQuantity(widthFormula, heightFormula, width, height, glassQuantity = 1, inputUnit = 'inches', outputUnit = 'sqft') {
        // Validate inputs
        if (!widthFormula || typeof widthFormula !== 'string') {
            return { result: null, error: 'Width formula is required' };
        }
        
        if (!heightFormula || typeof heightFormula !== 'string') {
            return { result: null, error: 'Height formula is required' };
        }

        if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
            return { result: null, error: 'Width and height must be positive numbers' };
        }

        if (typeof glassQuantity !== 'number' || glassQuantity <= 0) {
            return { result: null, error: 'Glass quantity must be a positive number' };
        }

        try {
            // Normalize formulas
            const normalizedWidthFormula = widthFormula.replace(/Math\./g, '').replace(/w/g, 'W').replace(/h/g, 'H');
            const normalizedHeightFormula = heightFormula.replace(/Math\./g, '').replace(/w/g, 'W').replace(/h/g, 'H');

            // Validate formulas
            const widthValidation = validateFormulaString(normalizedWidthFormula);
            if (!widthValidation.valid) {
                return { result: null, error: `Width formula error: ${widthValidation.error}` };
            }

            const heightValidation = validateFormulaString(normalizedHeightFormula);
            if (!heightValidation.valid) {
                return { result: null, error: `Height formula error: ${heightValidation.error}` };
            }

            // Evaluate width formula
            const widthResult = evaluateFormula(normalizedWidthFormula, { W: width, H: height });
            if (widthResult.error) {
                return { result: null, error: `Width formula evaluation error: ${widthResult.error}` };
            }

            // Evaluate height formula  
            const heightResult = evaluateFormula(normalizedHeightFormula, { W: width, H: height });
            if (heightResult.error) {
                return { result: null, error: `Height formula evaluation error: ${heightResult.error}` };
            }

            const adjustedWidth = widthResult.result;
            const adjustedHeight = heightResult.result;

            // Apply glass rounding logic for a single piece
            const roundingResult = calculateGlassAreaWithRounding(adjustedWidth, adjustedHeight, inputUnit, outputUnit);
            
            const areaPerPiece = roundingResult.area;
            const totalArea = areaPerPiece * glassQuantity;

            return { 
                result: totalArea,
                error: null,
                adjustedWidth: adjustedWidth,
                adjustedHeight: adjustedHeight,
                roundedWidth: roundingResult.roundedWidth,
                roundedHeight: roundingResult.roundedHeight,
                areaPerPiece: areaPerPiece,
                totalArea: totalArea,
                glassQuantity: glassQuantity
            };

        } catch (error) {
            return { result: null, error: `Calculation error: ${error.message}` };
        }
    }
}

module.exports = GlassFormulaService; 