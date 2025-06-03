# Material V2 Batch Structure Fix

## Problem Identified

The Material V2 system was using a single `stockBatches` array for all material types, which led to irrelevant fields being stored for different material categories:

### Issues Found:
1. **Pipe materials** (Profile category) need: `length`, `lengthUnit`, `gauge`, `actualTotalWeight`, `ratePerPiece`, `ratePerKg`
2. **Other materials** (Glass, Hardware, Consumables) only need: `quantity`, `totalCost`, `ratePerUnit`
3. Database showed null values for irrelevant fields in non-pipe materials
4. Complex batch tracking was unnecessary for simple inventory items

### Example of Old Problematic Data:
```javascript
// Glass material with irrelevant pipe fields
{
  name: "5mm Clear Glass",
  category: "Glass",
  stockBatches: [{
    length: null,           // ❌ Irrelevant for glass
    lengthUnit: null,       // ❌ Irrelevant for glass
    gauge: null,            // ❌ Irrelevant for glass
    ratePerPiece: 55,       // ✅ Needed but confusing name
    ratePerKg: null         // ❌ Irrelevant for glass
  }]
}
```

## Solution Implemented

### 1. **Separate Batch Schemas**

Created two distinct sub-schemas for different material types:

#### **Profile Batch Schema** (for pipes/profiles)
```javascript
const profileBatchSchema = {
    batchId: String,
    length: Decimal128,        // Required for pipes
    lengthUnit: String,        // Required for pipes
    gauge: String,             // Required for pipes
    originalQuantity: Decimal128,
    currentQuantity: Decimal128,
    actualTotalWeight: Decimal128,  // For weight tracking
    actualWeightUnit: String,
    totalCostPaid: Decimal128,
    ratePerPiece: Decimal128,      // Rate per pipe
    ratePerKg: Decimal128,         // Rate per kg
    // ... other metadata
}
```

#### **Simple Batch Schema** (for glass, hardware, consumables)
```javascript
const simpleBatchSchema = {
    batchId: String,
    originalQuantity: Decimal128,
    currentQuantity: Decimal128,
    totalCostPaid: Decimal128,
    ratePerUnit: Decimal128,       // Rate per stockUnit (clearer naming)
    // ... other metadata
    // NO length, gauge, weight fields
}
```

### 2. **Conditional Batch Storage**

Materials now use different batch arrays based on their category:

```javascript
const materialV2Schema = {
    // ... other fields
    
    // For Profile materials: Use profileBatches
    profileBatches: [profileBatchSchema],
    
    // For non-Profile materials: Use simpleBatches  
    simpleBatches: [simpleBatchSchema],
    
    // ... other fields
}
```

### 3. **Smart Virtual Properties**

Added intelligent virtual properties that automatically use the correct batch array:

```javascript
materialV2Schema.virtual('activeBatches').get(function() {
    if (this.category === 'Profile') {
        return this.profileBatches.filter(batch => batch.isActive && !batch.isCompleted);
    } else {
        return this.simpleBatches.filter(batch => batch.isActive && !batch.isCompleted);
    }
});
```

## Migration Process

### 1. **Automatic Data Migration**

Created migration script that:
- Identifies materials with old `stockBatches` structure
- Moves Profile materials to `profileBatches` 
- Moves non-Profile materials to `simpleBatches` (mapping `ratePerPiece` → `ratePerUnit`)
- Removes old `stockBatches` field
- Preserves all existing data

### 2. **Backward Compatibility**

Added fallback support for unmigrated materials to ensure system continues working during transition.

## Benefits of New Structure

### ✅ **For Pipe Materials (Profiles)**
- **Batch-wise tracking** with full length/gauge/weight data
- **Cutting optimization** support with detailed measurements
- **Weight-based costing** for accurate pricing
- **FIFO/LIFO consumption** for proper inventory management

### ✅ **For Other Materials (Glass, Hardware, etc.)**
- **Simple inventory tracking** without irrelevant fields
- **Clean database** with no null values
- **Faster queries** with smaller document size
- **Clearer rate structure** with `ratePerUnit` instead of confusing `ratePerPiece`

### ✅ **Database Efficiency**
- **Reduced storage** by eliminating null fields
- **Better indexing** with category-specific fields
- **Cleaner documents** for easier maintenance
- **Type safety** with appropriate validation

## Usage Examples

### Creating Profile Material Stock
```javascript
// For pipes - uses profileBatches
const result = await BatchInventoryService.recordStockInward(companyId, userId, {
    materialId: 'profile_material_id',
    length: 15,           // Required for profiles
    lengthUnit: 'ft',     // Required for profiles  
    gauge: '18G',         // Required for profiles
    quantity: 10,
    actualWeight: 6.5,    // Optional but recommended
    totalCost: 2500,
    supplier: 'Steel Supplier'
});
```

### Creating Simple Material Stock
```javascript
// For glass/hardware - uses simpleBatches
const result = await BatchInventoryService.recordStockInward(companyId, userId, {
    materialId: 'glass_material_id', 
    // No length, gauge fields needed
    quantity: 100,        // In stockUnit (e.g., sqft for glass)
    totalCost: 5500,
    supplier: 'Glass Supplier'
});
```

### Querying Stock Data
```javascript
const material = await MaterialV2.findById(materialId);

// Works for both types automatically
const activeBatches = material.activeBatches;
const stockSummary = material.getStockSummary();
const availableBatches = material.getAvailableBatches();

// Profile materials get detailed breakdown
// Simple materials get aggregated summary
```

## Database Structure Comparison

### Before (Problematic)
```javascript
{
  name: "Dumal Lock Manghalam (27x65)",
  category: "Hardware", 
  stockBatches: [
    {
      batchId: "BATCH_20250530_459894_021",
      length: null,           // ❌ Irrelevant null
      lengthUnit: null,       // ❌ Irrelevant null  
      gauge: null,            // ❌ Irrelevant null
      actualTotalWeight: null, // ❌ Irrelevant null
      ratePerKg: null,        // ❌ Irrelevant null
      quantity: 1,
      ratePerPiece: 157       // ✅ But confusing name
    }
  ]
}
```

### After (Clean)
```javascript
{
  name: "Dumal Lock Manghalam (27x65)", 
  category: "Hardware",
  profileBatches: [],       // ✅ Empty for non-profiles
  simpleBatches: [
    {
      batchId: "BATCH_20250530_459894_021",
      quantity: 1,
      ratePerUnit: 157      // ✅ Clear naming
      // ✅ No irrelevant fields
    }
  ]
}
```

## Files Modified

### Core Schema
- `apps/backend/src/models/MaterialV2.js` - New batch structure
- `apps/backend/src/services/batchInventoryService.js` - Updated logic
- `apps/backend/src/controllers/batchInventoryController.js` - Response formatting

### Migration & Testing  
- `apps/backend/src/scripts/migrateMaterialV2Schema.js` - Data migration
- `apps/backend/src/scripts/testMaterialV2Structure.js` - Verification tests

## Running the Migration

```bash
# Navigate to project root
cd /path/to/aluminium-app

# Run migration script
node apps/backend/src/scripts/migrateMaterialV2Schema.js

# Verify results
node apps/backend/src/scripts/testMaterialV2Structure.js
```

## API Endpoints Affected

All existing endpoints continue to work, but now return cleaner data:

- `POST /api/v2/inventory/stock-inward` - Creates appropriate batch type
- `GET /api/v2/inventory/materials` - Returns formatted batch data  
- `GET /api/v2/inventory/available-batches/:materialId` - Format based on category
- `GET /api/v2/inventory/batch-history/:materialId` - Category-appropriate fields

## Conclusion

This fix resolves the database inconsistency by implementing **category-driven batch schemas**:

1. **Pipe materials** → Complex batch tracking with length/gauge/weight
2. **Other materials** → Simple inventory tracking without irrelevant fields

The result is a **cleaner database**, **better performance**, and **more maintainable code** while preserving all existing functionality and data. 