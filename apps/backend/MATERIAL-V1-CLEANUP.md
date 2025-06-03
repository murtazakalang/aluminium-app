# Material V1 Schema Cleanup

## Overview
This document outlines the complete removal of the old Material V1 schema and its replacement with MaterialV2 throughout the application.

## What Was Removed

### 1. Database Schema
- **Collection**: `materials` (Material V1 collection)
- **Model File**: `src/models/Material.js`

### 2. Related Data
- Stock transactions referencing non-existent Material V1 IDs
- ProductType material references pointing to Material V1
- Order material references pointing to Material V1
- Estimation material references pointing to Material V1

### 3. Code Files Removed
- `check-materials.js` - Old material checking script
- `test-material-with-schema.js` - Test file for V1 schema
- `test-controller-material-creation.js` - Controller tests for V1
- `test-new-material-creation.js` - Material creation tests for V1

## What Was Updated

### 1. Model References Updated to MaterialV2
- `src/models/ProductType.js` - `materialId` ref updated
- `src/models/StockTransaction.js` - `materialId` ref updated  
- `src/models/Estimation.js` - `materialId` and `selectedGlassTypeId` refs updated
- `src/models/Quotation.js` - `selectedGlassTypeId` ref updated
- `src/models/CuttingPlan.js` - `materialId` ref updated

### 2. Service Files Updated
- `src/services/estimationService.js`
- `src/services/inventoryService.js`
- `src/services/productService.js`
- `src/services/orderService.js`
- `src/services/cuttingOptimizationService.js`
- `src/services/reportService.js`

### 3. Controller Files Updated
- `src/controllers/productController.js`
- `src/controllers/inventoryController.js` 
- `src/controllers/orderController.js`
- `src/controllers/accountingController.js`

### 4. Utility Files Updated
- `src/utils/weightUtils.js`
- `src/utils/migrationToBatch.js`

## Migration Scripts Created

### 1. Database Cleanup Script: `cleanup-old-materials.js`
This script performs the following operations:
1. **Checks collections** - Lists all database collections and document counts
2. **Drops Material V1 collection** - Permanently removes the `materials` collection
3. **Cleans stock transactions** - Removes orphaned stock transactions
4. **Updates ProductTypes** - Removes invalid material references
5. **Updates Estimations** - Cleans up material references
6. **Updates Orders** - Cleans up material references in orders and items

### 2. Code Cleanup Script: `cleanup-material-imports.js`
This script performs the following operations:
1. **Updates imports** - Changes `Material` imports to `MaterialV2`
2. **Updates variable references** - Changes `Material` variables to `MaterialV2`
3. **Removes old files** - Deletes test files and old schema file

## How to Execute the Cleanup

### Step 1: Run Code Cleanup
```bash
cd apps/backend
node cleanup-material-imports.js
```

### Step 2: Run Database Cleanup  
```bash
cd apps/backend
node cleanup-old-materials.js
```

**⚠️ Warning**: The database cleanup script will permanently delete all Material V1 data. Make sure you have a backup and that all data has been migrated to MaterialV2 before running.

### Step 3: Remove Cleanup Scripts (Optional)
After successful cleanup, you can remove the cleanup scripts:
```bash
rm cleanup-old-materials.js
rm cleanup-material-imports.js
```

## Post-Cleanup Verification

### 1. Database Verification
- Verify `materials` collection no longer exists
- Verify `materials_v2` collection contains all your materials
- Verify no orphaned stock transactions exist
- Verify all ProductTypes reference valid MaterialV2 IDs

### 2. Application Testing
- Test material creation through inventory management
- Test product type creation and editing
- Test order creation and processing
- Test estimation generation
- Test stock management operations

### 3. Frontend Updates (If Needed)
- Update any frontend components that might be caching Material V1 references
- Clear browser caches and localStorage if needed

## Schema Differences: V1 vs V2

### Material V1 (Removed)
- Single schema for all material types
- Stock tracked in `stockByLength` arrays
- Gauge weights in `gaugeSpecificWeights`
- Simple quantity tracking

### Material V2 (Current)
- Batch-based inventory tracking
- Separate schemas for Profile vs Non-Profile materials
- `profileBatches` for Profile materials
- `simpleBatches` for other materials
- Better cost tracking and FIFO/LIFO support
- Wire Mesh category support

## Benefits of V2 Schema

1. **Better Inventory Management**: Batch-based tracking with purchase dates and suppliers
2. **Improved Cost Tracking**: Actual costs per batch with proper FIFO/LIFO consumption
3. **Wire Mesh Support**: Dedicated fields for wire mesh width, length, and area calculations
4. **Enhanced Reporting**: Better traceability and stock movement history
5. **Simplified Stock Operations**: Cleaner API for stock inward/outward operations

## Rollback Plan (Emergency Only)

If you need to rollback (not recommended):
1. Restore database from backup taken before cleanup
2. Restore the old `src/models/Material.js` file
3. Restore the old import statements in service files
4. Restart the application

## Notes

- All MaterialV2 documents use the collection name `materials_v2`
- Stock transactions now only reference MaterialV2 IDs
- The cleanup ensures referential integrity across all collections
- Frontend components should continue to work as the API endpoints remain the same, just using V2 internally

## Verification Checklist

- [ ] Material V1 collection dropped
- [ ] All orphaned stock transactions removed  
- [ ] ProductTypes updated to reference MaterialV2
- [ ] Orders cleaned of invalid material references
- [ ] Estimations cleaned of invalid material references
- [ ] All code imports updated to MaterialV2
- [ ] Application starts without errors
- [ ] Inventory operations work correctly
- [ ] Order processing works correctly
- [ ] Estimation generation works correctly 