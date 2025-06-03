# Batch Tracking Implementation Tasks

## Phase 1: Data Model Changes (Foundation) - Weeks 1-2

### Task 1.1: Update Material Schema for Batch Tracking
**Priority: HIGH | Estimated: 3 days**

#### Acceptance Criteria:
- [ ] `stockByLength` array items become individual batches
- [ ] Each batch has unique `batchId`, `arrivalDate`, `originalQuantity`
- [ ] Batch-specific weight properties if material properties vary
- [ ] Backward compatibility maintained during transition
- [ ] All tests pass

#### Implementation Details:
```javascript
// Updated stockByLength schema in Material.js
stockByLength: [{
    // Batch identification
    batchId: { 
        type: String, 
        default: () => new mongoose.Types.ObjectId().toString(), 
        index: true,
        required: true
    },
    arrivalDate: { 
        type: Date, 
        default: Date.now, 
        required: true,
        index: true // For FIFO sorting
    },
    
    // Material characteristics
    length: { type: mongoose.Types.Decimal128, required: true },
    unit: { type: String, required: true, default: 'ft' },
    gauge: { type: String, required: true },
    
    // Batch-specific physical properties
    weightPerUnitLength: { type: mongoose.Types.Decimal128 },
    unitLengthForWeight: { type: String, default: 'ft' },
    weightUnitForWeight: { type: String, default: 'kg' },
    
    // Quantity and Cost for THIS BATCH
    quantity: { type: mongoose.Types.Decimal128, required: true },
    originalQuantity: { type: mongoose.Types.Decimal128, required: true },
    unitRate: { type: mongoose.Types.Decimal128, required: true },
    
    // Batch tracking
    supplier: { type: String },
    purchaseOrderNo: { type: String },
    notes: { type: String },
    
    // Status
    isConsumed: { type: Boolean, default: false },
    consumedDate: { type: Date }
}]
```

#### Files to Modify:
- `apps/backend/src/models/Material.js`

---

### Task 1.2: Create BatchService for Material Management
**Priority: HIGH | Estimated: 4 days**

#### Acceptance Criteria:
- [ ] `BatchService.createBatch()` creates new batch on stock inward
- [ ] `BatchService.getAvailableBatches()` returns batches in FIFO order
- [ ] `BatchService.consumeFromBatches()` handles FIFO consumption
- [ ] `BatchService.getBatchSummary()` calculates aggregated totals
- [ ] All methods handle edge cases (zero stock, insufficient stock)
- [ ] Comprehensive test coverage

#### Implementation Details:
```javascript
// apps/backend/src/services/batchService.js
class BatchService {
    static async createBatch(materialId, batchData, userId) { }
    static async getAvailableBatches(materialId, filters = {}) { }
    static async consumeFromBatches(materialId, consumptionRequests) { }
    static async getBatchSummary(materialId, options = {}) { }
    static async adjustBatchQuantity(materialId, batchId, newQuantity, reason, userId) { }
    static async getOldestBatch(materialId, filters = {}) { }
    static async getBatchHistory(materialId, batchId) { }
}
```

#### Key Functions:
1. **createBatch**: Add new stock batch with all properties
2. **getAvailableBatches**: Return batches sorted by `arrivalDate` (FIFO)
3. **consumeFromBatches**: Deduct quantities using FIFO, return actual costs
4. **getBatchSummary**: Calculate totals for display/reporting
5. **adjustBatchQuantity**: Handle manual adjustments
6. **getBatchHistory**: Audit trail for batch usage

#### Files to Create:
- `apps/backend/src/services/batchService.js`
- `apps/backend/src/services/__tests__/batchService.test.js`

---

### Task 1.3: Create Data Migration Script
**Priority: HIGH | Estimated: 3 days**

#### Acceptance Criteria:
- [ ] Converts all existing `stockByLength` entries to batch format
- [ ] Preserves all existing data (quantities, rates, gauges)
- [ ] Sets reasonable `arrivalDate` (material creation date or estimate)
- [ ] Generates unique `batchId` for each entry
- [ ] Includes rollback capability
- [ ] Validates migration accuracy
- [ ] Can run multiple times safely (idempotent)

#### Implementation Details:
```javascript
// scripts/migrate-to-batch-tracking.js
const migrateToBatchTracking = async () => {
    // 1. Backup current data
    // 2. For each Material with stockByLength
    //    - Convert each stockByLength item to batch format
    //    - Set arrivalDate to material.createdAt or estimate
    //    - Generate batchId
    //    - Set originalQuantity = quantity
    //    - Preserve all existing fields
    // 3. Validate migration
    // 4. Report migration results
};
```

#### Files to Create:
- `scripts/migrate-to-batch-tracking.js`
- `scripts/validate-migration.js`
- `scripts/rollback-migration.js`

---

### Task 1.4: Update StockTransaction Model for Batch References
**Priority: MEDIUM | Estimated: 2 days**

#### Acceptance Criteria:
- [ ] Add `batchId` field to StockTransaction
- [ ] Add batch-related fields for better tracking
- [ ] Maintain backward compatibility
- [ ] Update indexes for performance

#### Implementation Details:
```javascript
// Add to StockTransaction schema
batchId: { 
    type: String, 
    index: true 
},
batchReference: {
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material' },
    batchId: String,
    batchArrivalDate: Date
},
actualUnitRate: { type: mongoose.Types.Decimal128 } // Actual rate from batch
```

#### Files to Modify:
- `apps/backend/src/models/StockTransaction.js`

---

## Phase 2: Core Inventory Changes (Stock Management) - Weeks 3-4

### Task 2.1: Update Stock Inward Process
**Priority: HIGH | Estimated: 3 days**

#### Acceptance Criteria:
- [ ] `recordProfileStockInward` creates new batch instead of averaging
- [ ] Each incoming shipment gets unique batch
- [ ] Batch-specific weight properties stored correctly
- [ ] StockTransaction references created batch
- [ ] No averaging of costs or properties
- [ ] All existing tests updated and passing

#### Implementation Details:
- Modify `apps/backend/src/services/inventoryService.js`
- Remove averaging logic from `recordProfileStockInward`
- Use `BatchService.createBatch()` for new stock
- Store batch-specific weight calculations

#### Files to Modify:
- `apps/backend/src/services/inventoryService.js`

---

### Task 2.2: Update Material Pre-Save Hook
**Priority: HIGH | Estimated: 3 days**

#### Acceptance Criteria:
- [ ] Calculate `totalStockQuantity` as sum of all batch quantities
- [ ] Calculate `unitRateForStockUnit` as weighted average for display
- [ ] Don't modify individual batch rates
- [ ] Maintain performance with many batches
- [ ] Support both old and new data during transition

#### Implementation Details:
- Modify pre-save hook in `Material.js`
- Use aggregation to calculate summary fields
- Keep individual batch data intact

#### Files to Modify:
- `apps/backend/src/models/Material.js`

---

### Task 2.3: Create Material Consumption Logic
**Priority: HIGH | Estimated: 4 days**

#### Acceptance Criteria:
- [ ] FIFO consumption logic working correctly
- [ ] Returns actual costs of consumed materials
- [ ] Updates batch quantities accurately
- [ ] Handles partial batch consumption
- [ ] Tracks consumption for audit trail
- [ ] Performance optimized for large batch counts

#### Implementation Details:
- Implement in `BatchService.consumeFromBatches()`
- Handle complex consumption scenarios
- Update `StockTransaction` records
- Return consumption details for cost tracking

#### Files to Modify:
- `apps/backend/src/services/batchService.js`

---

### Task 2.4: Create Batch Management API Endpoints
**Priority: MEDIUM | Estimated: 3 days**

#### Acceptance Criteria:
- [ ] GET `/api/inventory/materials/{materialId}/batches` - List batches
- [ ] POST `/api/inventory/materials/{materialId}/batches` - Create batch
- [ ] PUT `/api/inventory/materials/{materialId}/batches/{batchId}` - Update batch
- [ ] GET `/api/inventory/materials/{materialId}/batch-summary` - Aggregated view
- [ ] Proper validation and error handling
- [ ] RBAC protection

#### Files to Create:
- Update `apps/backend/src/controllers/inventoryController.js`
- Update `apps/backend/src/routes/inventoryRoutes.js`

---

## Phase 3: Cost Calculation Updates (Estimation & Product Services) - Weeks 5-7

### Task 3.1: Update Product Cost Calculations
**Priority: HIGH | Estimated: 4 days**

#### Acceptance Criteria:
- [ ] `getUnitCostOfStandardPipe` uses batch-aware logic
- [ ] Cost calculations reflect actual batch costs
- [ ] Handles scenarios with multiple batches of same material
- [ ] Performance maintained for cost calculations
- [ ] Backward compatibility during transition

#### Implementation Details:
- Modify `productService.getUnitCostOfStandardPipe()`
- Use weighted average or FIFO logic for cost calculation
- Update `productService.calculateProductCost()`

#### Files to Modify:
- `apps/backend/src/services/productService.js`

---

### Task 3.2: Update Estimation Service for Batch-Aware Costing
**Priority: HIGH | Estimated: 5 days**

#### Acceptance Criteria:
- [ ] `calculateEstimationMaterials` uses batch rates
- [ ] `autoUnitRate` calculated from available batches
- [ ] Handles both Profile and non-Profile materials
- [ ] Maintains existing estimation workflow
- [ ] Cost accuracy improved

#### Implementation Details:
- Modify `estimationService.calculateEstimationMaterials()`
- Calculate weighted average rates from available batches
- Update auto-fill rate logic

#### Files to Modify:
- `apps/backend/src/services/estimationService.js`

---

### Task 3.3: Update Order Service for Batch Consumption
**Priority: HIGH | Estimated: 5 days**

#### Acceptance Criteria:
- [ ] Order processing uses FIFO batch consumption
- [ ] Actual batch costs tracked for orders
- [ ] Stock availability checks use batch data
- [ ] Order material consumption updates batches
- [ ] Detailed cost tracking per order

#### Implementation Details:
- Modify order material consumption logic
- Use `BatchService.consumeFromBatches()` during order processing
- Update stock availability checks

#### Files to Modify:
- `apps/backend/src/services/orderService.js`

---

### Task 3.4: Update Weight Calculation Utilities
**Priority: MEDIUM | Estimated: 2 days**

#### Acceptance Criteria:
- [ ] Weight calculations use batch-specific weights
- [ ] Handles materials with varying weight per foot
- [ ] Maintains accuracy across different batches
- [ ] Performance optimized

#### Files to Modify:
- `apps/backend/src/utils/weightUtils.js`

---

## Phase 4: Order Processing & Manufacturing Updates - Weeks 8-10

### Task 4.1: Implement Order Material Consumption
**Priority: HIGH | Estimated: 4 days**

#### Acceptance Criteria:
- [ ] Order processing consumes from specific batches
- [ ] Detailed tracking of which batches used
- [ ] Accurate cost allocation to orders
- [ ] Stock deduction from correct batches
- [ ] Complete audit trail

#### Implementation Details:
- Integrate `BatchService.consumeFromBatches()` into order workflow
- Create detailed consumption records
- Track actual material costs per order

---

### Task 4.2: Update Manufacturing Cost Tracking
**Priority: HIGH | Estimated: 4 days**

#### Acceptance Criteria:
- [ ] Manufacturing tracks actual batch costs
- [ ] Link manufactured items to material batches
- [ ] Accurate cost analysis for manufactured products
- [ ] Detailed material traceability

#### Implementation Details:
- Update manufacturing service to use batch costs
- Create links between manufactured items and source batches
- Enable detailed cost analysis

---

### Task 4.3: Enhance Stock Transaction Records
**Priority: MEDIUM | Estimated: 3 days**

#### Acceptance Criteria:
- [ ] All stock transactions reference batches
- [ ] Complete audit trail of batch usage
- [ ] Transaction history includes batch details
- [ ] Performance optimized for queries

#### Implementation Details:
- Update all stock transaction creation
- Add batch reference fields
- Optimize queries for batch-related reports

---

### Task 4.4: Create Batch Aging and Analysis
**Priority: MEDIUM | Estimated: 3 days**

#### Acceptance Criteria:
- [ ] Track batch age and usage patterns
- [ ] Identify slow-moving or aged inventory
- [ ] Support FIFO validation
- [ ] Reporting on batch utilization

---

## Phase 5: Frontend & Reporting Updates - Weeks 11-12

### Task 5.1: Update Inventory Management UI
**Priority: HIGH | Estimated: 4 days**

#### Acceptance Criteria:
- [ ] Stock inward forms show batch creation
- [ ] Inventory lists display batch information
- [ ] Batch-wise stock availability shown
- [ ] User-friendly batch management interface

---

### Task 5.2: Create Batch Management Interface
**Priority: MEDIUM | Estimated: 3 days**

#### Acceptance Criteria:
- [ ] View all batches for a material
- [ ] Show FIFO order and batch details
- [ ] Enable batch-specific adjustments
- [ ] Batch history and audit trail

---

### Task 5.3: Update Inventory Reports
**Priority: MEDIUM | Estimated: 3 days**

#### Acceptance Criteria:
- [ ] Inventory valuation uses batch costs
- [ ] Batch aging reports available
- [ ] Cost analysis reports updated
- [ ] FIFO compliance reporting

---

## Phase 6: Testing & Validation - Weeks 13-14

### Task 6.1: Data Integrity Testing
**Priority: HIGH | Estimated: 3 days**

#### Acceptance Criteria:
- [ ] Migration accuracy verified
- [ ] FIFO consumption logic validated
- [ ] Cost calculations accurate
- [ ] No data loss or corruption

---

### Task 6.2: Performance Testing
**Priority: HIGH | Estimated: 3 days**

#### Acceptance Criteria:
- [ ] Performance with large batch counts tested
- [ ] Query optimization completed
- [ ] Response times within acceptable limits
- [ ] Memory usage optimized

---

### Task 6.3: User Acceptance Testing
**Priority: HIGH | Estimated: 4 days**

#### Acceptance Criteria:
- [ ] Business scenarios validated
- [ ] User training completed
- [ ] Edge cases tested
- [ ] Production readiness confirmed

---

### Task 6.4: Production Deployment
**Priority: HIGH | Estimated: 4 days**

#### Acceptance Criteria:
- [ ] Production deployment successful
- [ ] Data migration completed
- [ ] Monitoring in place
- [ ] Rollback plan tested

---

## Implementation Priority Matrix

### Critical Path (Must Complete in Order):
1. Task 1.1 → Task 1.2 → Task 1.3 (Foundation)
2. Task 2.1 → Task 2.2 → Task 2.3 (Stock Management)
3. Task 3.1 → Task 3.2 → Task 3.3 (Cost Calculations)
4. Task 4.1 → Task 4.2 (Order Processing)

### Parallel Workstreams:
- Frontend tasks (5.x) can start once API changes are complete
- Testing tasks (6.x) can start once core functionality is complete
- Documentation and training can happen throughout

## Risk Mitigation Tasks

### High-Risk Mitigation:
- **Data Migration**: Extra testing task for migration validation
- **Performance**: Dedicated performance testing and optimization
- **Complexity**: Comprehensive unit and integration testing

### Quality Gates:
- Each phase requires sign-off before proceeding
- Migration must be validated on production-like data
- Performance benchmarks must be met
- User acceptance required before production deployment

This task breakdown provides a detailed roadmap for implementing batch tracking while minimizing risks and ensuring system reliability. 