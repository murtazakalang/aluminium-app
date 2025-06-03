# How to Access the New Batch-Based Inventory System

## 🚀 Quick Access

### Method 1: Direct URL
1. Make sure both backend and frontend servers are running
2. Navigate to: `http://localhost:3000/dashboard/inventory/batch`

### Method 2: From Current Inventory Page
1. Go to your current inventory page: `http://localhost:3000/dashboard/inventory`
2. You'll see a **blue banner** at the top with "New: Batch-Based Inventory System"
3. Click the **"Try New System"** button

## 🎯 What You'll See

### Dashboard Overview
- **Executive Metrics**: Total materials, inventory value, low stock alerts, active batches
- **Quick Actions**: Stock Inward, Consume Stock, Analytics buttons
- **Materials Table**: Complete list with search and filtering

### Key Features Available

#### 1. **Stock Inward** 
- Click "Stock Inward" from dashboard
- Select existing material or create new one
- Enter length, quantity, total cost
- **Add actual weight** (highly recommended) - this preserves exact weights forever
- Add supplier, invoice details
- Submit → Creates new batch with unique ID

#### 2. **Stock Consumption**
- Select material and click "View" → then "Consume"
- Set filters (length, gauge) - optional
- Enter quantity needed
- Choose FIFO (oldest first) or LIFO (newest first)
- **See real-time preview** of which batches will be consumed
- Submit → Consumes from appropriate batches

#### 3. **Batch History**
- View complete transaction history
- Advanced filtering by date, supplier, gauge
- **Export to CSV** for reporting
- Real-time analytics dashboard

## 🔧 Troubleshooting

### ✅ **FIXED: Duplicate Key Error**
The system now properly handles existing materials from your legacy system:
- Materials marked `(Legacy)` will be **automatically migrated** to the batch system
- No duplicate errors - the system intelligently handles migration
- Your existing data is preserved during migration

### If the system doesn't load:
1. **Check backend is running**: 
   ```bash
   cd apps/backend && npm run dev
   ```

2. **Check frontend is running**:
   ```bash
   cd apps/frontend && npm run dev
   ```

3. **Check console for errors**: Press F12 in browser and check Console tab

### If API calls fail:
- Ensure you're logged in to the system
- Check that backend is responding at `http://localhost:8000`
- Verify the v2 API endpoints are available

### **Migration Process**
When you select an existing material:
- The system automatically migrates it to the new batch system
- Your first stock entry becomes the first batch
- All future entries for that material will be batch-tracked
- Legacy data is preserved and accessible

## 📊 Benefits You'll Notice

### Immediate Improvements
- **Exact Weight Preservation**: No more 18.5kg vs 21.5kg calculation errors
- **Complete Traceability**: Know exactly where each piece came from
- **Real-time Calculations**: Instant rate calculations without saving
- **Smart Consumption**: See exactly which batches will be used before confirming

### Business Impact
- **Manufacturing**: Exact weights for cutting plans
- **Accounting**: Batch-level costing with audit trail  
- **Management**: Real-time visibility into inventory
- **Quality**: Complete supplier and lot tracking

## 🎓 Quick Start Workflow

### Adding Your First Batch
1. Go to `/dashboard/inventory/batch`
2. Click "Stock Inward"
3. **Select existing material** (will auto-migrate) OR create new
4. Enter: 12 ft length, 20 pieces, ₹3200 total cost
5. Add actual weight: 21.5 kg (this solves the calculation error!)
6. Add supplier details
7. Submit → You'll get a unique batch ID

### Consuming Stock
1. Click "View" on the material
2. Click "Consume" 
3. Enter quantity needed: 15 pieces
4. See preview showing which batches will be used
5. Submit → Stock consumed with complete audit trail

## 🔄 **System Migration Status**

### What Happens During Migration:
- ✅ **Seamless**: Select any existing material from dropdown
- ✅ **Automatic**: System detects if it needs migration
- ✅ **Safe**: Original data is preserved
- ✅ **Smart**: Prevents duplicates and conflicts
- ✅ **Transparent**: Shows `(Legacy)` vs `V2` system status

### Material Status Indicators:
- **No suffix**: New batch system material
- **(Legacy)**: Will migrate on first batch entry
- **[Will migrate to batch system]**: Shown in dropdown

## 🆘 Support

If you encounter any issues:
1. Check the browser console (F12) for error messages
2. Verify both servers are running
3. Test the old system works to confirm basic connectivity
4. Review the Phase 2 implementation documentation

**The new system runs alongside your existing inventory - you can use both during transition!**

## 🎉 **Latest Updates**
- ✅ Fixed duplicate key error when using existing materials
- ✅ Added automatic migration from legacy system
- ✅ Improved material selection with system indicators
- ✅ Enhanced error handling and user feedback 