const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const Company = require('../models/Company');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/appError');
const { generateInvoicePDF } = require('../utils/pdfGenerator');

/**
 * Create invoice from order
 */
exports.createInvoiceFromOrder = catchAsync(async (req, res, next) => {
    const { orderId } = req.params;
    const { companyId, _id: userId } = req.user;
    const { invoiceDate, dueDate, notes } = req.body;

    // Find the order
    const order = await Order.findOne({ _id: orderId, companyId })
        .populate('clientId', 'clientName contactPerson email');

    if (!order) {
        return next(new AppError('Order not found', 404));
    }

    // Check if order is in appropriate status for invoicing
    if (order.status === 'Cancelled') {
        return next(new AppError('Cannot create an invoice for a Cancelled order.', 400));
    }

    // Check if invoice already exists for this order
    const existingInvoice = await Invoice.findOne({ orderId, companyId });
    if (existingInvoice) {
        return next(new AppError('Invoice already exists for this order', 400));
    }

    // Create invoice using the static method
    let parsedInvoiceDate = invoiceDate ? new Date(invoiceDate) : new Date();
    let parsedDueDate = dueDate ? new Date(dueDate) : null;

    const invoice = await Invoice.createFromOrder(order, userId, parsedInvoiceDate, parsedDueDate);

    // Add custom notes if provided
    if (notes) {
        invoice.notes = notes;
        await invoice.save();
    }

    res.status(201).json({
        status: 'success',
        data: {
            invoice
        }
    });
});

/**
 * List all invoices for the company
 */
exports.listInvoices = catchAsync(async (req, res, next) => {
    const { companyId } = req.user;
    const { page = 1, limit = 20, status, clientId, sortBy = 'invoiceDate', sortOrder = 'desc' } = req.query;

    // Build filter
    const filter = { companyId };
    if (status) filter.status = status;
    if (clientId) filter.clientId = clientId;

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const invoices = await Invoice.find(filter)
        .populate('clientId', 'clientName contactPerson email')
        .populate('orderId', 'orderIdDisplay status')
        .populate('createdBy', 'firstName lastName email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Invoice.countDocuments(filter);

    res.status(200).json({
        status: 'success',
        results: invoices.length,
        totalResults: total,
        totalPages: Math.ceil(total / parseInt(limit)),
        currentPage: parseInt(page),
        data: {
            invoices
        }
    });
});

/**
 * Get specific invoice by ID
 */
exports.getInvoiceById = catchAsync(async (req, res, next) => {
    const { invoiceId } = req.params;
    const { companyId } = req.user;

    const invoice = await Invoice.findOne({ _id: invoiceId, companyId })
        .populate('clientId', 'clientName contactPerson email billingAddress siteAddress gstin')
        .populate('orderId', 'orderIdDisplay status')
        .populate('createdBy', 'firstName lastName email')
        .populate('payments.recordedBy', 'firstName lastName email');

    if (!invoice) {
        return next(new AppError('Invoice not found', 404));
    }

    res.status(200).json({
        status: 'success',
        data: {
            invoice
        }
    });
});

/**
 * Record payment against invoice
 */
exports.recordPayment = catchAsync(async (req, res, next) => {
    const { invoiceId } = req.params;
    const { companyId, _id: userId } = req.user;
    const { amount, paymentDate, method, reference, notes } = req.body;

    // Validate required fields
    if (!amount || !paymentDate) {
        return next(new AppError('Amount and payment date are required', 400));
    }

    const invoice = await Invoice.findOne({ _id: invoiceId, companyId });

    if (!invoice) {
        return next(new AppError('Invoice not found', 404));
    }

    // Check if invoice is voidable
    if (invoice.status === 'Void') {
        return next(new AppError('Cannot record payment against a void invoice', 400));
    }

    // Validate payment amount
    const paymentAmount = parseFloat(amount);
    const currentBalance = parseFloat(invoice.balanceDue.toString());

    if (paymentAmount <= 0) {
        return next(new AppError('Payment amount must be greater than zero', 400));
    }

    if (paymentAmount > currentBalance) {
        return next(new AppError(`Payment amount cannot exceed balance due (₹${currentBalance.toFixed(2)})`, 400));
    }

    // Add payment to the payments array
    const newPayment = {
        paymentDate: new Date(paymentDate),
        amount: mongoose.Types.Decimal128.fromString(paymentAmount.toFixed(2)),
        method: method || 'Cash',
        reference: reference || '',
        notes: notes || '',
        recordedBy: userId,
        recordedAt: new Date()
    };

    invoice.payments.push(newPayment);

    // Update amount paid
    const currentAmountPaid = parseFloat(invoice.amountPaid.toString());
    invoice.amountPaid = mongoose.Types.Decimal128.fromString((currentAmountPaid + paymentAmount).toFixed(2));

    // Save the invoice (pre-save hook will update balanceDue and status)
    await invoice.save();

    res.status(200).json({
        status: 'success',
        message: 'Payment recorded successfully',
        data: {
            invoice,
            payment: newPayment
        }
    });
});

/**
 * Update invoice status
 */
exports.updateInvoiceStatus = catchAsync(async (req, res, next) => {
    const { invoiceId } = req.params;
    const { companyId } = req.user;
    const { status } = req.body;

    const allowedStatuses = ['Draft', 'Sent', 'Void'];
    if (!allowedStatuses.includes(status)) {
        return next(new AppError(`Status must be one of: ${allowedStatuses.join(', ')}`, 400));
    }

    const invoice = await Invoice.findOne({ _id: invoiceId, companyId });

    if (!invoice) {
        return next(new AppError('Invoice not found', 404));
    }

    // Prevent changes to paid invoices
    if (invoice.status === 'Paid' && status !== 'Void') {
        return next(new AppError('Cannot change status of a paid invoice (except to void)', 400));
    }

    invoice.status = status;
    await invoice.save();

    res.status(200).json({
        status: 'success',
        message: 'Invoice status updated successfully',
        data: {
            invoice
        }
    });
});

/**
 * Generate and return invoice PDF
 */
exports.getInvoicePDF = catchAsync(async (req, res, next) => {
    const { invoiceId } = req.params;
    const { companyId } = req.user;

    const invoice = await Invoice.findOne({ _id: invoiceId, companyId })
        .populate('clientId', 'clientName contactPerson email billingAddress siteAddress gstin')
        .populate('orderId', 'orderIdDisplay')
        .populate('createdBy', 'firstName lastName email');

    if (!invoice) {
        return next(new AppError('Invoice not found', 404));
    }

    // Get company details for branding
    const company = await Company.findById(companyId);

    try {
        // Generate PDF using utility function
        const pdfBuffer = await generateInvoicePDF(invoice, company);

        // Set response headers
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Invoice-${invoice.invoiceIdDisplay}.pdf"`,
            'Content-Length': pdfBuffer.length
        });

        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating invoice PDF:', error);
        return next(new AppError('Failed to generate PDF', 500));
    }
});

/**
 * Delete invoice (soft delete - set to void)
 */
exports.deleteInvoice = catchAsync(async (req, res, next) => {
    const { invoiceId } = req.params;
    const { companyId } = req.user;

    const invoice = await Invoice.findOne({ _id: invoiceId, companyId });

    if (!invoice) {
        return next(new AppError('Invoice not found', 404));
    }

    // Check if invoice has payments
    if (invoice.payments.length > 0) {
        return next(new AppError('Cannot delete invoice with recorded payments. Use void status instead.', 400));
    }

    // For draft invoices, we can actually delete them
    if (invoice.status === 'Draft') {
        await Invoice.findByIdAndDelete(invoiceId);
        return res.status(204).json({
            status: 'success',
            data: null
        });
    }

    // For other statuses, just void the invoice
    invoice.status = 'Void';
    await invoice.save();

    res.status(200).json({
        status: 'success',
        message: 'Invoice has been voided',
        data: {
            invoice
        }
    });
}); 