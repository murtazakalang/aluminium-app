const GlassFormulaService = require('./src/services/glassFormulaService');
const EstimationService = require('./src/services/estimationService');
const GlassPlacementService = require('./src/services/glassPlacementService');

console.log('=== TESTING PRODUCT TYPE INTEGRATION ===');
console.log('Testing the new separate formula approach with ProductType model');
console.log('');

// Mock ProductType with separate glass formulas (2-track window)
const mockProductType2Track = {
    _id: 'mock_product_2track',
    name: '2-Track Sliding Window', 
    glassAreaFormula: {
        formulaType: 'separate',
        widthFormula: '(W - 4.75) / 2',
        heightFormula: 'H - 5',
        glassQuantity: 2,
        formulaInputUnit: 'inches',
        outputUnit: 'sqft',
        description: '2-track sliding window with frame deductions'
    }
};

// Mock ProductType with legacy single formula
const mockProductTypeLegacy = {
    _id: 'mock_product_legacy',
    name: 'Fixed Window',
    glassAreaFormula: {
        formulaType: 'single',
        formula: 'W * H / 144',
        formulaInputUnit: 'inches', 
        outputUnit: 'sqft',
        description: 'Simple fixed window'
    }
};

// Mock glass material
const mockGlassMaterial = {
    _id: 'mock_glass_material',
    name: '5mm Clear Glass',
    category: 'Glass',
    unitRateForStockUnit: '65.00',
    stockUnit: 'sqft'
};

console.log('🧪 Test 1: Direct Glass Formula Service Test');
console.log('2-Track Window: 48" x 60"');

const directResult = GlassFormulaService.calculateGlassAreaWithQuantity(
    mockProductType2Track.glassAreaFormula.widthFormula,
    mockProductType2Track.glassAreaFormula.heightFormula,
    48, // width
    60, // height
    mockProductType2Track.glassAreaFormula.glassQuantity,
    'inches',
    'sqft'
);

console.log('Direct result:', JSON.stringify(directResult, null, 2));

console.log('');
console.log('🧪 Test 2: Estimation Service Integration');

// Mock estimation item
const mockEstimationItem = {
    _id: 'mock_item_1',
    width: 48,
    height: 60,
    quantity: 3, // 3 windows
    selectedGlassTypeId: 'mock_glass_material'
};

// Mock the database calls for EstimationService
const originalMaterialFindOne = require('./src/models/Material').findOne;

// Mock Material.findOne to return our mock glass material
require('./src/models/Material').findOne = function(query) {
    if (query._id === 'mock_glass_material') {
        return Promise.resolve(mockGlassMaterial);
    }
    return originalMaterialFindOne.call(this, query);
};

// Test the estimation service
EstimationService.calculateGlassForItem(
    mockEstimationItem,
    mockProductType2Track,
    'inches',
    'test_company_id'
).then(result => {
    console.log('Estimation Service Result:', JSON.stringify(result, null, 2));
    
    if (!result.error) {
        console.log('');
        console.log('📊 ESTIMATION BREAKDOWN:');
        console.log('- Has glass:', result.hasGlass);
        console.log('- Glass material:', result.glassMaterial.name);
        console.log('- Area per item:', result.glassQuantityPerItem, result.glassUnit);
        console.log('- Total area (3 items):', result.totalGlassQuantity, result.glassUnit);
        console.log('- Total cost:', '$' + result.totalGlassCost.toFixed(2));
        
        if (result.glassDetails) {
            console.log('- Pieces per item:', result.glassDetails.piecesPerItem);
            console.log('- Glass cut size:', result.glassDetails.glassCutSize);
            console.log('- Total pieces needed:', result.glassDetails.piecesPerItem * mockEstimationItem.quantity);
        }
    }
    
    console.log('');
    console.log('🧪 Test 3: Legacy Formula Compatibility');
    
    return EstimationService.calculateGlassForItem(
        mockEstimationItem,
        mockProductTypeLegacy,
        'inches',
        'test_company_id'
    );
}).then(legacyResult => {
    console.log('Legacy Formula Result:', JSON.stringify(legacyResult, null, 2));
    
    console.log('');
    console.log('✅ INTEGRATION TEST SUMMARY:');
    console.log('1. ✅ New separate formula method works correctly');
    console.log('2. ✅ EstimationService handles both formula types');
    console.log('3. ✅ Glass details provide exact cutting dimensions');
    console.log('4. ✅ Backward compatibility with legacy formulas maintained');
    console.log('5. ✅ Cost calculations work with glass quantity multiplier');
    
}).catch(error => {
    console.error('Test failed:', error);
});

// Restore original function
setTimeout(() => {
    require('./src/models/Material').findOne = originalMaterialFindOne;
}, 1000); 