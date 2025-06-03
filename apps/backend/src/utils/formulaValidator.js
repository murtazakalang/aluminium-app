const { validateFormulaString, evaluateFormula } = require('./formulaEvaluator');

/**
 * Validates glass area formulas with specific rules and allowed variables
 * @param {string} formula - The formula string to validate
 * @returns {{valid: boolean, error?: string}}
 */
const validateGlassFormula = (formula) => {
    if (!formula || typeof formula !== 'string') {
        return { valid: false, error: 'Formula is required and must be a string' };
    }

    // Trim whitespace
    const trimmedFormula = formula.trim();
    if (trimmedFormula === '') {
        return { valid: false, error: 'Formula cannot be empty' };
    }

    // Check for allowed characters only (W, H, numbers, operators, parentheses, decimal points, Math functions)
    const allowedPattern = /^[WHwh0-9+\-*/().\s,Math]+$/;
    if (!allowedPattern.test(trimmedFormula)) {
        return { 
            valid: false, 
            error: 'Formula can only contain variables W, H, numbers, mathematical operators (+, -, *, /, parentheses), and Math functions' 
        };
    }

    // Check for forbidden patterns
    const forbiddenPatterns = [
        { pattern: /[a-zA-Z](?![WHwh])/, message: 'Only variables W and H are allowed' },
        { pattern: /\/\s*0(?!\d)/, message: 'Division by zero is not allowed' },
        { pattern: /[+\-*/]{2,}/, message: 'Consecutive operators are not allowed' },
        { pattern: /^[+\-*/]/, message: 'Formula cannot start with an operator' },
        { pattern: /[+\-*/]$/, message: 'Formula cannot end with an operator' },
        { pattern: /\(\s*[+\-*/]/, message: 'Opening parenthesis cannot be followed by an operator' },
        { pattern: /[+\-*/]\s*\)/, message: 'Closing parenthesis cannot be preceded by an operator' }
    ];

    for (const { pattern, message } of forbiddenPatterns) {
        if (pattern.test(trimmedFormula)) {
            return { valid: false, error: message };
        }
    }

    // Check parentheses balance
    let parenCount = 0;
    for (const char of trimmedFormula) {
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
        if (parenCount < 0) {
            return { valid: false, error: 'Mismatched parentheses: closing parenthesis without opening' };
        }
    }
    if (parenCount !== 0) {
        return { valid: false, error: 'Mismatched parentheses: unclosed opening parenthesis' };
    }

    // Normalize formula (convert w/h to W/H)
    const normalizedFormula = trimmedFormula.replace(/w/g, 'W').replace(/h/g, 'H');

    // Use existing formula validator for syntax validation
    const syntaxValidation = validateFormulaString(normalizedFormula);
    if (!syntaxValidation.valid) {
        return { valid: false, error: `Syntax error: ${syntaxValidation.error}` };
    }

    return { valid: true };
};

/**
 * Tests a formula calculation with given dimensions
 * @param {string} formula - The formula to test
 * @param {Object} dimensions - Object with width and height
 * @param {number} dimensions.width - Width value
 * @param {number} dimensions.height - Height value
 * @returns {{result: number | null, error?: string}}
 */
const testFormulaCalculation = (formula, dimensions) => {
    const { width, height } = dimensions;

    // Validate inputs
    if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
        return { result: null, error: 'Width and height must be positive numbers' };
    }

    // Validate formula first
    const validation = validateGlassFormula(formula);
    if (!validation.valid) {
        return { result: null, error: validation.error };
    }

    try {
        // Normalize formula
        const normalizedFormula = formula.replace(/w/g, 'W').replace(/h/g, 'H');

        // Evaluate with test dimensions
        const evaluationResult = evaluateFormula(normalizedFormula, { W: width, H: height });
        
        if (evaluationResult.error) {
            return { result: null, error: `Evaluation error: ${evaluationResult.error}` };
        }

        if (evaluationResult.result < 0) {
            return { result: null, error: 'Formula result cannot be negative' };
        }

        return { result: evaluationResult.result, error: null };

    } catch (error) {
        return { result: null, error: `Calculation error: ${error.message}` };
    }
};

/**
 * Gets examples of valid glass formulas
 * @returns {Array} Array of example formulas with descriptions
 */
const getFormulaExamples = () => {
    return [
        {
            formula: 'W * H',
            description: 'Basic area calculation (width × height)',
            example: 'For 48" × 60" = 2880 sq.inches'
        },
        {
            formula: '(W - 4.75) * (H - 5)',
            description: 'Area with frame deduction',
            example: 'Subtracts frame thickness from dimensions'
        },
        {
            formula: '(W - 4.75) / 2 * (H - 5)',
            description: 'Area for multiple panes (divided by 2)',
            example: 'For sliding windows with two glass panes'
        },
        {
            formula: '(W * H) / 144',
            description: 'Convert square inches to square feet',
            example: 'Divides by 144 to convert to sqft'
        }
    ];
};

/**
 * Validates formula variables are only W and H
 * @param {string} formula - The formula to check
 * @returns {{valid: boolean, variables: string[], error?: string}}
 */
const validateFormulaVariables = (formula) => {
    const variables = formula.match(/[a-zA-Z]+/g) || [];
    const normalizedVariables = variables.map(v => v.toUpperCase());
    const allowedVariables = ['W', 'H'];
    
    const invalidVariables = normalizedVariables.filter(v => !allowedVariables.includes(v));
    
    if (invalidVariables.length > 0) {
        return {
            valid: false,
            variables: normalizedVariables,
            error: `Invalid variables found: ${invalidVariables.join(', ')}. Only W and H are allowed.`
        };
    }

    return {
        valid: true,
        variables: [...new Set(normalizedVariables)], // Remove duplicates
        error: null
    };
};

module.exports = {
    validateGlassFormula,
    testFormulaCalculation,
    getFormulaExamples,
    validateFormulaVariables
}; 