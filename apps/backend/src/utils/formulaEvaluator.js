const math = require('mathjs');

/**
 * Safely evaluates a mathematical formula string using mathjs.
 * 
 * @param {string} formula The formula string to evaluate (e.g., '(W * H) / 144').
 * @param {object} inputs An object containing variable assignments (e.g., { W: 10, H: 20 }).
 * @returns {{result: number | null, error: string | null}}
 */
function evaluateFormula(formula, inputs) {
    try {
        const node = math.parse(formula);
        const code = node.compile();
        const result = code.evaluate(inputs);

        if (typeof result !== 'number' || isNaN(result)) {
            return { result: null, error: 'Evaluation did not result in a valid number.' };
        }
        return { result, error: null };
    } catch (err) {
        return { result: null, error: err.message || 'Invalid formula syntax or evaluation error.' };
    }
}

/**
 * Validates a formula string by attempting a test evaluation.
 * 
 * @param {string} formula The formula string to validate.
 * @returns {{valid: boolean, error?: string}}
 */
function validateFormulaString(formula) {
    try {
        // Use placeholder values for W and H to test compilation and basic evaluation
        const testInputs = { W: 1, H: 1 }; 
        const node = math.parse(formula);
        const code = node.compile();
        code.evaluate(testInputs); // Try to evaluate with test inputs
        return { valid: true };
    } catch (err) {
        return { valid: false, error: err.message || 'Invalid formula syntax.' };
    }
}

module.exports = {
    evaluateFormula,
    validateFormulaString
}; 