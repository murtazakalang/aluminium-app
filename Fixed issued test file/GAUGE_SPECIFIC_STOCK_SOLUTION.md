# Gauge-Specific Stock Tracking Solution

## Problem Summary
The previous data model was mixing gauge-specific stock entries, causing incorrect calculations and inability to track stock separately for different gauges (18G vs 20G) of the same material length.

## Root Cause
**Data Model Limitation**: The `stockByLength` schema did not include gauge differentiation, so entries like:
- 15ft 20G: 1 piece at ₹1237.5
- 15ft 18G: 1 piece at ₹1237.5

Were being combined as:
- 15ft: 2 pieces at ₹1237.5 (without gauge distinction)

This caused the pre-save hook to incorrectly calculate weights using averages instead of specific gauge weights.

## Solution Implemented

### 1. Enhanced Material Schema
**File**: `apps/backend/src/models/Material.js`

Added optional `gauge` field to `stockByLength` entries:
```javascript
stockByLength: [{
    length: { type: mongoose.Types.Decimal128, required: true },
    unit: { type: String, required: true, default: 'ft' },
    gauge: { type: String }, // NEW: Optional gauge field (e.g., "18G", "20G")
    quantity: { type: mongoose.Types.Decimal128, default: '0.00' },
    lowStockThreshold: { type: mongoose.Types.Decimal128, default: '0.00' },
    unitRate: { type: mongoose.Types.Decimal128, default: '0.00' },
}]
```

### 2. Updated Inventory Service
**File**: `apps/backend/src/services/inventoryService.js`

**Key Changes**:
- Modified stock entry lookup to include gauge in search criteria
- Each gauge now gets its own separate stock entry
- Enhanced logging for gauge-specific tracking

**Logic**:
```javascript
// Look for existing stock entry with same length, unit AND gauge
let stockLengthEntry = material.stockByLength.find(sbl => {
    const lengthMatch = sbl.length.toString() === mongooseSlDecimalForSearch.toString() && 
                       sbl.unit === standardLength.unit;
    
    if (!gauge) {
        return lengthMatch && !sbl.gauge;
    } else {
        return lengthMatch && sbl.gauge === gauge;
    }
});
```

### 3. Enhanced Pre-Save Hook
**File**: `apps/backend/src/models/Material.js`

**Improvements**:
- Reads gauge directly from `stockByLength` entries
- Uses specific gauge weights when available
- Proper fallback handling for mixed scenarios

**Logic**:
```javascript
if (stockGauge && gaugeWeights[stockGauge]) {
    // Use specific gauge weight if available
    const gaugeWeight = gaugeWeights[stockGauge];
    weightForThisStock = length * quantity * gaugeWeight;
} else if (Object.keys(gaugeWeights).length === 1) {
    // Single gauge - use that gauge weight
    const singleGaugeWeight = Object.values(gaugeWeights)[0];
    weightForThisStock = length * quantity * singleGaugeWeight;
} else {
    // Multiple gauges but no specific gauge - use average weight as fallback
    const avgWeight = Object.values(gaugeWeights).reduce((sum, w) => sum + w, 0) / Object.values(gaugeWeights).length;
    weightForThisStock = length * quantity * avgWeight;
}
```

## Fixed Data Structure

### Before (Problematic)
```javascript
stockByLength: [
    {
        length: "15",
        unit: "ft",
        quantity: "2",        // Combined quantity
        unitRate: "1237.5"    // Average rate
        // No gauge field
    }
]
```

### After (Correct)
```javascript
stockByLength: [
    {
        length: "15",
        unit: "ft",
        gauge: "20G",         // Specific gauge
        quantity: "1",        // Specific quantity
        unitRate: "1237.5"    // Specific rate
    },
    {
        length: "15", 
        unit: "ft",
        gauge: "18G",         // Different gauge
        quantity: "1",        // Specific quantity  
        unitRate: "1237.5"    // Specific rate
    },
    {
        length: "12",
        unit: "ft", 
        gauge: "20G",
        quantity: "1",
        unitRate: "792"
    }
]
```

## Current Material State
**Material**: "3 Track Bottom" (ID: 680b7b437dbf831998210d65)

**Stock Entries**:
- 15ft 20G: 1 piece at ₹1237.5/piece (3kg)
- 15ft 18G: 1 piece at ₹1237.5/piece (4.5kg)  
- 12ft 20G: 1 piece at ₹792/piece (2.4kg)

**Totals**: 9.9kg at ₹330/kg

## Benefits of This Solution

1. **Accurate Tracking**: Each gauge has its own stock entry
2. **Correct Calculations**: Uses specific gauge weights instead of averages
3. **No Data Mixing**: Different gauges don't interfere with each other
4. **Backward Compatible**: Existing materials without gauge field continue to work
5. **Future-Proof**: Supports any number of gauges per material

## Impact on Other Modules

### ✅ Safe Changes
- **Schema Change**: Adding optional field doesn't break existing data
- **Inventory Service**: Enhanced to create gauge-specific entries
- **Pre-Save Hook**: Improved calculation logic
- **Frontend**: Gauge selection already implemented

### 🔍 Areas to Monitor
- **Reports**: May need updates to show gauge-specific breakdowns
- **Stock Adjustments**: Should handle gauge-specific adjustments
- **Import/Export**: May need gauge field in data formats

## Testing Recommendations

1. **Create New Stock Entries**: Test adding different gauges
2. **Update Existing Stock**: Verify gauge-specific updates
3. **Material Calculations**: Confirm accurate weight/cost calculations
4. **Frontend Display**: Check gauge selection and display
5. **Reports**: Verify gauge-specific reporting if applicable

## Future Enhancements

1. **Gauge-Specific Low Stock Alerts**: Track thresholds per gauge
2. **Gauge-Specific Reporting**: Enhanced inventory reports
3. **Gauge-Specific Reservations**: For order fulfillment
4. **Gauge Conversion Utilities**: Helper functions for gauge calculations

This solution provides a robust foundation for accurate gauge-specific inventory tracking without breaking existing functionality. 