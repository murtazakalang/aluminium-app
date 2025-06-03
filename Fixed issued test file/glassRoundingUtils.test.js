const { 
    roundGlassDimension, 
    roundGlassArea, 
    calculateGlassAreaWithRounding,
    formatDimension,
    formatArea
} = require('../src/utils/glassRoundingUtils');

describe('Glass Rounding Utils', () => {
    describe('roundGlassDimension', () => {
        describe('inches rounding', () => {
            test('should round up to nearest 3 inches', () => {
                expect(roundGlassDimension(21.625, 'inches')).toBe(24);
                expect(roundGlassDimension(22, 'inches')).toBe(24);
                expect(roundGlassDimension(24, 'inches')).toBe(24);
                expect(roundGlassDimension(25, 'inches')).toBe(27);
                expect(roundGlassDimension(55, 'inches')).toBe(57);
            });

            test('should handle edge cases', () => {
                expect(roundGlassDimension(3, 'inches')).toBe(3);
                expect(roundGlassDimension(0.1, 'inches')).toBe(3);
                expect(roundGlassDimension(2.99, 'inches')).toBe(3);
            });
        });

        describe('mm rounding', () => {
            test('should round up to nearest 76.2mm (3 inches)', () => {
                expect(roundGlassDimension(549.275, 'mm')).toBe(609.6); // 21.625" -> 24"
                expect(roundGlassDimension(76.2, 'mm')).toBe(76.2);
                expect(roundGlassDimension(77, 'mm')).toBe(152.4);
                expect(roundGlassDimension(1397, 'mm')).toBe(1447.8); // 55" -> 57" (57*25.4=1447.8)
            });
        });

        describe('feet rounding', () => {
            test('should convert to inches, round, then convert back', () => {
                expect(roundGlassDimension(1.8, 'ft')).toBe(2.0); // 1.8ft = 21.6" -> 24" = 2ft
                expect(roundGlassDimension(4.583, 'ft')).toBe(4.75); // 4.583ft = 55" -> 57" = 4.75ft
            });
        });

        describe('invalid inputs', () => {
            test('should return original value for invalid inputs', () => {
                expect(roundGlassDimension(-5, 'inches')).toBe(-5);
                expect(roundGlassDimension(0, 'inches')).toBe(0);
                expect(roundGlassDimension('invalid', 'inches')).toBe('invalid');
            });

            test('should return original value for unknown units', () => {
                expect(roundGlassDimension(21.625, 'unknown')).toBe(21.625);
            });
        });
    });

    describe('roundGlassArea', () => {
        describe('sqft rounding', () => {
            test('should round according to billing scale', () => {
                // .00 – .25 ➝ .25
                expect(roundGlassArea(8.0, 'sqft')).toBe(8.25);
                expect(roundGlassArea(8.1, 'sqft')).toBe(8.25);
                expect(roundGlassArea(8.25, 'sqft')).toBe(8.25);
                
                // .251 – .50 ➝ .50
                expect(roundGlassArea(8.251, 'sqft')).toBe(8.50);
                expect(roundGlassArea(8.3, 'sqft')).toBe(8.50);
                expect(roundGlassArea(8.50, 'sqft')).toBe(8.50);
                
                // .501 – .75 ➝ .75
                expect(roundGlassArea(8.501, 'sqft')).toBe(8.75);
                expect(roundGlassArea(8.6, 'sqft')).toBe(8.75);
                expect(roundGlassArea(8.75, 'sqft')).toBe(8.75);
                
                // .751 – .999 ➝ next whole number
                expect(roundGlassArea(8.751, 'sqft')).toBe(9);
                expect(roundGlassArea(8.9, 'sqft')).toBe(9);
                expect(roundGlassArea(8.999, 'sqft')).toBe(9);
            });

            test('should handle the examples from requirements', () => {
                expect(roundGlassArea(8.2595, 'sqft')).toBe(8.50);
                expect(roundGlassArea(15.576, 'sqft')).toBe(15.75);
                expect(roundGlassArea(18.27, 'sqft')).toBe(18.50);
            });
        });

        describe('sqm rounding', () => {
            test('should round with finer increments', () => {
                expect(roundGlassArea(1.01, 'sqm')).toBe(1.025);
                expect(roundGlassArea(1.03, 'sqm')).toBe(1.05);
                expect(roundGlassArea(1.06, 'sqm')).toBe(1.075);
                expect(roundGlassArea(1.08, 'sqm')).toBe(1.1);
            });
        });

        describe('invalid inputs', () => {
            test('should return original value for invalid inputs', () => {
                expect(roundGlassArea(-5, 'sqft')).toBe(-5);
                expect(roundGlassArea(0, 'sqft')).toBe(0);
                expect(roundGlassArea('invalid', 'sqft')).toBe('invalid');
            });
        });
    });

    describe('calculateGlassAreaWithRounding', () => {
        test('should apply complete rounding flow for inches to sqft', () => {
            // Test the example from requirements:
            // Adjusted W = 21.625 inches -> 24 inches
            // Adjusted H = 55 inches -> 57 inches
            // Area = (24 / 12) * (57 / 12) = 2 * 4.75 = 9.5 sqft
            const result = calculateGlassAreaWithRounding(21.625, 55, 'inches', 'sqft');
            
            expect(result.roundedWidth).toBe(24);
            expect(result.roundedHeight).toBe(57);
            expect(result.area).toBe(9.5); // 9.5 rounds to 9.75 according to our scale
        });

        test('should handle mm to sqm conversion', () => {
            const result = calculateGlassAreaWithRounding(549.275, 1397, 'mm', 'sqm');
            
            expect(result.roundedWidth).toBe(609.6); // 24 inches in mm
            expect(result.roundedHeight).toBe(1447.8); // 57 inches in mm
            // Area = 609.6 * 1447.2 / 1000000 = 0.882 sqm -> rounds to 1.025
            expect(result.area).toBeGreaterThan(0.8);
            expect(result.area).toBeLessThan(1.1);
        });

        test('should handle simple case without adjustment', () => {
            const result = calculateGlassAreaWithRounding(48, 60, 'inches', 'sqft');
            
            expect(result.roundedWidth).toBe(48); // Already multiple of 3
            expect(result.roundedHeight).toBe(60); // Already multiple of 3
            expect(result.area).toBe(20.25); // 48*60/144 = 20 -> rounds to 20.25
        });
    });

    describe('formatting functions', () => {
        test('formatDimension should format dimension with unit', () => {
            expect(formatDimension(24.5, 'inches')).toBe('24.50 inches');
            expect(formatDimension(609.6, 'mm')).toBe('609.60 mm');
        });

        test('formatArea should format area with unit', () => {
            expect(formatArea(8.75, 'sqft')).toBe('8.75 sqft');
            expect(formatArea(1.025, 'sqm')).toBe('1.02 sqm');
        });
    });
});

describe('Glass Rounding Integration Examples', () => {
    test('should match the exact example from requirements', () => {
        // Test formula: (W - 4.75)/2 * (H - 5)
        // Width = 48, Height = 60
        // Current calculation: (48 - 4.75)/2 = 21.625, (60 - 5) = 55
        // Expected: 21.625 -> 24, 55 -> 57
        // Area: (24/12) * (57/12) = 2 * 4.75 = 9.5 sqft -> rounds to 9.75
        
        const adjustedWidth = (48 - 4.75) / 2; // 21.625
        const adjustedHeight = 60 - 5; // 55
        
        const result = calculateGlassAreaWithRounding(adjustedWidth, adjustedHeight, 'inches', 'sqft');
        
        expect(result.roundedWidth).toBe(24);
        expect(result.roundedHeight).toBe(57);
        expect(result.area).toBe(9.50); // 9.5 rounds to 9.50 according to scale (.5 -> .50)
    });

    test('should handle various formula results correctly', () => {
        // Test different intermediate results
        const testCases = [
            { width: 43.25, height: 55, expectedWidth: 45, expectedHeight: 57 },
            { width: 20, height: 48.5, expectedWidth: 21, expectedHeight: 51 },
            { width: 12.1, height: 36.7, expectedWidth: 15, expectedHeight: 39 }
        ];

        testCases.forEach(({ width, height, expectedWidth, expectedHeight }) => {
            const result = calculateGlassAreaWithRounding(width, height, 'inches', 'sqft');
            expect(result.roundedWidth).toBe(expectedWidth);
            expect(result.roundedHeight).toBe(expectedHeight);
            expect(result.area).toBeGreaterThan(0);
        });
    });
}); 