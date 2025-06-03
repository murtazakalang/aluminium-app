# MongoDB Commands to Fix Material Calculations

## Current Problem (Updated)
Your material "3 Track Bottom Pipe" (ID: `68385de8039c395d41d13e2c`) now has:
- **Current**: totalStockQuantity = 3kg, unitRateForStockUnit = 264/kg ❌
- **Expected**: totalStockQuantity = 9.9kg, unitRateForStockUnit = 330/kg ✅

## Root Cause
The calculation is only considering the **first stock entry** (12ft) instead of **all stock entries**:
- **12ft**: 1 piece at ₹792 (2.4kg) = 20G gauge
- **15ft**: 2 pieces at ₹1237.5 each (7.5kg total) = mixed 20G+18G

## Solution
Run these MongoDB commands directly in your MongoDB client:

### 1. Connect to the correct database:
```bash
mongosh aluminiumDB
```

### 2. Fix the calculations:
```javascript
db.materials.updateOne(
  { _id: ObjectId('68385de8039c395d41d13e2c') },
  {
    $set: {
      totalStockQuantity: NumberDecimal('9.9'),
      unitRateForStockUnit: NumberDecimal('330'),
      updatedAt: new Date()
    }
  }
)
```

### 3. Verify the fix:
```javascript
db.materials.findOne(
  { _id: ObjectId('68385de8039c395d41d13e2c') },
  { 
    name: 1, 
    totalStockQuantity: 1, 
    unitRateForStockUnit: 1,
    gaugeSpecificWeights: 1,
    stockByLength: 1
  }
)
```

## Detailed Calculation Breakdown

**Your Current Stock:**

1. **12ft Stock**: 1 piece at ₹792
   - Total weight you specified: 2.4kg
   - Weight per ft: 2.4kg ÷ 12ft = 0.2 kg/ft = **20G gauge**
   - Weight calculation: 12ft × 1 piece × 0.2 kg/ft = **2.4kg**

2. **15ft Stock**: 2 pieces at ₹1237.5 each = ₹2475 total
   - From previous entries: 1 piece 20G + 1 piece 18G
   - Weight calculation: (15ft × 1 × 0.2) + (15ft × 1 × 0.3) = 3 + 4.5 = **7.5kg**

**Correct Totals:**
- **Total weight**: 2.4kg + 7.5kg = **9.9kg**
- **Total cost**: ₹792 + ₹2475 = **₹3267**
- **Rate per kg**: ₹3267 ÷ 9.9kg = **₹330/kg**

## Why the System Calculated Wrong

**Current Logic Issue:**
- Pre-save hook only considered the **12ft entry** (primary stock)
- Calculated: 12ft × 1 piece × 0.25 kg/ft (average gauge) = 3kg ❌
- Rate: ₹792 ÷ 3kg = ₹264/kg ❌

**Fixed Logic:**
- Calculate across **all stock lengths**
- Sum all weights and costs properly
- Use appropriate gauge weights for each entry

## Long-term Fix Applied

I've updated the Material model's pre-save hook in `apps/backend/src/models/Material.js` to:

1. **Process ALL stock lengths** instead of just the primary one
2. **Calculate weighted totals** across all entries
3. **Better gauge inference** for each stock entry
4. **Proper aggregation** of weights and costs

The fix will automatically apply to new stock inwards going forward.

## Alternative Manual Calculation Method

If the automatic fix doesn't work, you can also calculate manually:

```javascript
// Get all stock entries with non-zero quantities
const stockEntries = [
  { length: 12, quantity: 1, unitRate: 792, gauge: '20G', weightPerFt: 0.2 },
  { length: 15, quantity: 2, unitRate: 1237.5, totalWeight: 7.5 }  // Mixed gauge
];

let totalWeight = 0;
let totalCost = 0;

stockEntries.forEach(entry => {
  if (entry.totalWeight) {
    totalWeight += entry.totalWeight;
  } else {
    totalWeight += entry.length * entry.quantity * entry.weightPerFt;
  }
  totalCost += entry.unitRate * entry.quantity;
});

const ratePerKg = totalCost / totalWeight;
console.log(`Total: ${totalWeight}kg at ₹${ratePerKg}/kg`);
``` 