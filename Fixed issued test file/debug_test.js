const GlassFormulaService = require('./src/services/glassFormulaService');
const { roundGlassArea } = require('./src/utils/glassRoundingUtils');
const { evaluateFormula } = require('./src/utils/formulaEvaluator');

console.log('Testing formula: ((W - 4.75) / 2) * (H - 5)');
console.log('Width: 48, Height: 60');

// Test multiple regex patterns
const formula = '((W - 4.75) / 2) * (H - 5)';

const patterns = [
    {
        name: 'Pattern 1 (original)',
        regex: /^\s*\(?\s*([^)]*W[^)]*)\s*\)?\s*(?:\/\s*(\d+(?:\.\d+)?))?\s*\*\s*\(?\s*([^)]*H[^)]*)\s*\)?$/,
    },
    {
        name: 'Pattern 2 (my attempt)',
        regex: /^\s*\(?\s*\(?\s*([^)]*W[^)]*)\s*\)?\s*\)?\s*\*\s*\(?\s*([^)]*H[^)]*)\s*\)?\s*$/,
    },
    {
        name: 'Pattern 3 (wider capture)',
        regex: /^\s*\((.+?W.+?)\)\s*\*\s*\((.+?H.+?)\)\s*$/,
    },
    {
        name: 'Pattern 4 (simple split)',
        regex: /^(.+W.+?)\s*\*\s*(.+H.+?)$/,
    }
];

patterns.forEach(pattern => {
    const match = formula.match(pattern.regex);
    console.log(`\n${pattern.name}:`);
    console.log('Match:', match);
    if (match) {
        console.log('Group 1 (width):', match[1]);
        console.log('Group 2 (height):', match[2]);
        if (match[3]) console.log('Group 3:', match[3]);
    }
});

console.log('=== EXACT TEST CASE ===');
const result = GlassFormulaService.calculateGlassArea(
    '((W - 4.75) / 2) * (H - 5)',
    48,
    60,
    'inches',
    'sqft'
);

console.log('result.error:', result.error);
console.log('result.result:', result.result);
console.log('Complete result:', JSON.stringify(result, null, 2));

// Test area rounding specifically
console.log('\n--- Testing area rounding ---');
console.log('roundGlassArea(9.5, "sqft"):', roundGlassArea(9.5, 'sqft'));
console.log('roundGlassArea(9.0, "sqft"):', roundGlassArea(9.0, 'sqft'));
console.log('roundGlassArea(9.25, "sqft"):', roundGlassArea(9.25, 'sqft'));

// Manual calculation check
const { calculateGlassAreaWithRounding } = require('./src/utils/glassRoundingUtils');

console.log('\n--- Manual calculation ---');
const adjustedWidth = (48 - 4.75) / 2; // 21.625
const adjustedHeight = 60 - 5; // 55

console.log('Adjusted width:', adjustedWidth);
console.log('Adjusted height:', adjustedHeight);

const roundingResult = calculateGlassAreaWithRounding(adjustedWidth, adjustedHeight, 'inches', 'sqft');
console.log('Rounding result:', roundingResult);

console.log('=== TESTING MATH FUNCTION SYNTAX ===');

const mathFormulas = [
    'Math.max(W * H / 144, 1)',
    'max(W * H / 144, 1)',
    'Math.max(W * H, 144)',
    'max(W * H, 144)'
];

mathFormulas.forEach(formula => {
    console.log(`\nTesting formula: "${formula}"`);
    const evaluation = evaluateFormula(formula, { W: 12, H: 12 });
    console.log('Evaluation result:', evaluation);
});

console.log('\n=== TESTING FORMULA VALIDATION ===');

const formulas = [
    'W * H',
    '((W - 4.75) / 2) * (H - 5)',
    'max(W * H / 144, 1)'
];

formulas.forEach(formula => {
    console.log(`\nTesting formula: "${formula}"`);
    const validation = GlassFormulaService.validateFormula(formula);
    console.log('Validation result:', validation);
});

console.log('\n=== TESTING CALCULATION ===');
const simpleResult = GlassFormulaService.calculateGlassArea(
    'W * H',
    48,
    60,
    'inches',
    'sqft'
);

console.log('Simple W * H result:', JSON.stringify(simpleResult, null, 2));

console.log('=== TESTING MATH FUNCTION VALIDATION AND CALCULATION ===');

const mathFormula = 'Math.max(W * H / 144, 1)';
console.log(`\nTesting formula: "${mathFormula}"`);

const validation = GlassFormulaService.validateFormula(mathFormula);
console.log('Validation result:', validation);

if (validation.valid) {
    const result = GlassFormulaService.calculateGlassArea(
        mathFormula,
        12, // small width
        12, // small height
        'inches',
        'sqft'
    );
    console.log('Calculation result:', JSON.stringify(result, null, 2));
}

console.log('\n=== TESTING ORIGINAL FORMULA ===');
const originalResult = GlassFormulaService.calculateGlassArea(
    '((W - 4.75) / 2) * (H - 5)',
    48,
    60,
    'inches',
    'sqft'
);

console.log('Original formula result:', JSON.stringify(originalResult, null, 2));

console.log('=== DEBUGGING NORMALIZATION ===');

const testFormula = 'Math.max(W * H / 144, 1)';
console.log('Original formula:', testFormula);

// Step 1: Replace w/h with W/H
let step1 = testFormula.replace(/w/g, 'W').replace(/h/g, 'H');
console.log('After case normalization:', step1);

// Step 2: Replace Math. with empty
let step2 = step1.replace(/Math\./g, '');
console.log('After Math. removal:', step2);

// Test direct evaluation
const evalResult = evaluateFormula(step2, { W: 12, H: 12 });
console.log('Direct evaluation result:', evalResult);

console.log('\n=== TESTING SERVICE VALIDATION ===');
const testValidation = GlassFormulaService.validateFormula(testFormula);
console.log('Service validation result:', testValidation);

console.log('=== TESTING MATH FUNCTION UNIT CONVERSION ===');

// Test with 12x12 inches - should give max(1, 1) = 1 sqft
const mathResult1 = GlassFormulaService.calculateGlassArea(
    'Math.max(W * H / 144, 1)',
    12, // width
    12, // height
    'inches',
    'sqft'
);
console.log('12x12 Math.max result:', JSON.stringify(mathResult1, null, 2));
console.log('Expected: 1 sqft, Got:', mathResult1.result);

// Test with larger dimensions
const mathResult2 = GlassFormulaService.calculateGlassArea(
    'Math.max(W * H / 144, 1)',
    48, // width
    60, // height
    'inches',
    'sqft'
);
console.log('48x60 Math.max result:', JSON.stringify(mathResult2, null, 2));
console.log('Expected: 20 sqft, Got:', mathResult2.result);

console.log('\n=== TESTING ORIGINAL FORMULA ===');
const originalResult = GlassFormulaService.calculateGlassArea(
    '((W - 4.75) / 2) * (H - 5)',
    48,
    60,
    'inches',
    'sqft'
);

console.log('Original formula result:', JSON.stringify(originalResult, null, 2)); 