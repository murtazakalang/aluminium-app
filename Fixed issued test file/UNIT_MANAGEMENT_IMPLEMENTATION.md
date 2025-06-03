# Centralized Unit Management System Implementation

## 📋 **Implementation Status**

### ✅ **Phase 1: Centralized Unit Context (COMPLETED)**
- ✅ Created `UnitContext.tsx` - Global unit management context
- ✅ Added `UnitProvider` to dashboard layout
- ✅ Created helper hooks `useUnits()` and `useDefaultUnits()`
- ✅ Auto-derives appropriate units based on General Settings

### ✅ **Phase 2: Material System Updates (COMPLETED)**
- ✅ Updated `BasicInformationStep.tsx` - Removed manual usage unit selection
- ✅ Auto-sets Profile materials to use dimension unit from settings (inches/mm)
- ✅ Auto-sets Glass materials to use area unit from settings (sqft/sqm)
- ✅ Added informational panels explaining auto-configuration
- ✅ Updated `MaterialWizard.tsx` - Smart defaults based on unit settings

### ✅ **Phase 3: Product Type System Updates (COMPLETED)**  
- ✅ Updated `MaterialFormulaInput.tsx` - Removed manual formulaInputUnit selection
- ✅ Auto-sets formula input unit to match dimension unit from settings
- ✅ Added informational panels and visual indicators for auto-configuration

### ✅ **Phase 4: Estimation System Updates (COMPLETED)**
- ✅ Updated `new/page.tsx` - Removed manual dimensionUnitUsed dropdown
- ✅ Auto-sets dimension unit from General Settings for new estimations
- ✅ Updated `edit/page.tsx` - Shows locked dimension unit for existing estimations
- ✅ Added helpful warnings when existing estimation units differ from current settings

### ✅ **Phase 5: Quotation System Updates (COMPLETED)**
- ✅ Updated `quotations/new/page.tsx` - Auto-configured dimension and area units from settings
- ✅ Removed hardcoded unit values in quotation creation
- ✅ Updated `quotations/[id]/edit/page.tsx` - Shows locked units for existing quotations
- ✅ Added unit configuration displays and informational panels
- ✅ Replaced hardcoded calculations with dynamic unit helpers
- ✅ Added warnings when existing quotation units differ from current settings

### ✅ **Phase 6: Orders & Manufacturing Updates (COMPLETED)**
- ✅ Orders automatically inherit units from quotations (no changes needed)
- ✅ Manufacturing workflows already use `order.dimensionUnit` correctly
- ✅ RequiredCutsView component properly uses order-specific units
- ✅ All manufacturing components respect order-inherited unit configurations

## 🎯 **Key Features Implemented**

### **1. Intelligent Unit Defaults**
```typescript
// Profile materials automatically use dimension setting
Profile + inches setting → usageUnit: 'inches'
Profile + mm setting → usageUnit: 'mm'

// Glass materials automatically use area setting  
Glass + sqft setting → usageUnit: 'sqft'
Glass + sqm setting → usageUnit: 'sqm'

// Other materials use fixed units
Hardware/Accessories/Consumables → usageUnit: 'pcs'
```

### **2. Visual Indicators**
- 🔧 Auto-configuration indicators with gear icons
- 📋 Informational panels explaining unit logic
- ⚠️ Warnings when existing records use different units than current settings
- 🔒 Locked unit displays for existing records

### **3. Data Consistency**
- New records automatically use current global settings
- Existing records maintain their original units (locked for consistency)
- Clear visual differentiation between auto-configured and locked units
- Unit inheritance: Quotations → Orders → Manufacturing

### **4. User Experience**
- Eliminated manual unit selection in most forms
- Reduced cognitive load and potential for errors
- Clear explanations of automatic behaviors
- Easy access to change global settings when needed

## 📁 **Files Modified**

### **Core Infrastructure**
- `apps/frontend/src/contexts/UnitContext.tsx` (NEW)
- `apps/frontend/src/app/(dashboard)/layout.tsx`

### **Material Management**
- `apps/frontend/src/components/inventory/wizard-steps/BasicInformationStep.tsx`
- `apps/frontend/src/components/inventory/MaterialWizard.tsx`

### **Product Types**
- `apps/frontend/src/components/products/MaterialFormulaInput.tsx`

### **Estimations**
- `apps/frontend/src/app/(dashboard)/dashboard/estimations/new/page.tsx`
- `apps/frontend/src/app/(dashboard)/dashboard/estimations/[estimationId]/edit/page.tsx`

### **Quotations**
- `apps/frontend/src/app/(dashboard)/dashboard/quotations/new/page.tsx`
- `apps/frontend/src/app/(dashboard)/dashboard/quotations/[quotationId]/edit/page.tsx`

### **Orders & Manufacturing**
- No direct changes required - orders inherit units from quotations
- Manufacturing components already respect order-specific units

## 🏁 **Implementation Complete**

All 6 phases of the centralized unit management system have been successfully implemented:

1. **Foundation**: Centralized unit context and providers
2. **Materials**: Auto-configured usage units based on category and settings  
3. **Product Types**: Auto-configured formula input units from dimension settings
4. **Estimations**: Auto-configured dimension units for new estimations
5. **Quotations**: Auto-configured dimension and area units for new quotations  
6. **Orders & Manufacturing**: Automatic unit inheritance and proper usage

## 🧪 **Testing Recommendations**

1. **Settings Change Test**: Change dimension unit in General Settings, verify new materials use new unit
2. **Mixed Units Test**: Create materials with different settings, verify existing ones remain unchanged
3. **Workflow Test**: Complete material → product → estimation → quotation → order flow with auto-units
4. **Edge Cases**: Test with missing settings, invalid units, etc.
5. **Cross-Module Test**: Verify unit consistency across entire workflow

## 💡 **Benefits Achieved**

1. **Reduced Errors**: No more manual unit mismatches
2. **Better UX**: Fewer decisions for users to make
3. **Consistency**: Global unit preferences applied automatically throughout workflow
4. **Flexibility**: Easy to change global behavior via settings
5. **Data Integrity**: Existing records maintain original units
6. **Future-Proof**: Extensible for additional unit types
7. **Workflow Efficiency**: Seamless unit flow from materials to manufacturing

## 🔧 **System Architecture**

```
General Settings (dimension: inches|mm, area: sqft|sqm)
     ↓
UnitContext (provides defaults and validation)
     ↓
Materials (auto-configured usage units)
     ↓
Product Types (auto-configured formula input units)
     ↓
Estimations (auto-configured dimension units)
     ↓
Quotations (auto-configured dimension & area units)
     ↓
Orders (inherit units from quotations)
     ↓
Manufacturing (respect order-inherited units)
```

This implementation creates a comprehensive, user-friendly unit management system that maintains data consistency while significantly improving the user experience across the entire aluminium ERP workflow.

## 🚀 **Latest Enhancement: Intelligent Unit Rate Management**

### **Smart Unit Rate Calculation for Materials**
A new intelligent unit rate system has been implemented in the material creation workflow:

#### **🎯 Key Features:**
- **Weight-Based Rate Input**: When stock unit is `kg` or `lbs`, users enter rate per weight unit
- **Auto-Calculated Per-Piece Rate**: System automatically calculates per-piece rate for Profile materials
- **Intelligent UI**: Dynamic labels and placeholders based on selected stock unit
- **Visual Indicators**: Clear icons and explanations for auto-calculated values

#### **📐 Calculation Logic:**
For Profile materials with weight-based stock units:
```typescript
// Per-piece rate calculation
totalWeightPerPiece = lengthOfPiece × weightPerUnitLength(gauge)
perPieceRate = ratePerWeightUnit × totalWeightPerPiece

// Example: 15ft Profile, 18G (0.24 kg/ft), Rate: ₹50/kg
// totalWeightPerPiece = 15 × 0.24 = 3.6 kg
// perPieceRate = ₹50 × 3.6 = ₹180 per piece
```

#### **🎮 User Experience:**
1. **Stock Unit = "kg"** → User enters "₹50/kg" → System shows "₹180/piece" (auto-calculated)
2. **Stock Unit = "lbs"** → User enters "₹25/lbs" → System shows "₹xyz/piece" (auto-calculated)  
3. **Stock Unit = "pipe"** → User enters "₹180/piece" directly (no calculation needed)

#### **📁 Files Modified:**
- `apps/frontend/src/components/inventory/wizard-steps/InitialStockStep.tsx` - Enhanced with smart rate calculation

#### **🔧 Technical Implementation:**
- Added `calculatePerPieceRate()` helper function
- Created `getUnitRateInfo()` for dynamic UI configuration  
- Added informational panels explaining the calculation logic
- Implemented real-time rate calculation based on length, gauge, and weight data
- Enhanced both Profile and non-Profile material rate handling

This enhancement makes the material setup process more intuitive and reduces calculation errors while providing transparency into how rates are determined.

## 🔧 **Critical Fix: Proper Unit Rate Storage**

### **Issue Resolved:**
The system was correctly displaying calculated per-piece rates in the UI but incorrectly saving the raw weight-based rates (e.g., ₹330/kg) instead of the calculated per-piece rates (e.g., ₹148.50/piece) in the database.

### **Root Cause:**
According to the Material schema, the `unitRate` field in `stockByLength` should store the "Cost PER PIPE of this standard length", but the frontend was sending the user-entered weight-based rate instead of the calculated per-piece rate.

### **Solution Implemented:**
1. **Added `weightBasedRate` field** to `StockEntry` interface to store the original user input
2. **Modified `handleStockChange` function** to automatically calculate and store per-piece rates:
   - When user enters weight-based rate (kg/lbs): stores in `weightBasedRate`, calculates per-piece rate for `unitRate`
   - When user enters per-piece rate (pipe): stores directly in `unitRate`
3. **Updated UI logic** to show weight-based input while storing calculated per-piece rates
4. **Added real-time recalculation** when length or gauge changes

### **Code Changes:**
```typescript
// New interface structure
interface StockEntry {
  // ... existing fields
  unitRate: string;        // Stores calculated per-piece rate for database
  weightBasedRate?: string; // Stores original weight-based rate for UI
}

// Intelligent rate handling
if (isWeightBased && formData.category === 'Profile') {
  const weightBasedRate = parseFloat(value) || 0;
  const perPieceRate = calculatePerPieceRate(updatedStock[index], weightBasedRate);
  
  updatedStock[index] = { 
    weightBasedRate: value,                    // Store original input
    unitRate: perPieceRate.toFixed(2)         // Store calculated per-piece rate
  };
}
```

### **Database Impact:**
- **Before Fix**: `unitRate: 330` (raw kg rate)
- **After Fix**: `unitRate: 148.50` (calculated per-piece rate), `weightBasedRate: 330` (original input)

### **User Benefits:**
- ✅ Correct per-piece rates stored in database for accurate costing
- ✅ Maintains user-friendly weight-based input experience
- ✅ Automatic recalculation when length/gauge changes
- ✅ Clear visual indicators showing both input and calculated values
- ✅ Consistent with Material schema requirements

## 🔧 **Critical Fix: Stock Inward Weight Calculation**

### **Issue Resolved:**
When adding stock inward entries with actual weights, the system was showing incorrect total weights due to retroactive gauge weight recalculation. For example:
- **Expected**: 7.5kg (existing) + 14kg (new inward) = 21.5kg
- **Actual**: 21.3kg (0.2kg discrepancy)

### **Root Cause:**
The inventory service was updating `gaugeSpecificWeights.weightPerUnitLength` based on new stock inward data, which caused:
1. **Gauge weight recalculation**: New batch weight ÷ new batch length = new weight per unit
2. **Retroactive weight changes**: Existing stock weights recalculated using new gauge weight
3. **Weight loss**: Actual provided weights ignored in favor of calculated weights

**Example Problem:**
```javascript
// Original: 20G = 0.2kg/ft
// New stock: 5 pieces × 15ft = 75ft, 14kg total
// System calculated: 14kg ÷ 75ft = 0.1867kg/ft
// Updated gauge weight: 20G = 0.1867kg/ft
// Recalculated existing: 1 piece × 15ft × 0.1867kg/ft = 2.8kg (not 3kg!)
```

### **Solution Implemented:**

#### **1. Added `actualWeight` Field to Material Schema**
```javascript
stockByLength: [{
  // ... existing fields
  actualWeight: { type: mongoose.Types.Decimal128 }, // Actual total weight for this stock entry
}]
```

#### **2. Preserved Gauge Weights in Inventory Service**
- **Before**: Updated `weightPerUnitLength` based on new batch data
- **After**: Preserves original gauge weights, doesn't overwrite with batch-specific data

#### **3. Enhanced Pre-Save Hook Logic**
```javascript
// Use actualWeight if available, otherwise calculate from gauge weights
if (actualWeight && actualWeight > 0) {
    weightForThisStock = actualWeight; // Use provided actual weight
} else if (stockGauge && gaugeWeights[stockGauge]) {
    weightForThisStock = length * quantity * gaugeWeight; // Calculate from gauge
}
```

#### **4. Track Actual Weights in Stock Inward**
- New stock entries: Store `actualWeight` from provided data
- Existing stock updates: Add new actual weight to existing actual weight
- Total weight calculation: Sum of all actual weights (when available)

### **Database Impact:**
```javascript
// Before Fix
stockByLength: [
  { gauge: '18G', quantity: 1, /* calculated weight only */ },
  { gauge: '20G', quantity: 6, /* calculated weight only */ }
]
// Result: 21.3kg (recalculated)

// After Fix  
stockByLength: [
  { gauge: '18G', quantity: 1, actualWeight: 4.5 }, // Original weight preserved
  { gauge: '20G', quantity: 6, actualWeight: 17 }   // 3kg original + 14kg new = 17kg
]
// Result: 21.5kg (actual weights)
```

### **Technical Implementation Details:**

#### **1. Initial Material Creation**
- Automatically calculates `actualWeight` for all initial stock entries
- Uses formula: `actualWeight = length × quantity × weightPerUnitLength`
- Ensures every stock entry starts with proper weight tracking

#### **2. Stock Inward Processing**
```javascript
// For existing stock entries without actualWeight:
if (!stockLengthEntry.actualWeight) {
    // Calculate existing weight from gauge data
    existingWeight = quantity × length × gaugeWeight;
} else {
    // Use stored actualWeight
    existingWeight = stockLengthEntry.actualWeight;
}

// Combine weights properly
combinedActualWeight = existingWeight + newStockWeight;
```

#### **3. Weight Calculation Priority**
1. **Use actualWeight if available** (highest priority)
2. **Calculate from gauge weights** (fallback for older data)
3. **Use average weight** (last resort)

This ensures backward compatibility while providing accurate tracking for new data.

### **User Benefits:**
- ✅ **Accurate weight tracking**: Uses actual provided weights, not calculated estimates
- ✅ **Batch weight preservation**: Different batches can have different actual weights  
- ✅ **No retroactive changes**: Existing stock weights remain unchanged
- ✅ **Flexibility**: Falls back to calculated weights when actual weights not provided
- ✅ **Data integrity**: Maintains accurate inventory weight totals