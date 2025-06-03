# Batch Tracking Migration Plan
## Problem Statement

The current material inventory system averages costs and material properties (like weight per foot) when new stock arrives. This creates inaccuracies in:
- Material costing for estimations, quotations, and orders
- Manufacturing cost calculations
- Inventory valuations
- Weight calculations for different batches of the same material+gauge combination

**Example Problem:** When adding 5 pieces of 15ft 20G material at ₹1056/piece to existing 1 piece at ₹990/piece, the system averages to ₹1045/piece, making both old and new stock cost the same. This affects all downstream calculations.

## Proposed Solution: Batch/Lot Tracking

Instead of averaging, each incoming shipment becomes a separate **batch** with its own:
- Purchase cost per piece
- Physical properties (weight per foot)
- Arrival date
- Supplier information

Material consumption follows **FIFO (First-In, First-Out)** for accurate job costing.

## Impact Analysis

### Affected Modules
1. **Inventory Management** - Core changes to how stock is stored and tracked
2. **Products** - Cost calculations use batch-specific rates
3. **Estimations** - Material cost calculations need batch-aware pricing
4. **Quotations** - Inherit estimation changes
5. **Orders** - Material consumption from specific batches
6. **Manufacturing** - Track actual material costs used
7. **Reports** - Inventory valuation and cost analysis

### Critical Dependencies

| Module | Current Dependency | Batch Tracking Impact | Migration Required |
|--------|-------------------|----------------------|-------------------|
| Products | `material.unitRateForStockUnit` | FIFO batch consumption logic | High |
| Estimations | `material.unitRateForStockUnit` + averaging | Weighted average across available batches | High |
| Quotations | Inherits from estimations | Indirect impact through estimations | Medium |
| Orders | Material consumption deduction | FIFO batch deduction logic | High |
| Manufacturing | Cost tracking | Actual batch costs used | High |
| Stock Transactions | Simple quantity tracking | Batch reference tracking | Medium |

### Current Code Hotspots

1. **`Material.preSave` Hook** - Currently calculates averaged `unitRateForStockUnit`
2. **`inventoryService.recordProfileStockInward`** - Averages with existing stock
3. **`estimationService.calculateEstimationMaterials`** - Uses `unitRateForStockUnit`
4. **`productService.getUnitCostOfStandardPipe`** - Gets rate from `stockByLength.unitRate`
5. **`orderService` material consumption** - Needs FIFO deduction logic

## Migration Strategy

### Phase 1: Data Model Changes (Foundation) 
**Estimated Time: 1-2 weeks**

#### 1.1 Modify Material Schema
- Transform `stockByLength` items into individual batches
- Add batch tracking fields (`batchId`, `arrivalDate`, `originalQuantity`, `supplier`, etc.)
- Add batch-specific weight properties if needed
- Keep backward compatibility during transition

#### 1.2 Create Batch Management Service
- `BatchService.createBatch()` - Create new batch on stock inward
- `BatchService.getAvailableBatches()` - Get batches for consumption (FIFO order)
- `BatchService.consumeFromBatches()` - FIFO material consumption
- `BatchService.getBatchSummary()` - Calculate totals for reporting

#### 1.3 Migration Script for Existing Data
- Convert current `stockByLength` entries to batches
- Set `arrivalDate` to material creation date or estimate
- Preserve existing `unitRate` and quantities
- Generate unique `batchId` for each entry

### Phase 2: Core Inventory Changes (Stock Management)
**Estimated Time: 1-2 weeks**

#### 2.1 Update Stock Inward Process
- Modify `inventoryService.recordProfileStockInward`
- Remove averaging logic
- Create new batch entries instead of updating existing ones
- Update `gaugeSpecificWeights` management for batch-specific weights

#### 2.2 Update Material Pre-Save Hook
- Calculate summary fields (`totalStockQuantity`, `unitRateForStockUnit`) as aggregations
- Don't modify individual batch rates
- Use for reporting/display purposes only

#### 2.3 Create Material Consumption Logic
- Implement FIFO consumption in `BatchService`
- Track which batches are consumed for cost tracking
- Update order processing to use FIFO consumption

### Phase 3: Cost Calculation Updates (Estimation & Product Services)
**Estimated Time: 2-3 weeks**

#### 3.1 Update Product Cost Calculations
- Modify `productService.getUnitCostOfStandardPipe`
- Use FIFO logic or weighted average across available batches
- Update `productService.calculateProductCost`

#### 3.2 Update Estimation Service
- Modify `estimationService.calculateEstimationMaterials`
- Calculate `autoUnitRate` from available batch rates (weighted average)
- Ensure proper cost calculations for all material categories

#### 3.3 Update Order Service
- Modify material consumption logic in `orderService`
- Track actual batch costs for orders
- Update stock availability checks

### Phase 4: Order Processing & Manufacturing Updates
**Estimated Time: 2-3 weeks**

#### 4.1 Order Material Consumption
- Implement actual batch consumption during order processing
- Track which batches were used for each order
- Create detailed `StockTransaction` records with batch references

#### 4.2 Manufacturing Cost Tracking
- Track actual material costs used in manufacturing
- Link manufactured items to specific material batches
- Enable precise cost analysis

#### 4.3 Stock Transaction Updates
- Add batch reference to `StockTransaction` model
- Update transaction creation logic
- Maintain audit trail of batch usage

### Phase 5: Frontend & Reporting Updates
**Estimated Time: 1-2 weeks**

#### 5.1 Inventory Management UI
- Update stock inward forms to show batch creation
- Display batch information in inventory lists
- Show batch-wise stock availability

#### 5.2 Batch Management Interface
- Create batch viewing and management screens
- Show FIFO order and batch details
- Enable batch-specific adjustments if needed

#### 5.3 Reporting Updates
- Update inventory valuation reports to use batch costs
- Show batch aging reports
- Update cost analysis reports

### Phase 6: Testing & Validation
**Estimated Time: 1-2 weeks**

#### 6.1 Data Integrity Testing
- Verify migration accuracy
- Test FIFO consumption logic
- Validate cost calculations

#### 6.2 Performance Testing
- Test with large numbers of batches
- Optimize queries if needed
- Monitor aggregation performance

#### 6.3 User Acceptance Testing
- Train users on new batch concepts
- Validate business logic with real scenarios
- Test edge cases (zero stock, single batch, etc.)

## Implementation Sequence

### Week 1-2: Foundation
1. Create new Material schema with batch support
2. Implement BatchService core functions
3. Create data migration script
4. Test migration with sample data

### Week 3-4: Stock Management
1. Update stock inward process
2. Modify Material pre-save hook
3. Implement FIFO consumption logic
4. Test inventory operations

### Week 5-7: Cost Calculations
1. Update product cost calculations
2. Modify estimation service
3. Update order service
4. Test cost accuracy

### Week 8-10: Order & Manufacturing
1. Implement order material consumption
2. Update manufacturing cost tracking
3. Enhance stock transactions
4. Test end-to-end flows

### Week 11-12: Frontend & Reporting
1. Update inventory UI
2. Create batch management interface
3. Update reports
4. Test user workflows

### Week 13-14: Testing & Deployment
1. Comprehensive testing
2. Performance optimization
3. User training
4. Production deployment

## Risk Mitigation

### High Risk Items
1. **Data Migration Accuracy** - Critical that existing data migrates correctly
   - *Mitigation:* Extensive testing on copy of production data
   - *Rollback:* Keep backup of pre-migration state

2. **Performance Impact** - Batch queries might be slower than current averaging
   - *Mitigation:* Optimize queries, add proper indexing
   - *Monitoring:* Set up performance monitoring

3. **Business Logic Complexity** - FIFO logic adds complexity
   - *Mitigation:* Thorough testing of edge cases
   - *Documentation:* Clear documentation of FIFO rules

### Medium Risk Items
1. **User Training** - New batch concepts need user understanding
2. **Frontend Complexity** - Batch display adds UI complexity
3. **Reporting Changes** - Existing reports need updates

## Success Criteria

### Technical Success
- [ ] All existing materials migrated to batch format
- [ ] FIFO consumption working correctly
- [ ] Cost calculations accurate across all modules
- [ ] No performance degradation
- [ ] All tests passing

### Business Success
- [ ] Accurate material costing in all quotations
- [ ] Precise inventory valuations
- [ ] Correct manufacturing cost tracking
- [ ] User acceptance of new system
- [ ] Improved decision making from accurate data

## Rollback Plan

### Phase-by-Phase Rollback
- Each phase includes rollback procedures
- Database backup before each major change
- Feature flags for new vs old logic during transition
- Gradual rollout with ability to revert

### Emergency Rollback
- Restore from pre-migration backup
- Switch to old material costing logic
- Re-run any transactions created during batch period

## Post-Implementation Benefits

1. **Accurate Costing** - Material costs reflect actual purchase prices
2. **Better Decision Making** - True inventory values for business decisions
3. **Improved Traceability** - Track materials from purchase to usage
4. **Flexible Pricing** - Handle price fluctuations correctly
5. **Audit Trail** - Complete history of material movements and costs
6. **Compliance Ready** - Better for accounting and audit requirements

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1 | 2 weeks | New schema, BatchService, Migration script |
| Phase 2 | 2 weeks | Updated stock management |
| Phase 3 | 3 weeks | Updated cost calculations |
| Phase 4 | 3 weeks | Order & manufacturing updates |
| Phase 5 | 2 weeks | Frontend & reporting |
| Phase 6 | 2 weeks | Testing & deployment |
| **Total** | **14 weeks** | **Complete batch tracking system** |

## Resource Requirements

- **Backend Developer**: Full-time for entire project
- **Frontend Developer**: Part-time (Phases 5-6)
- **QA Engineer**: Part-time (All phases, full-time Phase 6)
- **Product Owner**: Part-time for requirements and UAT
- **DevOps**: Support for deployment and monitoring

This migration will significantly improve the accuracy and reliability of material costing across the entire application. 