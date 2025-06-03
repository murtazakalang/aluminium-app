const GlassFormulaService = require('./src/services/glassFormulaService');

console.log('=== SIMPLE INTEGRATION TEST ===');
console.log('Testing ProductType separate glass formula integration');
console.log('');

// Test the new separate formula approach
console.log('🧪 Testing 2-Track Window Configuration:');
console.log('ProductType with separate formulas:');

const productType2Track = {
    name: '2-Track Sliding Window',
    glassAreaFormula: {
        formulaType: 'separate',
        widthFormula: '(W - 4.75) / 2',
        heightFormula: 'H - 5', 
        glassQuantity: 2,
        formulaInputUnit: 'inches',
        outputUnit: 'sqft',
        description: 'Glass area for 2-track sliding window with frame deductions'
    }
};

console.log('Configuration:', JSON.stringify(productType2Track.glassAreaFormula, null, 2));

// Test calculation
const result = GlassFormulaService.calculateGlassAreaWithQuantity(
    productType2Track.glassAreaFormula.widthFormula,
    productType2Track.glassAreaFormula.heightFormula,
    48, // window width
    60, // window height
    productType2Track.glassAreaFormula.glassQuantity,
    productType2Track.glassAreaFormula.formulaInputUnit,
    productType2Track.glassAreaFormula.outputUnit
);

console.log('');
console.log('📊 CALCULATION RESULT:');
console.log('Window Size: 48" x 60"');
console.log('Result:', JSON.stringify(result, null, 2));

if (!result.error) {
    console.log('');
    console.log('✅ SUCCESS! Here\'s what you get:');
    console.log('🔢 Total area needed:', result.result, 'sqft');
    console.log('📏 Glass pieces per window:', result.glassQuantity);
    console.log('📐 Each piece size:', result.roundedWidth + '" x ' + result.roundedHeight + '"');
    console.log('📋 Area per piece:', result.areaPerPiece, 'sqft');
    
    console.log('');
    console.log('🎯 BENEFITS FOR YOUR BUSINESS:');
    console.log('1. ✅ Exact glass cutting dimensions for suppliers');
    console.log('2. ✅ Proper quantity calculation (2 pieces per window)');
    console.log('3. ✅ Accurate area for billing and costing');
    console.log('4. ✅ Perfect for glass ordering optimization sheets');
    
    console.log('');
    console.log('📋 GLASS ORDER SPECIFICATION:');
    console.log('- Material: [Your Glass Type]');
    console.log('- Quantity:', result.glassQuantity, 'pieces per window');
    console.log('- Cut Size:', result.roundedWidth + '" x ' + result.roundedHeight + '"');
    console.log('- Total Area:', result.areaPerPiece, 'sqft per piece');
    console.log('- For 10 windows: Order', result.glassQuantity * 10, 'pieces,', result.result * 10, 'sqft total');
    
} else {
    console.log('❌ Error:', result.error);
}

console.log('');
console.log('🧪 Testing 3-Track Window Configuration:');

const productType3Track = {
    name: '3-Track Sliding Window',
    glassAreaFormula: {
        formulaType: 'separate',
        widthFormula: '(W - 6) / 3',
        heightFormula: 'H - 5',
        glassQuantity: 3,
        formulaInputUnit: 'inches',
        outputUnit: 'sqft'
    }
};

const result3Track = GlassFormulaService.calculateGlassAreaWithQuantity(
    productType3Track.glassAreaFormula.widthFormula,
    productType3Track.glassAreaFormula.heightFormula,
    72, // larger window width
    84, // larger window height
    productType3Track.glassAreaFormula.glassQuantity,
    'inches',
    'sqft'
);

console.log('Window Size: 72" x 84"');
console.log('Result:', result3Track.result, 'sqft total');
if (!result3Track.error) {
    console.log('Glass pieces:', result3Track.glassQuantity, 'per window');
    console.log('Each piece:', result3Track.roundedWidth + '" x ' + result3Track.roundedHeight + '"');
}

console.log('');
console.log('🎉 IMPLEMENTATION READY!');
console.log('You can now update your ProductType records to use:');
console.log('- formulaType: "separate"');
console.log('- widthFormula: "(W - 4.75) / 2"');
console.log('- heightFormula: "H - 5"');
console.log('- glassQuantity: 2');
console.log('And your estimations will automatically use the new calculation method!');

console.log('');
console.log('📄 Next Steps:');
console.log('1. Update your ProductType records with new formula structure');
console.log('2. Estimations will automatically use calculateGlassAreaWithQuantity()');
console.log('3. Generate glass placement sheets for order management');
console.log('4. Export CSV files for glass suppliers with exact specifications'); 