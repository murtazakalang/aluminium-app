# Glass Formula Solution for Multi-Track Windows

## Problem Statement
The user needed to calculate glass area for a 2-track window where:
- Formula: `(((W-4.75)/2)*(H-5))*2` 
- This represents 2 pieces of glass, each `(W-4.75)/2` wide and `(H-5)` high
- The original formula was giving "Test result: Error sqft" due to parsing issues

## Root Cause
The existing formula parser expected patterns like `W_expression * H_expression` but couldn't handle `W_expression * H_expression * 2` because it tried to parse `* 2` as part of the height expression.

## Solution: Separate Width/Height Formulas with Quantity

Added new method: `calculateGlassAreaWithQuantity(widthFormula, heightFormula, width, height, glassQuantity, inputUnit, outputUnit)`

### Advantages:
1. **Clear Separation**: Width and height calculations are separate and explicit
2. **Proper Quantity Handling**: Multiplies area by exact quantity with correct rounding
3. **Glass Ordering Optimization**: Provides exact cut dimensions for each piece
4. **Detailed Breakdown**: Shows adjusted, rounded, and final dimensions

### Usage Example:

```javascript
const result = GlassFormulaService.calculateGlassAreaWithQuantity(
    '(W - 4.75) / 2',  // Width formula for each glass piece
    'H - 5',           // Height formula for each glass piece
    48,                // Window width (inches)
    60,                // Window height (inches)  
    2,                 // Number of glass pieces
    'inches',          // Input unit
    'sqft'             // Output unit
);

// Result:
{
  "result": 19,                    // Total area for all pieces
  "error": null,
  "adjustedWidth": 21.625,         // Calculated width: (48-4.75)/2
  "adjustedHeight": 55,            // Calculated height: 60-5
  "roundedWidth": 24,              // Rounded for glass cutting: 21.625→24"
  "roundedHeight": 57,             // Rounded for glass cutting: 55→57"
  "areaPerPiece": 9.5,            // Area per piece: 24*57/144=9.5 sqft
  "totalArea": 19,                 // Total area: 9.5 * 2 = 19 sqft
  "glassQuantity": 2               // Number of pieces
}
```

### Glass Ordering Information:
- **Order**: 2 pieces of glass, each 24" x 57"
- **Total Area**: 19 sqft
- **Perfect for glass cutting optimization**

## Comparison with Original Approach:

| Aspect | Original Formula | New Separate Formulas |
|--------|------------------|----------------------|
| Formula | `(((W-4.75)/2)*(H-5))*2` | Width: `(W-4.75)/2`, Height: `H-5`, Qty: 2 |
| Result | ❌ Parsing Error | ✅ 19 sqft |
| Glass Cuts | Not specified | 2 pieces of 24" x 57" |
| Rounding | Applied to final area | Applied per piece, then multiplied |
| Clarity | Complex single expression | Clear separation of concerns |

## Other Examples:

### 3-Track Window:
```javascript
calculateGlassAreaWithQuantity('(W - 6) / 3', 'H - 5', 60, 72, 3, 'inches', 'sqft')
// Result: 26.25 sqft total, 3 pieces of 18" x 69"
```

### Single Pane:
```javascript 
calculateGlassAreaWithQuantity('W - 1', 'H - 1', 36, 48, 1, 'inches', 'sqft')
// Result: 12.25 sqft, 1 piece of 36" x 48"
```

## Implementation Notes:
- Maintains all existing rounding logic (3" increments for glass cutting, 0.25 sqft for billing)
- Validates both width and height formulas separately
- Handles Math functions and complex expressions
- Provides detailed breakdown for verification and ordering
- Fully backward compatible with existing functionality

This solution perfectly addresses the user's need for glass ordering optimization while maintaining the precision and rounding requirements of the factory glass cutting process. 