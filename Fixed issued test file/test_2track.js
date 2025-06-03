const GlassFormulaService = require('./src/services/glassFormulaService');

console.log('=== TESTING NEW SEPARATE FORMULA APPROACH ===');
console.log('2-Track Window Example:');
console.log('- Width Formula: (W - 4.75) / 2');
console.log('- Height Formula: H - 5');
console.log('- Glass Quantity: 2');
console.log('- Window Size: 48" x 60"');
console.log('');

const result2Track = GlassFormulaService.calculateGlassAreaWithQuantity(
    '(W - 4.75) / 2',  // Width formula
    'H - 5',           // Height formula  
    48,                // Window width
    60,                // Window height
    2,                 // Glass quantity (2 pieces)
    'inches',          // Input unit
    'sqft'             // Output unit
);

console.log('Result:', JSON.stringify(result2Track, null, 2));

if (!result2Track.error) {
    console.log('');
    console.log('📊 BREAKDOWN:');
    console.log('- Adjusted width per piece:', result2Track.adjustedWidth, 'inches');
    console.log('- Adjusted height per piece:', result2Track.adjustedHeight, 'inches');
    console.log('- Rounded width per piece:', result2Track.roundedWidth, 'inches');
    console.log('- Rounded height per piece:', result2Track.roundedHeight, 'inches');
    console.log('- Area per piece:', result2Track.areaPerPiece, 'sqft');
    console.log('- Number of pieces:', result2Track.glassQuantity);
    console.log('- Total area:', result2Track.totalArea, 'sqft');
}

console.log('');
console.log('=== COMPARISON WITH ORIGINAL APPROACH ===');

// Original single formula approach
const originalSingle = GlassFormulaService.calculateGlassArea(
    '((W - 4.75) / 2) * (H - 5)',
    48,
    60,
    'inches',
    'sqft'
);

console.log('Original single formula result:');
console.log('- Area for 1 piece:', originalSingle.result, 'sqft');
console.log('- Manual calculation for 2 pieces:', originalSingle.result ? originalSingle.result * 2 : 'N/A', 'sqft');

console.log('');
console.log('✅ NEW METHOD ADVANTAGES:');
console.log('- Clearer separation of width/height calculations');
console.log('- Exact quantity handling with proper rounding');
console.log('- Better for glass ordering optimization');
console.log('- Detailed breakdown for verification');

console.log('');
console.log('=== TESTING VARIOUS SCENARIOS ===');

// Test 3-track window
console.log('🪟 3-Track Window (3 pieces):');
const result3Track = GlassFormulaService.calculateGlassAreaWithQuantity(
    '(W - 6) / 3',     // Width divided by 3 with frame deduction
    'H - 5',           // Height with frame deduction
    60,                // Window width
    72,                // Window height  
    3,                 // Glass quantity (3 pieces)
    'inches',
    'sqft'
);
console.log('- Total area:', result3Track.result, 'sqft');
console.log('- Area per piece:', result3Track.areaPerPiece, 'sqft');
console.log('- Glass size per piece:', result3Track.roundedWidth + '" x ' + result3Track.roundedHeight + '"');

// Test single pane window
console.log('');
console.log('🪟 Single Pane Window (1 piece):');
const resultSingle = GlassFormulaService.calculateGlassAreaWithQuantity(
    'W - 1',           // Width with minimal frame
    'H - 1',           // Height with minimal frame
    36,                // Window width
    48,                // Window height
    1,                 // Glass quantity (1 piece)
    'inches',
    'sqft'
);
console.log('- Total area:', resultSingle.result, 'sqft');
console.log('- Glass size:', resultSingle.roundedWidth + '" x ' + resultSingle.roundedHeight + '"');

console.log('');
console.log('=== GLASS ORDERING OPTIMIZATION EXAMPLE ===');
console.log('For your 2-track window:');
console.log('- Order 2 pieces of glass, each ' + result2Track.roundedWidth + '" x ' + result2Track.roundedHeight + '"');
console.log('- Total area needed:', result2Track.totalArea, 'sqft');
console.log('- This gives you the exact dimensions for glass cutting!'); 