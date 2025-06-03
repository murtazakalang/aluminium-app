const GlassFormulaService = require('../src/services/glassFormulaService');
const { validateGlassFormula } = require('../src/utils/formulaValidator');

describe('Glass Formula Service', () => {
    describe('validateFormula', () => {
        test('should validate basic glass formula', () => {
            const result = GlassFormulaService.validateFormula('W * H');
            expect(result.valid).toBe(true);
        });

        test('should validate complex glass formula', () => {
            const result = GlassFormulaService.validateFormula('(W - 4.75) * (H - 5) / 144');
            expect(result.valid).toBe(true);
        });

        test('should reject formula with invalid variables', () => {
            const result = GlassFormulaService.validateFormula('W * H * Z');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Formula can only contain variables W, H');
        });

        test('should reject empty formula', () => {
            const result = GlassFormulaService.validateFormula('');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('required');
        });

        test('should reject malformed formula', () => {
            const result = GlassFormulaService.validateFormula('W * )');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Value expected');
        });
    });

    describe('calculateGlassArea', () => {
        test('should calculate basic area in square feet', () => {
            const result = GlassFormulaService.calculateGlassArea(
                'W * H',
                48, // width in inches
                60, // height in inches
                'inches',
                'sqft'
            );
            expect(result.error).toBeNull();
            expect(result.result).toBeCloseTo(20.25); // 48*60/144 = 20 sqft -> rounds to 20.25
        });

        test('should calculate area with frame deduction', () => {
            const result = GlassFormulaService.calculateGlassArea(
                '(W - 4.75) * (H - 5)',
                48, // width in inches
                60, // height in inches
                'inches',
                'sqin'
            );
            expect(result.error).toBeNull();
            expect(result.result).toBeCloseTo(2565); // (48-4.75)*(60-5) = 43.25*55 -> rounds to 45*57 = 2565 sqin
        });

        test('should handle unit conversion from inches to square meters', () => {
            const result = GlassFormulaService.calculateGlassArea(
                'W * H',
                48, // width in inches
                60, // height in inches
                'inches',
                'sqm'
            );
            expect(result.error).toBeNull();
            expect(result.result).toBeCloseTo(1.9); // 20.25 sqft ≈ 1.9 sqm (with rounding)
        });

        test('should handle mm to sqft conversion', () => {
            const result = GlassFormulaService.calculateGlassArea(
                'W * H',
                1219, // width in mm (48 inches)
                1524, // height in mm (60 inches)
                'mm',
                'sqft'
            );
            expect(result.error).toBeNull();
            expect(result.result).toBeCloseTo(20.25, 1); // Should be close to 20.25 sqft (with rounding)
        });

        test('should handle division for multiple panes', () => {
            const result = GlassFormulaService.calculateGlassArea(
                '((W - 4.75) / 2) * (H - 5)',
                48, // width in inches
                60, // height in inches
                'inches',
                'sqft'
            );
            expect(result.error).toBeNull();
            expect(result.result).toBeCloseTo(9.50); // (48-4.75)/2=21.625->24, (60-5)=55->57, 24*57/144=9.5->9.50 sqft
        });

        test('should return error for invalid formula', () => {
            const result = GlassFormulaService.calculateGlassArea(
                'W * H * Z',
                48,
                60,
                'inches',
                'sqft'
            );
            expect(result.error).toBeDefined();
        });

        test('should handle minimum area with Math.max', () => {
            const result = GlassFormulaService.calculateGlassArea(
                'Math.max(W * H / 144, 1)',
                12, // small width
                12, // small height
                'inches',
                'sqft'
            );
            expect(result.error).toBeNull();
            expect(result.result).toBe(1); // Math.max(1, 1) = 1
        });

        test('should calculate glass area with separate formulas and quantity', () => {
            const result = GlassFormulaService.calculateGlassAreaWithQuantity(
                '(W - 4.75) / 2', // Width formula for 2-track
                'H - 5',          // Height formula
                48,               // Window width
                60,               // Window height  
                2,                // Glass quantity
                'inches',
                'sqft'
            );
            expect(result.error).toBeNull();
            expect(result.adjustedWidth).toBe(21.625); // (48 - 4.75) / 2
            expect(result.adjustedHeight).toBe(55);     // 60 - 5
            expect(result.roundedWidth).toBe(24);       // 21.625 -> 24
            expect(result.roundedHeight).toBe(57);      // 55 -> 57
            expect(result.areaPerPiece).toBe(9.5);      // 24*57/144 = 9.5
            expect(result.glassQuantity).toBe(2);
            expect(result.totalArea).toBe(19);          // 9.5 * 2
            expect(result.result).toBe(19);             // Same as totalArea
        });

        test('should handle 3-track window with separate formulas', () => {
            const result = GlassFormulaService.calculateGlassAreaWithQuantity(
                '(W - 6) / 3',    // Width divided by 3
                'H - 5',          // Height with frame deduction
                60,               // Window width
                72,               // Window height
                3,                // Glass quantity (3 pieces)
                'inches',
                'sqft'
            );
            expect(result.error).toBeNull();
            expect(result.adjustedWidth).toBe(18);      // (60 - 6) / 3 = 18
            expect(result.adjustedHeight).toBe(67);     // 72 - 5 = 67
            expect(result.roundedWidth).toBe(18);       // 18 -> 18 (already multiple of 3)
            expect(result.roundedHeight).toBe(69);      // 67 -> 69
            expect(result.glassQuantity).toBe(3);
            expect(result.areaPerPiece).toBe(8.75);     // 18*69/144 = 8.625 -> 8.75
            expect(result.totalArea).toBe(26.25);       // 8.75 * 3
        });

        test('should return error for invalid width formula', () => {
            const result = GlassFormulaService.calculateGlassAreaWithQuantity(
                'W * Z',          // Invalid variable Z
                'H - 5',
                48,
                60,
                2,
                'inches',
                'sqft'
            );
            expect(result.error).toContain('Width formula error');
        });

        test('should return error for invalid glass quantity', () => {
            const result = GlassFormulaService.calculateGlassAreaWithQuantity(
                'W - 1',
                'H - 1',
                48,
                60,
                0,                // Invalid quantity
                'inches',
                'sqft'
            );
            expect(result.error).toContain('Glass quantity must be a positive number');
        });
    });

    describe('testFormula', () => {
        test('should test formula with sample dimensions', () => {
            const result = GlassFormulaService.testFormula(
                'W * H / 144',
                [
                    { width: 48, height: 60 },
                    { width: 36, height: 48 },
                    { width: 24, height: 36 }
                ]
            );

            expect(result.results).toHaveLength(3);
            expect(result.results[0].result).toBeCloseTo(20.25);
            expect(result.results[1].result).toBeCloseTo(12.25);
            expect(result.results[2].result).toBeCloseTo(6.25);
        });

        test('should handle errors in test dimensions', () => {
            const result = GlassFormulaService.testFormula(
                'W * H * Z', // Invalid formula
                [{ width: 48, height: 60 }]
            );

            expect(result.error).toBeDefined();
        });
    });
});

describe('Glass Formula Validator', () => {
    test('should validate correct glass formula', () => {
        const result = validateGlassFormula('(W - 4.75) * (H - 5.25)');
        expect(result.valid).toBe(true);
    });

    test('should reject formula with invalid variables', () => {
        const result = validateGlassFormula('W * H * L');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('invalid characters');
    });

    test('should allow mathematical functions', () => {
        const result = validateGlassFormula('Math.max(W * H, 10)');
        expect(result.valid).toBe(true);
    });

    test('should handle case insensitive variables', () => {
        const result = validateGlassFormula('w * h');
        expect(result.valid).toBe(true);
    });

    test('should validate complex nested formulas', () => {
        const result = validateGlassFormula('(W - 4.75) / 2 * (H - 5) + Math.min(W * 0.1, 2)');
        expect(result.valid).toBe(true);
    });
});

// Mock data for integration tests
const mockMaterial = {
    _id: '507f1f77bcf86cd799439011',
    name: '5mm Clear Glass',
    category: 'Glass',
    unitRateForStockUnit: '65.00',
    stockUnit: 'sqft',
    totalStockQuantity: '1000.00',
    isActive: true
};

const mockProductType = {
    _id: '507f1f77bcf86cd799439012',
    name: '3Track Sliding Window',
    glassAreaFormula: {
        formula: '(W - 4.75) / 2 * (H - 5)',
        formulaInputUnit: 'inches',
        outputUnit: 'sqft',
        description: 'Glass area for 3-track sliding window with frame deduction'
    }
};

describe('Glass Formula Integration', () => {
    test('should calculate glass area and cost for estimation item', async () => {
        // Mock the Material.findOne call
        jest.mock('../src/models/Material');
        const Material = require('../src/models/Material');
        Material.findOne = jest.fn().mockResolvedValue(mockMaterial);

        const EstimationService = require('../src/services/estimationService');
        
        const mockItem = {
            _id: '507f1f77bcf86cd799439013',
            width: { toString: () => '48' },
            height: { toString: () => '60' },
            quantity: 2,
            selectedGlassTypeId: mockMaterial._id
        };

        const result = await EstimationService.calculateGlassForItem(
            mockItem,
            mockProductType,
            'inches',
            'test_company_id'
        );

        expect(result.hasGlass).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.glassMaterial).toBeDefined();
        expect(result.glassQuantityPerItem).toBeCloseTo(11.89); // (48-4.75)/2*(60-5)/144
        expect(result.totalGlassQuantity).toBeCloseTo(23.78); // 11.89 * 2
        expect(result.totalGlassCost).toBeCloseTo(1545.70); // 23.78 * 65
    });

    test('should handle product type without glass formula', async () => {
        const EstimationService = require('../src/services/estimationService');
        
        const mockItemNoGlass = {
            width: { toString: () => '48' },
            height: { toString: () => '60' },
            quantity: 1
        };

        const mockProductTypeNoGlass = {
            name: 'Basic Profile',
            glassAreaFormula: { formula: '' }
        };

        const result = await EstimationService.calculateGlassForItem(
            mockItemNoGlass,
            mockProductTypeNoGlass,
            'inches',
            'test_company_id'
        );

        expect(result.hasGlass).toBe(false);
    });
}); 