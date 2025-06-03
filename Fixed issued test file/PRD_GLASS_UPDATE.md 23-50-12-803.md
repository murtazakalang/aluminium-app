# Product Requirements Document (PRD): Glass Category Logic Update
**Aluminium Window ERP System**

## Version Information
- **Document Version**: 1.0
- **Date**: January 2025
- **Author**: AI Assistant
- **Status**: Draft

---

## 1. Executive Summary

This PRD outlines a major enhancement to the Glass category logic in the existing Aluminium Window ERP system. The update introduces **formula-based glass area calculation**, **per-item glass type selection**, and **enhanced quotation/order workflows** while maintaining backward compatibility with all existing functionality.

### Key Changes
1. **Product Type Configuration**: Replace fixed glass type with customizable area calculation formulas
2. **Estimation Module**: Add per-item glass type selection with automated quantity calculation
3. **Quotation Module**: Include glass type and frame colour selection per item for display
4. **Order Management**: Carry forward glass information for accurate material planning

---

## 2. Current System Analysis

### Existing Glass Implementation
Based on codebase analysis, the current system has:

- **ProductType Model**: Materials array with formula-based quantity calculation
- **Estimation Module**: Material calculation aggregated by materialId
- **Quotation Module**: Area-based pricing with item details
- **Order Module**: Material cuts tracking per item
- **Inventory Management**: Glass materials tracked with totalStockQuantity and unitRateForStockUnit

### Current Data Flow
```
ProductType (with material formulas) 
→ Estimation (aggregated material quantities)
→ Quotation (area-based pricing)
→ Order (material cuts per item)
```

---

## 3. Goals and Objectives

### Primary Goals
1. **Enhance Product Flexibility**: Allow one product type to work with multiple glass types
2. **Improve Cost Accuracy**: Use actual glass inventory rates for precise costing
3. **Streamline Selection Process**: Enable per-item glass type selection in estimations/quotations
4. **Maintain Data Integrity**: Preserve all existing functionality and workflows

### Success Criteria
- ✅ Product types support formula-based glass area calculation
- ✅ Each estimation/quotation item can have different glass types
- ✅ Glass costs automatically calculated from inventory rates
- ✅ All existing modules continue to function without disruption
- ✅ PDF outputs include glass type and frame colour information

---

## 4. Detailed Requirements

### 4.1 Product Type Configuration Changes

#### Current State
```javascript
// ProductType.materials currently includes specific glass materialId
materials: [{
    materialId: ObjectId("glass_material_id"),
    formulas: ["(W*H)/144"], // Fixed to specific glass type
    // ...
}]
```

#### Target State
```javascript
// ProductType.glassAreaFormula - not tied to specific glass type
glassAreaFormula: {
    formula: "(W - 4.75)/2 * (H - 5)", // Customizable formula
    formulaInputUnit: "inches",
    outputUnit: "sqft", // or "sqm"
    description: "Glass area calculation for this product type"
}
```

#### Requirements
- **R4.1.1**: Add `glassAreaFormula` object to ProductType schema
- **R4.1.2**: Remove glass materials from materials array during migration
- **R4.1.3**: Admin panel UI to configure glass area formula per product type
- **R4.1.4**: Formula validation with variables W (width) and H (height)
- **R4.1.5**: Support mathematical operators: `+`, `-`, `*`, `/`, `()`, and basic functions

### 4.2 Estimation Module Changes

#### Current State
- Aggregated material calculation by materialId
- No glass type selection per item

#### Target State
- Per-item glass type selection
- Formula-based glass quantity calculation
- Cost calculation using selected glass inventory rate

#### Requirements
- **R4.2.1**: Add `selectedGlassTypeId` field to estimation items
- **R4.2.2**: Glass type dropdown populated from Glass category inventory
- **R4.2.3**: Automatic glass quantity calculation using ProductType.glassAreaFormula
- **R4.2.4**: Cost calculation: `glassQuantity × selectedGlassType.unitRateForStockUnit`
- **R4.2.5**: Glass materials appear separately in calculatedMaterials array
- **R4.2.6**: Maintain existing profile/hardware calculation logic unchanged

### 4.3 Quotation Module Changes

#### Current State
- Area-based pricing per item
- No glass/frame information stored

#### Target State
- Glass type selection per item (for display/printing)
- Frame colour selection per item (for display/printing)
- No cost impact (quote price already includes everything)

#### Requirements
- **R4.3.1**: Add `selectedGlassTypeId` and `frameColour` to quotation items
- **R4.3.2**: Glass type dropdown (pre-populated from estimation if converted)
- **R4.3.3**: Frame colour dropdown/input field
- **R4.3.4**: Fields are for display/printing only - no cost recalculation
- **R4.3.5**: PDF generation includes glass type and frame colour per item
- **R4.3.6**: Convert-from-estimation preserves glass type selection

### 4.4 Order Management Changes

#### Current State
- Material cuts calculated per item
- No glass-specific information

#### Target State
- Glass type and frame colour preserved from quotation
- Glass information available for material planning

#### Requirements
- **R4.4.1**: Copy `selectedGlassTypeId` and `frameColour` from quotation
- **R4.4.2**: Display glass information in order detail views
- **R4.4.3**: Include glass details in material estimation workflows
- **R4.4.4**: Maintain glass information through manufacturing process

---

## 5. Data Model Changes

### 5.1 ProductType Schema Updates

```javascript
// ADD to existing ProductType schema
const productTypeSchema = new mongoose.Schema({
    // ... existing fields ...
    
    // NEW: Glass area calculation formula
    glassAreaFormula: {
        formula: { 
            type: String, 
            default: "" // Empty means no glass for this product
        },
        formulaInputUnit: { 
            type: String, 
            enum: ['inches', 'mm', 'ft', 'm'], 
            default: 'inches' 
        },
        outputUnit: { 
            type: String, 
            enum: ['sqft', 'sqm'], 
            default: 'sqft' 
        },
        description: { 
            type: String, 
            default: "" 
        }
    },
    
    // ... existing fields ...
}, { timestamps: true });
```

### 5.2 Estimation Schema Updates

```javascript
// UPDATE existing Estimation items
items: [{
    // ... existing fields ...
    
    // NEW: Glass type selection per item
    selectedGlassTypeId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Material' // References Glass category material
    },
    selectedGlassTypeNameSnapshot: String,
    
    // NEW: Calculated glass details for this item
    calculatedGlassQuantity: { 
        type: mongoose.Types.Decimal128 
    },
    calculatedGlassUnit: { 
        type: String, 
        enum: ['sqft', 'sqm'] 
    },
    calculatedGlassCost: { 
        type: mongoose.Types.Decimal128 
    },
    
    // ... existing fields ...
}],

// UPDATE calculatedMaterials to handle glass separately
calculatedMaterials: [{
    // ... existing fields ...
    
    // NEW: Source tracking for glass materials
    sourceType: { 
        type: String, 
        enum: ['profile', 'hardware', 'glass'], 
        default: 'profile' 
    },
    sourceItemIds: [{ 
        type: mongoose.Schema.Types.ObjectId 
    }], // References estimation.items that contributed to this material
    
    // ... existing fields ...
}],
```

### 5.3 Quotation Schema Updates

```javascript
// UPDATE existing Quotation items
items: [{
    // ... existing fields ...
    
    // NEW: Glass and frame information for display
    selectedGlassTypeId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Material' 
    },
    selectedGlassTypeNameSnapshot: String,
    frameColour: { 
        type: String, 
        default: "" 
    },
    
    // ... existing fields ...
}],
```

### 5.4 Order Schema Updates

```javascript
// UPDATE existing Order items
items: [{
    // ... existing fields ...
    
    // NEW: Glass and frame information carried forward
    selectedGlassTypeId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Material' 
    },
    selectedGlassTypeNameSnapshot: String,
    frameColour: { 
        type: String, 
        default: "" 
    },
    
    // ... existing fields ...
}],
```

---

## 6. API Changes

### 6.1 New Endpoints

```javascript
// Product Type Glass Formula Management
GET /api/products/{productId}/glass-formula
PUT /api/products/{productId}/glass-formula
POST /api/products/validate-glass-formula

// Glass Type Selection Support
GET /api/inventory/materials/glass // Filter for Glass category materials
GET /api/estimations/{estimationId}/calculate-glass // Calculate glass for specific item

// Frame Colour Management (Optional)
GET /api/settings/frame-colours // Predefined colour options
POST /api/settings/frame-colours
```

### 6.2 Modified Endpoints

```javascript
// Enhanced estimation calculation
POST /api/estimations/{estimationId}/calculate
// Now handles glass calculation per item with selected glass types

// Enhanced quotation conversion
POST /api/estimations/{estimationId}/to-quotation  
// Preserves glass type selections

// Enhanced order conversion
POST /api/orders/from-quotation/{quotationId}
// Carries forward glass and frame information
```

---

## 7. User Experience Changes

### 7.1 Product Type Configuration (Admin Panel)

#### Current UX
- Select specific glass materials from inventory
- Define formulas per material

#### New UX
- Configure glass area calculation formula (if product uses glass)
- Formula input with validation and testing
- Preview calculation with sample dimensions
- Help text with available variables (W, H) and operators

#### Mockup Flow
```
1. Product Type Form
   ├── Basic Info (name, description)
   ├── Materials (profiles, hardware) 
   ├── Glass Area Formula (NEW)
   │   ├── Formula Input: "(W - 4.75)/2 * (H - 5)"
   │   ├── Input Unit: [Inches ▼]
   │   ├── Output Unit: [sqft ▼]
   │   ├── [Test Formula] button
   │   └── Formula Description: "Deduct frame thickness..."
   └── Labour Cost
```

### 7.2 Estimation Module

#### Current UX
- Add items with product type and dimensions
- View aggregated material requirements
- Input manual rates per material

#### New UX
- **Enhanced Item Entry**: Glass type dropdown per item
- **Dynamic Cost Calculation**: Glass cost auto-updates based on selection
- **Clear Material Breakdown**: Glass materials listed separately with source items

#### Mockup Flow
```
1. Estimation Items Table
   ┌─────────────────────────────────────────────────────────────────┐
   │ Product Type  │ Dimensions │ Qty │ Glass Type    │
   ├─────────────────────────────────────────────────────────────────┤
   │ 3Track Window │ 48" × 60"  │ 2   │ [5mm Clear ▼] │ 
   │ Casement      │ 36" × 48"  │ 1   │ [8mm Tinted▼] │ 
   └─────────────────────────────────────────────────────────────────┘

2. Calculated Materials (Enhanced)
   ┌───────────────────────────────────────────────────────────────────────────────────┐
   │ Material             │ Category │ Total Quantity             │ Unit │ Rate │ Cost │
   ├───────────────────────────────────────────────────────────────────────────────────┤
   │ Clear Glass 5mm      │ Glass    │ 48.00                      │ sqft │ 55.00 / sqft     │ ₹2640.00 │
   │ Reflective Glass 5mm │ Glass    │ 40.50                      │ sqft │ 65.00 / sqft     │ ₹2632.50│
   │ Alboss Lock 55       │ Hardware │ 1.00                       │ pcs  │ 35.00 / pcs    │ ₹35.00 │
   │ 3 Track Bottom Pipe  │ Profile  │ 2 (1 × 15.00ft)(1 × 12.00ft)│ pipes│ 330.00 / kg    │ ₹300 │
   │                      │          │ Weight: 2.41kg              │  │                 │      │
   └──────────────────────────────────────────────────────────────────┘
```

### 7.3 Quotation Module

#### Current UX
- Item-based pricing with dimensions
- Add charges and discounts
- Generate PDF

#### New UX
- **Enhanced Item Details**: Glass type and frame colour selection
- **Visual Clarity**: Clear indication that these are for display only
- **PDF Enhancement**: Glass and frame info per item in PDF

#### Mockup Flow
```
1. Quotation Item Form (Enhanced)
   ┌─────────────────────────────────────────────────────────┐
   │ Product: 3Track Sliding Window                          │
   │ Dimensions: 48" × 60" │ Quantity: 2                    │
   │ Price per sqft: ₹150  │ Total: ₹4,000                  │
   │                                                         │
   │ Display Information (No cost impact):                   │
   │ Glass Type: [5mm Clear Glass ▼] (from estimation)      │
   │ Frame Colour: [White ▼]                                │
   │                                                         │
   │ ℹ️ Glass type preselected from estimation. Frame       │
   │    colour is for specification only.                    │
   └─────────────────────────────────────────────────────────┘
```

### 7.4 PDF Generation Updates

#### Enhanced Quotation PDF
```
Item Details Table (Enhanced):
┌──────────────────────────────────────────────────────────────────────────────┐
│ Item │ Product                                 │   Qty │ Rate     │ Amount   │
├──────────────────────────────────────────────────────────────────────────────┤
│ 001  │ 3Track Sliding Window                   │ 1     │ ₹300.00  │ ₹4,000   │
│      │ Frame: White Coated                     │       │          │          │
│      │ Glass: 5mm Brown Reflective             │       │          │          │
│      │ Dimension: W48" x H60" = 20 Sqft        │       │          │          │
│      │ SVG Image of the window here            │       │          │          │
│ 002  │ Casement Window                         │ 1     │ ₹250.00  │ ₹3,000   │
│      │ Frame: White Coated                     │       │          │          │
│      │ Glass: 5mm Clear Tuffen                 │       │          │          │
│      │ Dimension: W48" x H36" = 12 Sqft        │       │          │          │
│      │ SVG Image of the window here            │       │          │          │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Implementation Approach

### 8.1 Migration Strategy

#### Phase 1: Schema Updates (Non-Breaking)
- Add new fields to all schemas with default values
- Deploy schema changes without functionality
- Existing system continues to work normally

#### Phase 2: Backend Logic Implementation
- Implement glass formula calculation engine
- Add new API endpoints
- Update existing endpoints with glass logic
- Comprehensive testing

#### Phase 3: Frontend Implementation
- Update Product Type configuration UI
- Enhance Estimation module with glass selection
- Update Quotation module with display fields
- Update PDF generation

#### Phase 4: Data Migration (If Needed)
- Migrate existing glass materials from ProductType.materials to glassAreaFormula
- Update existing estimations/quotations (optional)

### 8.2 Backward Compatibility

#### Guaranteed Compatibility
- All existing product types without glassAreaFormula continue to work
- Existing estimations/quotations display normally
- All calculation logic for non-glass materials unchanged
- PDF generation maintains existing format for older records

#### Migration Support
```javascript
// Example: Handle legacy product types
if (!productType.glassAreaFormula || !productType.glassAreaFormula.formula) {
    // Legacy product type - check materials array for glass
    const glassMaterials = productType.materials.filter(m => 
        m.materialCategorySnapshot === 'Glass'
    );
    // Handle accordingly...
}
```

### 8.3 Testing Strategy

#### Unit Tests
- Glass formula calculation engine
- Formula validation
- Cost calculation logic
- Data migration scripts

#### Integration Tests
- Complete estimation → quotation → order flow with glass
- PDF generation with glass information
- API endpoints with various glass scenarios

#### User Acceptance Testing
- Product configuration with glass formulas
- Estimation with multiple glass types
- Quotation generation and PDF output
- Order processing with glass information

---

## 9. Risk Assessment and Mitigation

### 9.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|---------|-------------|------------|
| Formula engine errors | High | Medium | Comprehensive testing, validation, fallbacks |
| Performance impact | Medium | Low | Efficient queries, caching, indexing |
| Data migration issues | High | Low | Thorough testing, rollback procedures |
| PDF generation failures | Medium | Low | Error handling, template validation |

### 9.2 Business Risks

| Risk | Impact | Probability | Mitigation |
|------|---------|-------------|------------|
| User confusion | Medium | Medium | Clear UI, training, documentation |
| Workflow disruption | High | Low | Gradual rollout, user feedback |
| Cost calculation errors | High | Low | Extensive validation, audit trails |

---

## 10. Success Metrics

### 10.1 Technical Metrics
- ✅ 100% backward compatibility maintained
- ✅ Formula calculation accuracy: 99.9%
- ✅ API response time < 500ms for glass calculations
- ✅ PDF generation success rate > 99%

### 10.2 Business Metrics
- ✅ User adoption of glass selection feature > 80%
- ✅ Estimation accuracy improvement (user feedback)
- ✅ Reduced support tickets related to glass costing
- ✅ Customer satisfaction with detailed quotations

### 10.3 Quality Metrics
- ✅ Zero critical bugs in production
- ✅ Unit test coverage > 90%
- ✅ User acceptance test pass rate > 95%

---

## 11. Appendices

### Appendix A: Formula Examples

```javascript
// Basic area calculation
"W * H"

// Area with frame deduction
"(W - 4.75) * (H - 5)"

// Multiple panes
"(W - 4.75)/2 * (H - 5)"

// Complex calculation with minimum
"Math.max((W - 6) * (H - 4), 1)"
```

### Appendix B: Glass Type Configuration

```javascript
// Example Glass Material (Inventory)
{
    name: "5mm Clear Glass",
    category: "Glass",
    stockUnit: "sqft",
    usageUnit: "sqft",
    unitRateForStockUnit: "60.00", // ₹60 per sqft
    totalStockQuantity: "1000.00",
    // ... other fields
}
```

### Appendix C: Sample API Responses

```javascript
// GET /api/inventory/materials/glass
{
    "status": "success",
    "data": [
        {
            "_id": "glass_001",
            "name": "5mm Clear Glass",
            "unitRateForStockUnit": "60.00",
            "stockUnit": "sqft",
            "totalStockQuantity": "1000.00"
        },
        {
            "_id": "glass_002", 
            "name": "8mm Tinted Glass",
            "unitRateForStockUnit": "150.00",
            "stockUnit": "sqft", 
            "totalStockQuantity": "500.00"
        }
    ]
}
```

---

**Document End**

This PRD provides a comprehensive roadmap for implementing the Glass category logic update while ensuring system stability and user satisfaction. 