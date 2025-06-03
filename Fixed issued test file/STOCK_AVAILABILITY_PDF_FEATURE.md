# Stock Availability Check PDF Feature

## Overview
Added PDF download functionality for stock availability checks in orders. This feature provides a comprehensive manufacturing readiness report that includes material requirements, stock availability status, and glass requirements.

## Purpose
The Stock Availability Check PDF is designed as an order placement check before proceeding to manufacturing. It helps production teams verify that all required materials and glass are available before starting production work.

## Features Included

### 1. **Material Stock Availability**
- Lists all required materials from the order
- Shows current stock status (Sufficient/Insufficient/Not Found)
- Displays required quantities and cuts
- Shows available stock and any shortfalls
- Includes all material categories (Profile, Hardware, Wire Mesh, etc.)

### 2. **Glass Requirements**
- Calculates glass requirements for each window/item
- Shows glass type, dimensions, and total pieces needed
- Uses product type glass formulas for accurate calculations
- Displays window numbers for easy reference

### 3. **Summary Statistics**
- Total materials count
- Materials in stock vs insufficient
- Total glass types required
- Quick overview of manufacturing readiness

### 4. **Professional PDF Format**
- Company branding and information
- Order details and status
- Color-coded status indicators
- Professional layout suitable for manufacturing teams

## Technical Implementation

### Backend Components

#### 1. **PDF Generator** (`apps/backend/src/utils/stockAvailabilityPdfGenerator.js`)
- Uses Puppeteer for high-quality PDF generation
- Responsive HTML/CSS layout
- Comprehensive styling with status indicators
- Error handling and timeout management

#### 2. **Controller Method** (`apps/backend/src/controllers/orderController.js`)
- `generateStockAvailabilityPDF` method
- Validates order status and permissions
- Fetches stock availability data
- Calculates glass requirements
- Returns PDF as binary response

#### 3. **API Route** (`apps/backend/src/routes/orderRoutes.js`)
- `GET /api/orders/:orderId/stock-check-pdf`
- RBAC protected (Admin, Manager, Staff roles)
- Returns PDF file for download

### Frontend Components

#### 1. **API Service** (`apps/frontend/src/lib/api/orderService.ts`)
- `generateStockCheckPDF` method
- Handles blob response
- Proper error handling and authentication

#### 2. **UI Integration** (`apps/frontend/src/components/orders/RequiredCutsView.tsx`)
- PDF download button in Stock Availability section
- Loading states and error handling
- Automatic file download with proper naming

## Usage Workflow

1. **Navigate to Order** → Go to order details page
2. **Check Stock** → Click "Check Stock" to analyze material availability
3. **Download PDF** → Click "Download PDF" button that appears after stock check
4. **Review Report** → Use PDF for manufacturing planning and procurement decisions

## Status Requirements

The stock availability PDF can only be generated for orders in the following statuses:
- Measurement Confirmed
- Ready for Optimization
- Optimization Complete
- In Production
- Cutting

## PDF Content Structure

### Header Section
- Company information (name, address, contact details)
- Document title: "Stock Availability Check"
- Subtitle: "Manufacturing Readiness Report"

### Order Information
- Order ID and display number
- Client name
- Order status and dates
- Total items count

### Summary Statistics (4-card layout)
- Total Materials (blue)
- In Stock (green)  
- Insufficient (red)
- Glass Types (purple)

### Material Stock Availability Table
- Material name and category
- Status with color-coded badges
- Required quantities/cuts
- Available stock
- Shortfall details

### Glass Requirements Table (if applicable)
- Window number
- Glass type/material
- Width and height dimensions
- Total pieces required

### Important Notes Section
- Disclaimers about stock levels
- Instructions for procurement
- Manufacturing guidelines

## File Naming Convention
- Format: `stock-check-{orderIdDisplay}.pdf`
- Example: `stock-check-ORD-2024-001.pdf`

## Error Handling

### Backend Errors
- Order not found (404)
- Insufficient permissions (403)
- Invalid order status (400)
- PDF generation failures (500)

### Frontend Errors
- Network connectivity issues
- Authentication failures
- Empty PDF responses
- Download failures

## Security & Permissions

### Access Control
- Requires valid authentication token
- RBAC protection at route level
- Company-based data isolation (multi-tenancy)

### Data Privacy
- Only shows data for user's company
- No sensitive financial information in PDF
- Internal use document disclaimer

## Performance Considerations

### PDF Generation
- Puppeteer timeout management (30s browser launch, 15s content loading, 15s PDF generation)
- Efficient HTML rendering
- Proper resource cleanup

### Frontend Optimization
- Blob handling for large PDFs
- Progress indicators for user feedback
- Proper memory cleanup after download

## Future Enhancements

### Potential Improvements
1. **Email Integration** - Send PDF directly to procurement team
2. **Batch Processing** - Generate PDFs for multiple orders
3. **Template Customization** - Allow custom PDF layouts
4. **Historical Tracking** - Keep record of when stock checks were performed
5. **Integration with Procurement** - Link to purchase order creation
6. **Mobile Optimization** - Ensure PDF works well on mobile devices

### Advanced Features
1. **Real-time Stock Updates** - Live stock level monitoring
2. **Supplier Integration** - Show supplier contact info for shortfall items
3. **Alternative Materials** - Suggest substitute materials
4. **Lead Time Integration** - Show expected delivery dates for out-of-stock items

## Testing Checklist

### Functional Testing
- [ ] PDF generates successfully with stock data
- [ ] Glass requirements calculated correctly
- [ ] All material categories included
- [ ] Status badges display correctly
- [ ] Company information appears
- [ ] File downloads with correct name

### Edge Cases
- [ ] Orders with no glass requirements
- [ ] Orders with all materials in stock
- [ ] Orders with all materials insufficient
- [ ] Empty stock availability results
- [ ] Very long material names
- [ ] Special characters in data

### Performance Testing
- [ ] Large orders (50+ items)
- [ ] Many material types (100+ materials)
- [ ] Concurrent PDF generation requests
- [ ] Memory usage during generation

## Support & Troubleshooting

### Common Issues
1. **PDF Not Downloading** - Check browser popup blockers
2. **Empty PDF** - Verify stock check was performed first
3. **Permission Errors** - Ensure user has proper role access
4. **Slow Generation** - Check server resources and Puppeteer performance

### Debug Information
- Check browser developer console for frontend errors
- Review backend logs for PDF generation issues
- Verify order status meets requirements
- Confirm stock availability data exists

## Documentation Updates

### Files Modified
- `apps/backend/src/utils/stockAvailabilityPdfGenerator.js` (new)
- `apps/backend/src/controllers/orderController.js` (updated)
- `apps/backend/src/routes/orderRoutes.js` (updated)
- `apps/frontend/src/lib/api/orderService.ts` (updated)
- `apps/frontend/src/components/orders/RequiredCutsView.tsx` (updated)

### API Documentation
- New endpoint: `GET /api/orders/:orderId/stock-check-pdf`
- Response type: `application/pdf`
- Authentication: Required (Bearer token)
- Permissions: Admin, Manager, Staff roles 