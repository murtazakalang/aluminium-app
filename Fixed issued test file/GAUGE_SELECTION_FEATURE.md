# Gauge Selection Feature in Product Type Formula

## Overview
This feature enhances the product type formula configuration by allowing users to select gauge values from the available gauges defined in the material's inventory, instead of manually typing a gauge value.

## How It Works

### 1. **Material Selection**
When configuring a product type formula:
1. User selects a material from the inventory dropdown
2. If the material category is "Profile", the gauge selection becomes available

### 2. **Gauge Selection Options**

#### **A. Dynamic Dropdown (Preferred)**
- If the selected material has `gaugeSpecificWeights` defined in inventory:
  - A dropdown appears showing all available gauges
  - Each option displays: `[Gauge] ([Weight] [WeightUnit]/[UnitLength])`
  - Example: `18G (0.240 kg/ft)`
  - User can select from predefined gauges only

#### **B. Manual Input (Fallback)**
- If the material has no gauge-specific weights defined:
  - A text input field appears (same as before)
  - User can manually enter gauge value
  - A help text explains how to add gauges to the material inventory

### 3. **Data Structure**

#### **Material Model**
```javascript
gaugeSpecificWeights: [{
  gauge: String,              // e.g., "18G", "20G", "1.2mm"
  weightPerUnitLength: Decimal128,  // Weight per unit length
  unitLength: String          // e.g., "ft", "m"
}]
```

#### **ProductType Material**
```javascript
materials: [{
  materialId: ObjectId,
  defaultGauge: String,       // Selected from available gauges
  // ... other fields
}]
```

## Benefits

### 1. **Data Consistency**
- Ensures gauge values match exactly with inventory data
- Prevents typos and inconsistent gauge naming
- Maintains referential integrity between product formulas and material inventory

### 2. **User Experience**
- Autocomplete-style selection for faster input
- Visual display of weight information helps with selection
- Clear feedback when gauges are not available

### 3. **Cost Accuracy**
- Accurate weight calculations using predefined gauge weights
- Better cost estimation based on actual material specifications

## Technical Implementation

### Frontend Changes
- **File**: `apps/frontend/src/components/products/MaterialFormulaInput.tsx`
- **Enhancement**: Replaced text input with conditional dropdown/input
- **Features**:
  - Dropdown shows available gauges with weight information
  - Fallback to text input if no gauges defined
  - Proper handling of Decimal128 values from MongoDB

### Backend Integration
- Uses existing material inventory API
- No backend changes required
- Leverages existing `gaugeSpecificWeights` structure

## Usage Examples

### Example 1: Profile Material with Defined Gauges
```
Material: "3Track Top Profile"
Available Gauges:
- 18G (0.240 kg/ft)
- 20G (0.180 kg/ft) 
- 22G (0.150 kg/ft)

User selects: "18G" from dropdown
```

### Example 2: Profile Material without Defined Gauges
```
Material: "Custom Profile"
Gauges: None defined

User sees: Text input with message
"No gauges defined for this material. Add gauges to the material inventory for dropdown selection."
```

## Future Enhancements

1. **Quick Add Gauge**: Add ability to create new gauges directly from product form
2. **Gauge Validation**: Warn if selected gauge conflicts with material specifications
3. **Bulk Updates**: Update gauge selection across multiple product types
4. **Weight Preview**: Show calculated weight preview for current formula

## Testing Recommendations

1. Test with materials that have multiple gauges defined
2. Test with materials that have no gauges defined
3. Verify weight calculations use selected gauge correctly
4. Test gauge selection in quotation/invoice generation
5. Verify PDF generation includes correct gauge information

This feature improves the accuracy and user experience of the aluminium window manufacturing system by connecting product formulas directly with inventory specifications. 