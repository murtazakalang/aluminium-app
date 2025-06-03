# PRD Update: Batch Tracking System for Material Inventory

## Executive Summary

This PRD update introduces **Batch/Lot Tracking** to replace the current material cost averaging system. This change will provide precise material costing, accurate inventory valuations, and improved traceability throughout the manufacturing workflow.

**Business Impact:** Eliminates cost distortions from material averaging, enabling accurate quotations, estimations, and manufacturing cost analysis.

## Problem Statement

### Current Issue
The existing system averages material costs and properties when new stock arrives, causing:
1. **Cost Inaccuracy**: New stock at ₹1056/piece averaged with old stock at ₹990/piece results in ₹1045/piece for both
2. **Property Mixing**: Weight per foot changes across batches get averaged, affecting weight calculations
3. **Lost Traceability**: Cannot track which materials came from which purchase
4. **Estimation Errors**: Inaccurate material costs affect quotation pricing and profit margins

### Business Impact
- Quotations may be underpriced or overpriced due to inaccurate material costs
- Manufacturing cost analysis is imprecise
- Inventory valuations don't reflect actual purchase costs
- Cannot optimize purchasing based on supplier performance

## Proposed Solution: Batch Tracking

### Core Concept
Each material shipment becomes a distinct **batch** with its own:
- Purchase cost per unit
- Physical properties (weight, dimensions)
- Arrival date and supplier information
- Unique batch identifier

### FIFO Consumption
Materials are consumed on a **First-In, First-Out** basis:
- Oldest batches are used first
- Actual batch costs are applied to projects
- Real-time tracking of batch depletion

## Updated System Architecture

### Data Model Changes

#### Enhanced Material Schema
```javascript
// Updated stockByLength to represent individual batches
stockByLength: [{
    // Batch Identification
    batchId: { type: String, required: true, index: true },
    arrivalDate: { type: Date, required: true, index: true },
    
    // Material Properties
    length: { type: mongoose.Types.Decimal128, required: true },
    unit: { type: String, required: true, default: 'ft' },
    gauge: { type: String, required: true },
    
    // Batch-Specific Properties
    weightPerUnitLength: { type: mongoose.Types.Decimal128 },
    unitLengthForWeight: { type: String, default: 'ft' },
    weightUnitForWeight: { type: String, default: 'kg' },
    
    // Quantity and Cost
    quantity: { type: mongoose.Types.Decimal128, required: true },
    originalQuantity: { type: mongoose.Types.Decimal128, required: true },
    unitRate: { type: mongoose.Types.Decimal128, required: true },
    
    // Tracking Information
    supplier: { type: String },
    purchaseOrderNo: { type: String },
    notes: { type: String },
    
    // Status
    isConsumed: { type: Boolean, default: false },
    consumedDate: { type: Date }
}]
```

#### Enhanced StockTransaction Schema
```javascript
// Additional fields for batch tracking
batchId: { type: String, index: true },
batchReference: {
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material' },
    batchId: String,
    batchArrivalDate: Date
},
actualUnitRate: { type: mongoose.Types.Decimal128 }
```

### New Service: BatchService

#### Core Functions
1. **createBatch(materialId, batchData, userId)**
   - Creates new batch on stock inward
   - Assigns unique batchId and arrivalDate
   - Stores batch-specific properties

2. **getAvailableBatches(materialId, filters)**
   - Returns batches sorted by arrivalDate (FIFO order)
   - Supports filtering by gauge, length, supplier

3. **consumeFromBatches(materialId, consumptionRequests)**
   - Implements FIFO consumption logic
   - Returns actual costs and weights from consumed batches
   - Updates batch quantities and creates audit trail

4. **getBatchSummary(materialId, options)**
   - Calculates aggregated totals for reporting
   - Provides weighted average costs for display

## Updated Workflows

### 1. Stock Inward Process

#### Before (Current)
1. Receive new material shipment
2. Find existing stock entry for same material+gauge+length
3. Average new cost with existing cost
4. Update single stock entry with averaged values

#### After (Batch Tracking)
1. Receive new material shipment
2. Create new batch entry with actual purchase cost
3. Store batch-specific weight properties
4. No averaging - each batch maintains its own properties
5. Update material summary fields as aggregations

### 2. Material Cost Retrieval

#### Before (Current)
```javascript
// Get single averaged cost
const cost = material.unitRateForStockUnit;
```

#### After (Batch Tracking)
```javascript
// Get weighted average from available batches
const batchSummary = await BatchService.getBatchSummary(materialId);
const averageCost = batchSummary.weightedAverageRate;

// Or get actual costs for consumption
const consumptionResult = await BatchService.consumeFromBatches(
    materialId, 
    consumptionRequests
);
const actualCosts = consumptionResult.batchesConsumed.map(b => b.actualCost);
```

### 3. Order Processing with FIFO Consumption

#### New Workflow
1. Calculate required materials for order
2. Use `BatchService.consumeFromBatches()` to determine which batches to use
3. Apply actual batch costs to order
4. Update batch quantities
5. Create detailed StockTransaction records with batch references

### 4. Estimation & Quotation Costing

#### Updated Process
1. **Estimation Calculation**: Use weighted average from available batches for `autoUnitRate`
2. **Manual Rate Override**: Users can still override with manual rates
3. **Quotation Generation**: Inherits improved cost accuracy from estimations
4. **Order Creation**: Uses FIFO consumption for actual material allocation

## API Changes

### New Endpoints

#### Batch Management
```
GET    /api/inventory/materials/{materialId}/batches
POST   /api/inventory/materials/{materialId}/batches
PUT    /api/inventory/materials/{materialId}/batches/{batchId}
DELETE /api/inventory/materials/{materialId}/batches/{batchId}
GET    /api/inventory/materials/{materialId}/batch-summary
```

#### Batch Consumption (Internal)
```
POST   /api/inventory/materials/{materialId}/consume
POST   /api/inventory/materials/{materialId}/validate-consumption
```

### Updated Endpoints

#### Stock Inward
```
POST /api/inventory/stock/inward-profile
```
**Changes:**
- Creates new batch instead of updating existing entry
- Returns batch information in response
- No longer performs cost averaging

#### Material Listing
```
GET /api/inventory/materials
```
**Changes:**
- Includes batch summary information
- Shows aggregated totals from all batches
- Provides batch count per material

## User Interface Updates

### 1. Stock Inward Form
- **Display**: Shows that new batch will be created
- **Information**: Captures supplier, PO number, notes
- **Feedback**: Confirms batch creation with batchId

### 2. Material Inventory List
- **Batch Count**: Shows number of active batches per material
- **Summary View**: Displays aggregated quantities and weighted average costs
- **Drill-down**: Click to view individual batches

### 3. Batch Management Interface
- **Batch List**: Shows all batches for a material in FIFO order
- **Batch Details**: View individual batch properties and history
- **Adjustments**: Enable manual quantity adjustments with reason codes

### 4. Cost Calculation Displays
- **Estimations**: Show that costs are based on current batch availability
- **Orders**: Display actual batch costs used
- **Reports**: Include batch-level cost breakdowns

## Reporting Enhancements

### 1. Inventory Valuation
- **Batch-Level Valuation**: Show value of each batch
- **FIFO Compliance**: Validate FIFO consumption adherence
- **Aging Analysis**: Identify slow-moving batches

### 2. Cost Analysis
- **Actual vs. Estimated**: Compare estimated costs with actual batch costs used
- **Supplier Performance**: Analyze cost trends by supplier
- **Batch Utilization**: Track efficiency of batch consumption

### 3. Audit Trail
- **Batch History**: Complete lifecycle tracking from arrival to consumption
- **Cost Traceability**: Link manufactured items to source batches
- **Compliance Reporting**: Support for accounting and audit requirements

## Migration Strategy

### Phase 1: Data Migration
1. **Backup**: Complete backup of current data
2. **Conversion**: Transform existing stockByLength entries to batch format
3. **Validation**: Verify data accuracy and completeness

### Phase 2: Parallel Operation
1. **Feature Flag**: Enable batch tracking alongside existing system
2. **Gradual Rollout**: Start with new stock inward only
3. **Validation**: Compare results between old and new systems

### Phase 3: Full Cutover
1. **System Switch**: Move all operations to batch tracking
2. **Legacy Cleanup**: Archive old averaging logic
3. **Performance Monitoring**: Ensure optimal system performance

## Business Rules

### 1. Batch Creation
- Every stock inward creates a new batch
- Batch IDs are unique across the system
- Arrival date determines FIFO order

### 2. FIFO Consumption
- Oldest available batches are consumed first
- Partial batch consumption is allowed
- Consumed batches are marked but retained for audit

### 3. Cost Calculations
- **Estimations**: Use weighted average from available batches
- **Orders**: Use actual costs from consumed batches
- **Display**: Show both individual batch costs and weighted averages

### 4. Stock Adjustments
- Manual adjustments create new stock transactions
- Adjustments require reason codes and approval
- History is maintained for all adjustments

## Success Metrics

### Technical Metrics
- Data migration accuracy: 100%
- Performance benchmarks: No degradation
- System availability: 99.9%+ during migration

### Business Metrics
- Cost accuracy improvement: Measurable reduction in estimation variance
- User satisfaction: Training completion and adoption rates
- Audit compliance: Successful audit trail validation

## Risk Mitigation

### Technical Risks
1. **Data Migration**: Extensive testing on production-like data
2. **Performance**: Query optimization and monitoring
3. **Complexity**: Comprehensive testing of FIFO logic

### Business Risks
1. **User Training**: Comprehensive training program
2. **Process Changes**: Gradual rollout with support
3. **Data Accuracy**: Validation at every step

## Implementation Timeline

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1: Foundation | 2 weeks | Schema updates, BatchService, Migration script |
| Phase 2: Core Changes | 2 weeks | Stock inward, Material hooks, FIFO logic |
| Phase 3: Cost Updates | 3 weeks | Product, Estimation, Order services |
| Phase 4: Manufacturing | 3 weeks | Order processing, Manufacturing tracking |
| Phase 5: Frontend | 2 weeks | UI updates, Batch management |
| Phase 6: Testing | 2 weeks | Validation, Performance, UAT |
| **Total** | **14 weeks** | **Complete batch tracking system** |

## Conclusion

Batch tracking will transform the material inventory system from an averaging-based approach to a precise, traceable system that maintains the actual costs and properties of each material shipment. This change will significantly improve cost accuracy across estimations, quotations, orders, and manufacturing while providing the foundation for advanced inventory analysis and supplier performance tracking.

The implementation follows a phased approach that minimizes risk while ensuring business continuity and user adoption. The result will be a more accurate, transparent, and compliant material management system that supports better business decision-making. 