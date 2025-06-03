# Gauge Auto-Fill Fixes

## Issues Fixed

### 1. **Gauge Not Pre-selecting and Resetting After Save**

**Problem**: 
- Gauge field was showing "Select gauge" but not pre-selecting values
- Selected gauge values were resetting after form save
- Auto-fill logic was not working properly

**Root Cause**:
- Complex auto-fill logic in `handleGaugeWeightChange` was causing state conflicts
- Missing useEffect to handle initial auto-fill when form loads with data
- Dependencies in useEffect were causing infinite loops

**Solution**:
- Added dedicated useEffect for auto-filling gauge fields when gauge weights become available
- Simplified `handleGaugeWeightChange` to avoid state conflicts
- Used more specific dependencies to prevent infinite loops
- Auto-fill now triggers when:
  - Form loads with gauge weights but stock entries have empty gauges
  - First gauge weight is added to an existing material

### 2. **Layout Order Issue**

**Problem**: 
- Gauge Specific Weights section was appearing after Stock By Length section
- This was confusing because users need to define gauges before using them in stock entries

**Solution**:
- Moved Gauge Specific Weights section to appear before Stock By Length section
- Updated help text to reference "section above" instead of "section below"
- Now follows logical workflow: Standard Lengths → Gauge Weights → Stock Entries

## Implementation Details

### **Auto-Fill Logic**
```javascript
// Auto-fill gauge fields when gauge weights are available and stock entries have empty gauges
useEffect(() => {
  if (formData.category === 'Profile' && 
      formData.gaugeSpecificWeights.length > 0 && 
      formData.stockByLength.length > 0) {
    
    // Check if there are stock entries without gauges that could be auto-filled
    const entriesWithoutGauges = formData.stockByLength.filter(stock => !stock.gauge || stock.gauge.trim() === '');
    
    if (entriesWithoutGauges.length > 0) {
      // Get the first available gauge as default
      const defaultGauge = formData.gaugeSpecificWeights[0]?.gauge;
      
      if (defaultGauge && defaultGauge.trim() !== '') {
        const updatedStock = formData.stockByLength.map(stock => {
          if (!stock.gauge || stock.gauge.trim() === '') {
            return { ...stock, gauge: defaultGauge };
          }
          return stock;
        });
        
        setFormData(prev => ({
          ...prev,
          stockByLength: updatedStock
        }));
      }
    }
  }
}, [formData.gaugeSpecificWeights.length, formData.gaugeSpecificWeights[0]?.gauge]);
```

### **Simplified Event Handler**
```javascript
// Handler for gauge specific weights
const handleGaugeWeightChange = (index: number, field: string, value: string) => {
  const updatedWeights = [...formData.gaugeSpecificWeights];
  updatedWeights[index] = { ...updatedWeights[index], [field]: value };
  
  setFormData((prev) => ({
    ...prev,
    gaugeSpecificWeights: updatedWeights,
  }));
};
```

## New Section Order

1. **Standard Lengths** - Define available lengths for the material
2. **Gauge Specific Weights** - Define gauge options and their weights
3. **Stock By Length** - Actual stock entries using the defined gauges

## Auto-Fill Behavior

### **When Editing Existing Material**
- If material has gauge weights but stock entries have empty gauges → Auto-fills with first available gauge
- If stock entries already have gauges → No changes made
- Dropdown shows all available gauges with weight information

### **When Adding New Stock Entries**
- Uses most common gauge from existing stock entries
- Falls back to first available gauge from gauge weights
- Empty if no gauges are defined

### **When Adding Gauge Weights**
- useEffect automatically detects new gauge weights
- Auto-fills any empty gauge fields in stock entries
- Only fills empty fields, doesn't overwrite existing selections

## Benefits of the Fix

### **Improved User Experience**
- Gauge fields now properly auto-populate
- No more resetting of selected values
- Logical section ordering guides user workflow

### **Consistent Behavior**
- Auto-fill works consistently across all scenarios
- Form state is properly maintained during edits
- No more state conflicts or infinite loops

### **Better Performance**
- Simplified event handlers reduce unnecessary re-renders
- Targeted useEffect dependencies prevent excessive updates
- More efficient state management

## Testing Scenarios

### ✅ **Auto-Fill Working**
- [x] Load existing material with gauge weights → Empty stock gauges auto-filled
- [x] Add new gauge weight to material → Empty stock gauges auto-filled  
- [x] Add new stock entry → Uses most common or first available gauge
- [x] Edit existing stock entry → Dropdown shows correct options
- [x] Save form → Selected gauges persist correctly

### ✅ **Layout Fixed**
- [x] Gauge Specific Weights appears before Stock By Length
- [x] Help text references correct section location
- [x] Logical workflow: Define gauges first, then use in stock

### ✅ **No Regressions**
- [x] Manual gauge input still works when no gauge weights defined
- [x] Form validation continues to work properly
- [x] Backward compatibility with existing materials maintained
- [x] No infinite loops or performance issues

The gauge auto-fill functionality now works as expected, providing a seamless user experience while maintaining proper form state management and logical section ordering. 