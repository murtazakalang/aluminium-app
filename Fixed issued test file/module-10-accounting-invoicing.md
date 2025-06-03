# Module 10: Accounting & Invoicing

## Overview

The Accounting & Invoicing module provides comprehensive invoice management and basic accounting functionality for the Aluminium Window ERP system. This module handles the creation of invoices from completed orders, payment tracking, PDF generation, and basic financial reporting.

## Features

### Invoice Management
- **Create invoices from orders**: Convert completed orders into invoices with automatic data snapshotting
- **Payment tracking**: Record multiple payments against invoices with automatic balance calculation
- **Status management**: Automatic status updates based on payment status and due dates
- **PDF generation**: Professional invoice PDFs with company branding
- **Multi-tenant isolation**: All invoices are company-specific

### Financial Reporting
- **Sales Ledger**: Comprehensive view of all invoices and payments with filtering and pagination
- **P&L Simple**: Basic profit and loss calculation with period-wise breakdowns
- **Payment Summary**: Analysis of payment methods and trends

## API Endpoints

### Invoice Endpoints (`/api/invoices`)

#### POST `/api/invoices/from-order/:orderId`
Creates a new invoice from an existing order.

**Permissions**: Admin, Manager
**Request Body**:
```json
{
  "invoiceDate": "2024-01-15", // Optional, defaults to today
  "dueDate": "2024-02-15",     // Optional, defaults to 30 days from invoice date
  "notes": "Custom invoice notes" // Optional
}
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "invoice": {
      "invoiceIdDisplay": "INV-2024-001",
      "status": "Draft",
      "grandTotal": "15000.00",
      "balanceDue": "15000.00",
      // ... other invoice fields
    }
  }
}
```

#### GET `/api/invoices`
Lists all invoices for the company with filtering and pagination.

**Permissions**: Admin, Manager, Staff
**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `status`: Filter by invoice status
- `clientId`: Filter by client
- `sortBy`: Sort field (default: 'invoiceDate')
- `sortOrder`: 'asc' or 'desc' (default: 'desc')

#### GET `/api/invoices/:invoiceId`
Retrieves a specific invoice with full details.

**Permissions**: Admin, Manager, Staff

#### GET `/api/invoices/:invoiceId/pdf`
Generates and downloads invoice PDF.

**Permissions**: Admin, Manager, Staff
**Response**: PDF file download

#### POST `/api/invoices/:invoiceId/payments`
Records a payment against an invoice.

**Permissions**: Admin, Manager
**Request Body**:
```json
{
  "amount": 5000.00,
  "paymentDate": "2024-01-20",
  "method": "Bank Transfer", // Optional
  "reference": "TXN123456",  // Optional
  "notes": "Partial payment" // Optional
}
```

#### PUT `/api/invoices/:invoiceId/status`
Updates invoice status manually.

**Permissions**: Admin, Manager
**Request Body**:
```json
{
  "status": "Sent" // One of: Draft, Sent, Void
}
```

#### DELETE `/api/invoices/:invoiceId`
Deletes (draft) or voids an invoice.

**Permissions**: Admin

### Accounting Endpoints (`/api/accounting`)

#### GET `/api/accounting/sales-ledger`
Retrieves sales ledger data with summary statistics.

**Permissions**: Admin, Manager, Staff
**Query Parameters**:
- `startDate`: Filter from date (YYYY-MM-DD)
- `endDate`: Filter to date (YYYY-MM-DD)
- `clientId`: Filter by specific client
- `page`, `limit`: Pagination

**Response**:
```json
{
  "status": "success",
  "data": {
    "invoices": [...],
    "summary": {
      "totalInvoices": 25,
      "totalInvoiceAmount": 250000.00,
      "totalAmountPaid": 200000.00,
      "totalBalanceDue": 50000.00,
      "paidInvoices": 15,
      "partiallyPaidInvoices": 5,
      "overdueInvoices": 3
    },
    "recentPayments": [...],
    "pagination": {...}
  }
}
```

#### GET `/api/accounting/pnl-simple`
Retrieves simplified Profit & Loss data.

**Permissions**: Admin, Manager
**Query Parameters**:
- `startDate`: Analysis from date
- `endDate`: Analysis to date
- `period`: 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'

**Response**:
```json
{
  "status": "success",
  "data": {
    "summary": {
      "totalRevenue": 500000.00,
      "totalCollected": 450000.00,
      "estimatedCosts": 300000.00,
      "grossProfit": 200000.00,
      "grossProfitMargin": 40.00
    },
    "periodWiseBreakdown": [...],
    "notes": [
      "Cost calculation is simplified...",
      "For accurate P&L, implement detailed cost tracking..."
    ]
  }
}
```

#### GET `/api/accounting/payment-summary`
Analyzes payment methods and trends.

**Permissions**: Admin, Manager

## Data Models

### Invoice Schema

```javascript
{
  companyId: ObjectId, // Multi-tenancy
  invoiceIdDisplay: String, // "INV-2024-001" (unique)
  orderId: ObjectId, // Reference to originating order
  orderIdDisplaySnapshot: String, // Order number snapshot
  clientId: ObjectId,
  clientSnapshot: {
    clientName: String,
    contactNumber: String,
    email: String,
    billingAddress: String,
    siteAddress: String,
    gstin: String
  },
  status: String, // Draft, Sent, Partially Paid, Paid, Overdue, Void
  items: [ItemSchema], // Snapshot of order items
  charges: [ChargeSchema], // Additional charges
  discount: DiscountSchema,
  subtotal: Decimal128,
  totalCharges: Decimal128,
  totalTax: Decimal128,
  grandTotal: Decimal128,
  amountPaid: Decimal128, // Total payments received
  balanceDue: Decimal128, // Calculated: grandTotal - amountPaid
  payments: [{
    paymentDate: Date,
    amount: Decimal128,
    method: String,
    reference: String,
    notes: String,
    recordedBy: ObjectId,
    recordedAt: Date
  }],
  invoiceDate: Date,
  dueDate: Date,
  termsAndConditions: String,
  notes: String,
  createdBy: ObjectId
}
```

## Business Logic

### Invoice Creation Process
1. **Validation**: Order must be in 'Delivered', 'Completed', or 'Packed' status
2. **Duplication Check**: Prevent multiple invoices for same order
3. **Data Snapshotting**: Copy final order data to preserve historical accuracy
4. **ID Generation**: Auto-generate sequential invoice number
5. **Status Initialization**: Set to 'Draft' status

### Payment Processing
1. **Validation**: Amount must be positive and not exceed balance due
2. **Payment Recording**: Add to payments array with metadata
3. **Balance Calculation**: Update amountPaid and recalculate balanceDue
4. **Status Update**: Automatic status change based on payment amount
   - Fully paid → 'Paid'
   - Partially paid → 'Partially Paid'
   - Past due with balance → 'Overdue'

### PDF Generation
- Professional invoice layout with company branding
- Itemized breakdown with dimensions and calculations
- Payment history table (if payments exist)
- Terms and conditions
- Responsive design for printing

## Status Workflow

```
Draft → Sent → Partially Paid → Paid
  ↓       ↓         ↓
 Void   Overdue   Overdue
```

### Status Transitions
- **Draft**: Initial status, can be edited or deleted
- **Sent**: Invoice sent to client, can record payments
- **Partially Paid**: Some payment received, balance remains
- **Paid**: Fully paid, balance is zero
- **Overdue**: Past due date with outstanding balance
- **Void**: Cancelled invoice (soft delete)

## Security & Permissions

### Role-Based Access Control

| Endpoint | Admin | Manager | Staff |
|----------|--------|---------|-------|
| Create Invoice | ✓ | ✓ | ✗ |
| View Invoices | ✓ | ✓ | ✓ |
| Record Payments | ✓ | ✓ | ✗ |
| Generate PDF | ✓ | ✓ | ✓ |
| Delete/Void | ✓ | ✗ | ✗ |
| P&L Reports | ✓ | ✓ | ✗ |
| Sales Ledger | ✓ | ✓ | ✓ |

### Multi-Tenancy
- All queries automatically filtered by `req.user.companyId`
- Invoice numbers unique per company
- Complete data isolation between companies

## Error Handling

### Common Error Scenarios
1. **Order Not Found** (404): Invalid orderId or cross-company access
2. **Duplicate Invoice** (400): Invoice already exists for order
3. **Invalid Status** (400): Order not in appropriate status for invoicing
4. **Payment Validation** (400): Amount exceeds balance or invalid data
5. **Permission Denied** (403): Insufficient role permissions

### Error Response Format
```json
{
  "status": "error",
  "message": "Descriptive error message",
  "statusCode": 400
}
```

## Testing

### Unit Tests
- Invoice model pre-save hooks
- Balance calculation logic
- Status transition validation
- Payment recording functionality

### Integration Tests
- End-to-end invoice creation flow
- Payment recording with status updates
- PDF generation functionality
- Multi-tenant data isolation

### Test Coverage
- Model validation and hooks: 95%
- Controller logic: 90%
- API endpoints: 85%

## Performance Considerations

### Database Indexes
```javascript
// Invoice collection indexes
{ companyId: 1, invoiceIdDisplay: 1 } // Unique constraint
{ companyId: 1, orderId: 1 } // Prevent duplicates
{ companyId: 1, clientId: 1 } // Client filtering
{ companyId: 1, status: 1 } // Status filtering
{ companyId: 1, invoiceDate: -1 } // Date sorting
{ companyId: 1, dueDate: 1 } // Overdue queries
```

### Aggregation Pipeline Optimization
- Use compound indexes for aggregation queries
- Limit result sets with proper filtering
- Project only required fields in reports

### PDF Generation
- Async processing for large invoices
- Browser pool management for concurrent requests
- Timeout handling for stuck processes

## Future Enhancements

### Phase 2 Features
1. **Recurring Invoices**: Automatic invoice generation for subscriptions
2. **Invoice Templates**: Customizable invoice layouts
3. **Email Integration**: Send invoices directly to clients
4. **Advanced Reporting**: Detailed P&L with cost tracking
5. **Tax Management**: GST calculation and compliance
6. **Credit Notes**: Handle returns and adjustments
7. **Payment Reminders**: Automated overdue notifications

### Integration Opportunities
1. **Payment Gateways**: Direct payment processing
2. **Accounting Software**: Export to Tally, QuickBooks
3. **Banking APIs**: Automatic payment reconciliation
4. **CRM Integration**: Customer communication tracking

## Troubleshooting

### Common Issues

#### PDF Generation Fails
- Check Puppeteer installation and permissions
- Verify PUPPETEER_EXECUTABLE_PATH environment variable
- Ensure sufficient memory for large invoices

#### Balance Calculation Errors
- Verify Decimal128 usage for monetary values
- Check pre-save hook execution
- Validate payment amount precision

#### Status Not Updating
- Confirm pre-save hook triggers
- Check status transition logic
- Verify payment amount calculation

### Monitoring
- Track PDF generation times
- Monitor invoice creation rates
- Alert on payment processing errors
- Watch for overdue invoice counts

## Migration Guide

### From Existing System
1. **Data Mapping**: Map existing invoice structure to new schema
2. **ID Generation**: Preserve existing invoice numbering
3. **Payment History**: Import existing payment records
4. **Status Reconciliation**: Map statuses to new workflow

### Database Migration Script
```javascript
// Example migration for existing invoices
async function migrateInvoices() {
  const oldInvoices = await OldInvoice.find({});
  
  for (const oldInvoice of oldInvoices) {
    const newInvoice = new Invoice({
      // Map fields from old to new schema
      invoiceIdDisplay: oldInvoice.invoiceNumber,
      // ... other mappings
    });
    
    await newInvoice.save();
  }
}
``` 