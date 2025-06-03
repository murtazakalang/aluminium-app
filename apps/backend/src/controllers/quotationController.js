const mongoose = require('mongoose');
const Quotation = require('../models/Quotation');
const Client = require('../models/Client');
const ProductType = require('../models/ProductType');
const Company = require('../models/Company');
const QuotationService = require('../services/quotationService');
const { generateQuotationPDF: generatePdfUtil } = require('../utils/pdfGenerator');
const { generateProductSVG } = require('../utils/svgGenerator');
const sendEmail = require('../utils/emailUtils');

/**
 * Helper function to validate PDF buffer
 * @param {Buffer} pdfBuffer - PDF buffer to validate
 * @returns {boolean} - True if valid PDF, false otherwise
 */
const isValidPDFBuffer = (pdfBuffer) => {
    return pdfBuffer && pdfBuffer.length > 0 && 
           pdfBuffer[0] === 0x25 && // %
           pdfBuffer[1] === 0x50 && // P  
           pdfBuffer[2] === 0x44 && // D
           pdfBuffer[3] === 0x46;   // F
};

/**
 * Create a new draft quotation
 * POST /api/quotations
 */
exports.createQuotation = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const {
            clientId,
            items = [],
            charges = [],
            discount = { type: 'fixed', value: '0.00' },
            notes = '',
            validUntil
        } = req.body;

        // Validate required fields
        if (!clientId) {
            return res.status(400).json({
                status: 'fail',
                message: 'Client ID is required'
            });
        }

        if (!items || items.length === 0) {
            return res.status(400).json({
                status: 'fail',
                message: 'At least one item is required'
            });
        }

        // Fetch client and verify it belongs to the company
        const client = await Client.findOne({ _id: clientId, companyId });
        if (!client) {
            return res.status(404).json({
                status: 'fail',
                message: 'Client not found'
            });
        }

        // Get company settings for defaults
        const settings = await QuotationService.getCompanySettings(companyId);

        // Generate unique quotation ID
        const quotationIdDisplay = await QuotationService.generateQuotationId(companyId);

        // Process items with area calculations
        const processedItems = [];
        for (const item of items) {
            // Validate item
            if (!item.productTypeId || !item.width || !item.height || !item.pricePerAreaUnit) {
                return res.status(400).json({
                    status: 'fail',
                    message: 'Each item must have productTypeId, width, height, and pricePerAreaUnit'
                });
            }

            // Verify product type exists and belongs to company
            const productType = await ProductType.findOne({ 
                _id: item.productTypeId, 
                companyId 
            });
            if (!productType) {
                return res.status(404).json({
                    status: 'fail',
                    message: `Product type ${item.productTypeId} not found`
                });
            }

            // Prepare item data - calculations will be done by pre-save hook
            const processedItem = {
                productTypeId: item.productTypeId,
                productTypeNameSnapshot: productType.name, // Store snapshot of product type name
                width: mongoose.Types.Decimal128.fromString(item.width.toString()),
                height: mongoose.Types.Decimal128.fromString(item.height.toString()),
                quantity: item.quantity || 1,
                itemLabel: item.itemLabel || '',
                pricePerAreaUnit: mongoose.Types.Decimal128.fromString(item.pricePerAreaUnit.toString()),
                // rawAreaPerItem, convertedAreaPerItem, roundedAreaPerItem, chargeableAreaPerItem, 
                // totalChargeableArea, itemSubtotal will be populated by pre-save hook
            };

            processedItems.push(processedItem);
        }

        // Process charges
        const processedCharges = charges.map(charge => ({
            description: charge.description,
            amount: mongoose.Types.Decimal128.fromString(charge.amount.toString()),
            isTax: charge.isTax || false,
            isPredefined: charge.isPredefined || false
        }));

        // Create quotation
        const quotation = new Quotation({
            companyId,
            quotationIdDisplay,
            clientId,
            clientSnapshot: QuotationService.createClientSnapshot(client),
            dimensionUnit: settings.units?.dimension || 'inches',
            areaUnit: settings.units?.area || 'sqft',
            priceUnit: settings.units?.area || 'sqft',
            areaRoundingRule: settings.areaRoundingRule || 'nearest_0.25',
            minimumChargeableArea: settings.minimumChargeableArea || 0,
            items: processedItems,
            charges: processedCharges,
            discount: {
                type: discount.type || 'fixed',
                value: mongoose.Types.Decimal128.fromString(discount.value?.toString() || '0.00')
            },
            termsAndConditions: settings.termsAndConditions?.quotation || '',
            paymentTerms: settings.paymentTerms?.quotation || '',
            notes,
            createdBy: req.user._id,
            validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days default
        });

        await quotation.save();

        res.status(201).json({
            status: 'success',
            data: {
                quotation
            }
        });

    } catch (error) {
        console.error('Create quotation error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(el => el.message);
            return res.status(400).json({
                status: 'fail',
                message: `Invalid input data: ${messages.join('. ')}`
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'An error occurred while creating the quotation'
        });
    }
};

/**
 * List quotations with filters and pagination
 * GET /api/quotations
 */
exports.getQuotations = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const {
            page = 1,
            limit = 10,
            status,
            clientId,
            search,
            startDate,
            endDate
        } = req.query;

        // Build filter query
        const filter = { companyId };

        if (status) {
            filter.status = status;
        }

        if (clientId) {
            filter.clientId = clientId;
        }

        if (search) {
            filter.$or = [
                { quotationIdDisplay: { $regex: search, $options: 'i' } },
                { 'clientSnapshot.clientName': { $regex: search, $options: 'i' } },
                { notes: { $regex: search, $options: 'i' } }
            ];
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        // Calculate pagination
        const pageNumber = parseInt(page);
        const limitNumber = parseInt(limit);
        const skip = (pageNumber - 1) * limitNumber;

        // Get quotations with pagination
        const quotations = await Quotation.find(filter)
            .populate('clientId', 'clientName contactNumber email')
            .populate('createdBy', 'firstName lastName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNumber);

        // Get total count
        const total = await Quotation.countDocuments(filter);

        res.status(200).json({
            status: 'success',
            data: {
                quotations,
                pagination: {
                    total,
                    page: pageNumber,
                    limit: limitNumber,
                    totalPages: Math.ceil(total / limitNumber)
                }
            }
        });

    } catch (error) {
        console.error('Get quotations error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while fetching quotations'
        });
    }
};

/**
 * Get quotation by ID
 * GET /api/quotations/:quotationId
 */
exports.getQuotationById = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const { quotationId } = req.params;

        // Validate if quotationId is a valid ObjectId if it's being used as _id
        if (!mongoose.Types.ObjectId.isValid(quotationId) && quotationId !== 'latest') {
            // Check if it's not 'latest' which might be a special keyword
            // Also, consider if quotationId is quotationIdDisplay, then this validation needs adjustment
            // For now, assuming quotationId can be _id for direct lookup, or it needs to be handled differently
            // if quotationId refers to quotationIdDisplay.
        }
        
        let quotation;

        if (quotationId === 'latest') {
             quotation = await Quotation.findOne({ companyId })
                .sort({ createdAt: -1 })
                .populate('clientId', 'clientName contactNumber email billingAddress siteAddress gstin')
                .populate({
                    path: 'items.productTypeId',
                    model: 'ProductType',
                    select: 'name description imageUrl materials' // Select fields needed for snapshot or display
                })
                .populate('createdBy', 'firstName lastName email');
        } else {
            // Attempt to find by _id first
            if (mongoose.Types.ObjectId.isValid(quotationId)) {
                quotation = await Quotation.findOne({ _id: quotationId, companyId })
                    .populate('clientId', 'clientName contactNumber email billingAddress siteAddress gstin')
                    .populate({
                        path: 'items.productTypeId',
                        model: 'ProductType',
                        select: 'name description imageUrl materials'
                    })
                    .populate('createdBy', 'firstName lastName email');
            }

            // If not found by _id, try by quotationIdDisplay
            if (!quotation) {
                quotation = await Quotation.findOne({ quotationIdDisplay: quotationId, companyId })
                    .populate('clientId', 'clientName contactNumber email billingAddress siteAddress gstin')
                    .populate({
                        path: 'items.productTypeId',
                        model: 'ProductType',
                        select: 'name description imageUrl materials'
                    })
                    .populate('createdBy', 'firstName lastName email');
            }
        }

        console.log('[QuotationController GETBYID] Fetched Quotation:', JSON.stringify(quotation, null, 2));

        if (!quotation) {
            return res.status(404).json({
                status: 'fail',
                message: 'Quotation not found'
            });
        }

        res.status(200).json({
            status: 'success',
            data: {
                quotation
            }
        });

    } catch (error) {
        console.error('Get quotation by ID error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while fetching the quotation'
        });
    }
};

/**
 * Update a draft quotation
 * PUT /api/quotations/:quotationId
 */
exports.updateQuotation = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const { quotationId } = req.params;

        console.log('[QuotationController UPDATE] Received req.body:', JSON.stringify(req.body, null, 2));

        // Find quotation
        const quotation = await Quotation.findOne({ _id: quotationId, companyId });
        if (!quotation) {
            return res.status(404).json({
                status: 'fail',
                message: 'Quotation not found'
            });
        }

        // Check if quotation can be edited - allow Draft and Sent, prevent final statuses
        const finalStatuses = ['Accepted', 'Rejected', 'Converted', 'Expired'];
        if (finalStatuses.includes(quotation.status)) {
            return res.status(400).json({
                status: 'fail',
                message: `Cannot edit quotation with status '${quotation.status}'. Only Draft and Sent quotations can be edited.`
            });
        }

        const {
            items,
            charges = [],
            discount,
            notes,
            validUntil,
            termsAndConditions
        } = req.body;

        // Map and update items
        if (items) {
            const updatedItems = [];
            for (const itemData of items) {
                // Verify product type if provided
                let productTypeNameSnapshot = itemData.productTypeNameSnapshot; // Keep existing if not re-fetched
                if (itemData.productTypeId) {
                    const productType = await ProductType.findOne({ _id: itemData.productTypeId, companyId: req.user.companyId });
                    if (!productType) {
                        return res.status(404).json({ status: 'fail', message: `Product type ${itemData.productTypeId} not found` });
                    }
                    productTypeNameSnapshot = productType.name; // Update snapshot if productType is changed
                }

                const processedItem = {
                    // If item has an _id, it's an existing item, otherwise it's new
                    _id: itemData._id || new mongoose.Types.ObjectId(), 
                    productTypeId: itemData.productTypeId,
                    productTypeNameSnapshot: productTypeNameSnapshot,
                    width: mongoose.Types.Decimal128.fromString(itemData.width.toString()),
                    height: mongoose.Types.Decimal128.fromString(itemData.height.toString()),
                    quantity: itemData.quantity || 1,
                    itemLabel: itemData.itemLabel || '',
                    pricePerAreaUnit: mongoose.Types.Decimal128.fromString(itemData.pricePerAreaUnit.toString()),
                    // Preserve glass and frame selection
                    selectedGlassTypeId: itemData.selectedGlassTypeId,
                    selectedGlassTypeNameSnapshot: itemData.selectedGlassTypeNameSnapshot,
                    frameColour: itemData.frameColour || "",
                    // Calculations will be handled by the pre-save hook
                };
                
                console.log('[QuotationController UPDATE] Processing item:', JSON.stringify(processedItem, null, 2));

                updatedItems.push(processedItem);
            }
            quotation.items = updatedItems;
        }

        // Update charges if provided
        if (charges) {
            const processedCharges = charges.map(charge => ({
                description: charge.description,
                amount: mongoose.Types.Decimal128.fromString(charge.amount.toString()),
                isTax: charge.isTax || false,
                isPredefined: charge.isPredefined || false
            }));

            quotation.charges = processedCharges; // Pass user-inputted charges; pre-save hook will add GST and recalculate totals
        }

        // Update simple fields if provided
        if (req.body.clientId) {
            const client = await Client.findOne({ _id: req.body.clientId, companyId: req.user.companyId });
            if (!client) return res.status(404).json({ status: 'fail', message: 'Client not found' });
            quotation.clientId = req.body.clientId;
            quotation.clientSnapshot = QuotationService.createClientSnapshot(client);
        }
        if (req.body.notes !== undefined) quotation.notes = req.body.notes;
        if (req.body.validUntil) quotation.validUntil = new Date(req.body.validUntil);
        if (req.body.termsAndConditions !== undefined) quotation.termsAndConditions = req.body.termsAndConditions;
        
        // Update unit and calculation rule fields if provided
        if (req.body.dimensionUnit) quotation.dimensionUnit = req.body.dimensionUnit;
        if (req.body.areaUnit) {
            quotation.areaUnit = req.body.areaUnit;
            quotation.priceUnit = req.body.areaUnit; // priceUnit should match areaUnit
        }
        if (req.body.areaRoundingRule) quotation.areaRoundingRule = req.body.areaRoundingRule;
        if (req.body.minimumChargeableArea !== undefined) {
            quotation.minimumChargeableArea = mongoose.Types.Decimal128.fromString(req.body.minimumChargeableArea.toString());
        }

        // Discount update (handled before, ensure it's correct)
        if (discount) {
            quotation.discount = {
                type: discount.type || 'fixed',
                value: mongoose.Types.Decimal128.fromString(discount.value?.toString() || '0.00')
            };
        }

        console.log('[QuotationController UPDATE] Quotation object before save:', JSON.stringify(quotation.items, null, 2));
        await quotation.save();

        res.status(200).json({
            status: 'success',
            data: {
                quotation
            }
        });

    } catch (error) {
        console.error('Update quotation error:', error);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(el => el.message);
            return res.status(400).json({
                status: 'fail',
                message: `Invalid input data: ${messages.join('. ')}`
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'An error occurred while updating the quotation'
        });
    }
};

/**
 * Delete a draft quotation
 * DELETE /api/quotations/:quotationId
 */
exports.deleteQuotation = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const companyId = req.user.companyId;
        // const { quotationId } = req.params; // Assuming this is _id
        const identifier = req.params.id;


        let quotation;
        if (mongoose.Types.ObjectId.isValid(identifier)) {
            quotation = await Quotation.findOne({ _id: identifier, companyId });
        }
        if (!quotation) {
            quotation = await Quotation.findOne({ quotationIdDisplay: identifier, companyId });
        }


        if (!quotation) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                status: 'fail',
                message: 'Quotation not found'
            });
        }

        // Add business rule: Only 'Draft' quotations can be deleted
        if (quotation.status !== 'Draft') {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                status: 'fail',
                message: `Cannot delete quotation with status '${quotation.status}'. Only draft quotations can be deleted.`
            });
        }

        // Perform deletion
        await Quotation.deleteOne({ _id: quotation._id }).session(session);
        
        // Optionally: Log deletion or perform other cleanup tasks

        await session.commitTransaction();
        session.endSession();

        res.status(204).json({ // 204 No Content for successful deletion
            status: 'success',
            data: null
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Delete quotation error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while deleting the quotation'
        });
    }
};

/**
 * Send quotation (mark as sent)
 * POST /api/quotations/:quotationId/send
 */
exports.sendQuotation = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const { quotationId } = req.params;

        const quotation = await Quotation.findOne({ _id: quotationId, companyId })
            .populate('clientId', 'clientName email contactNumber'); // Populate client email

        if (!quotation) {
            return res.status(404).json({
                status: 'fail',
                message: 'Quotation not found'
            });
        }

        // Check if quotation can be sent
        if (quotation.status !== 'Draft') {
            return res.status(400).json({
                status: 'fail',
                message: 'Only draft quotations can be sent'
            });
        }

        if (!quotation.clientId || !quotation.clientId.email) {
            return res.status(400).json({
                status: 'fail',
                message: 'Client email address not found for this quotation. Cannot send email.'
            });
        }

        // Fetch company details for PDF and email
        const company = await Company.findById(companyId).select('name address phone email logoUrl');
        if (!company) {
            // This should ideally not happen if companyId is enforced by middleware
            console.error(`[sendQuotation] Critical Error: Company not found for ID: ${companyId}`);
            return res.status(500).json({ status: 'fail', message: 'Company details not found.' });
        }

        // Generate PDF
        const pdfBuffer = await generatePdfUtil(quotation, company);
        if (!pdfBuffer || pdfBuffer.length === 0) {
            console.error(`[sendQuotation] PDF generation failed for ${quotation.quotationIdDisplay}.`);
            // Do not change status if PDF fails
            return res.status(500).json({ status: 'error', message: 'Failed to generate PDF for email attachment.' });
        }

        // Check if PDF is valid by examining the first 4 bytes
        const isValidPDF = isValidPDFBuffer(pdfBuffer);

        if (!isValidPDF) {
            console.error(`[sendQuotation] PDF generation failed for ${quotation.quotationIdDisplay}: Buffer does not start with %PDF.`);
            // Do not change status if PDF fails
            return res.status(500).json({ status: 'error', message: 'Failed to generate PDF for email attachment.' });
        }

        // Prepare and send email
        const clientName = quotation.clientSnapshot?.clientName || quotation.clientId.clientName || 'Valued Client';
        const subject = `Quotation ${quotation.quotationIdDisplay} from ${company.name}`;
        const defaultBody = `Dear ${clientName},`
                         + `\n\nPlease find attached your quotation (${quotation.quotationIdDisplay}) from ${company.name}.`
                         + `\n\nIf you have any questions, please feel free to contact us.`
                         + `\n\nBest regards,`
                         + `\nThe ${company.name} Team`;

        const emailOptions = {
            email: quotation.clientId.email,
            subject: subject,
            message: defaultBody, // For now, use default body. Could add req.body.emailBody if needed later.
            attachments: [
                {
                    filename: `Quotation-${quotation.quotationIdDisplay}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        const emailSent = await sendEmail(emailOptions);

        if (!emailSent) {
            console.error(`[sendQuotation] Failed to send email for quotation ${quotation.quotationIdDisplay} to ${quotation.clientId.email}.`);
            // Do not change status if email fails. User can try again.
            return res.status(500).json({
                status: 'error',
                message: 'Failed to send quotation email. Please check email server configuration or contact support. The quotation status remains Draft.'
            });
        }

        // If email sent successfully, update status and history
        quotation.status = 'Sent';
        if (!Array.isArray(quotation.history)) { // Ensure history array exists
            quotation.history = [];
        }
        quotation.history.push({
            status: 'Sent',
            updatedBy: req.user._id,
            notes: `Quotation marked as Sent and PDF emailed to client (${quotation.clientId.email}).`,
            timestamp: new Date()
        });

        await quotation.save();

        res.status(200).json({
            status: 'success',
            message: 'Quotation sent and emailed successfully.',
            data: {
                quotation
            }
        });

    } catch (error) {
        console.error('Send quotation error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while sending the quotation',
            detailedError: error.message // Provide more detail in the error response
        });
    }
};

/**
 * Update quotation status
 * PUT /api/quotations/:quotationId/status
 */
exports.updateQuotationStatus = async (req, res) => {
    // const session = await mongoose.startSession(); // Remove transaction
    // session.startTransaction(); // Remove transaction
    try {
        const companyId = req.user.companyId;
        const { quotationId } = req.params; // This is likely quotation _id
        const { status, historyNote } = req.body;

        if (!status) {
            return res.status(400).json({ status: 'fail', message: 'Status is required.' });
        }

        // Find the quotation by its MongoDB _id
        const quotation = await Quotation.findOne({ _id: quotationId, companyId }); // Remove .session(session)

        if (!quotation) {
            // await session.abortTransaction(); // Remove transaction
            // session.endSession(); // Remove transaction
            return res.status(404).json({ status: 'fail', message: 'Quotation not found.' });
        }
        
        const oldStatus = quotation.status;

        // Validate status transition (example: cannot revert from 'Accepted')
        // This logic can be expanded in QuotationService if needed
        if (oldStatus === 'Accepted' && status !== 'Accepted' && status !== 'Converted') { // Allow change to Converted
            // await session.abortTransaction(); // Remove transaction
            // session.endSession(); // Remove transaction
            return res.status(400).json({ status: 'fail', message: `Cannot change status from ${oldStatus} to ${status} unless it is \'Converted\'.` });
        }
        if (oldStatus === 'Converted' && status !== 'Converted') { // Prevent changing from Converted unless to itself (no change)
            // await session.abortTransaction(); // Remove transaction
            // session.endSession(); // Remove transaction
            return res.status(400).json({ status: 'fail', message: `Cannot change status of a Converted quotation to ${status}.` });
        }


        // Update status and add history entry
        quotation.status = status;
        // Ensure history array exists
        if (!Array.isArray(quotation.history)) {
            quotation.history = [];
        }
        quotation.history.push({
            status: status,
            updatedBy: req.user._id, // User who performed the action
            notes: historyNote || `Status updated to ${status}`,
            timestamp: new Date()
        });
        
        // Special handling for 'Sent' status - update validUntil if not already past
        // This logic was commented out, can be reviewed if needed
        // if (status === 'Sent' && (!quotation.validUntil || new Date(quotation.validUntil) < new Date())) {
            // const settings = await QuotationService.getCompanySettings(companyId); // Need settings if enabling this
            // quotation.validUntil = new Date(Date.now() + (settings.quotationValidityDays || 30) * 24 * 60 * 60 * 1000);
        // }


        await quotation.save(); // Remove { session } 
        
        // await session.commitTransaction(); // Remove transaction
        // session.endSession(); // Remove transaction

        res.status(200).json({
            status: 'success',
            data: { quotation }
        });

    } catch (error) {
        // await session.abortTransaction(); // Remove transaction
        // session.endSession(); // Remove transaction
        console.error('Update quotation status error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while updating quotation status.',
            error: error.message
        });
    }
};

/**
 * Generate PDF for a quotation
 * GET /api/quotations/:id/pdf
 */
exports.generateQuotationPDF = async (req, res) => {
    // const session = await mongoose.startSession(); // Remove transaction
    
    try {
        const identifier = req.params.id;
        console.log(`[generateQuotationPDF] Request for quotation: ${identifier}`);
        console.log(`[generateQuotationPDF] User companyId: ${req.user.companyId}`);
        
        // Try to find quotation by ObjectId first
        let quotation;
        if (mongoose.isValidObjectId(identifier)) {
            console.log(`[generateQuotationPDF] Identifier is valid ObjectId, searching by _id`);
            quotation = await Quotation.findOne({
                _id: identifier,
                companyId: req.user.companyId
            }).lean();
            console.log(`[generateQuotationPDF] Found by ObjectId:`, !!quotation);
        }
        
        // If not found, try searching by quotationIdDisplay
        if (!quotation) {
            console.log(`[generateQuotationPDF] Not found by ObjectId, searching by quotationIdDisplay`);
            quotation = await Quotation.findOne({
                quotationIdDisplay: identifier,
                companyId: req.user.companyId
            }).lean();
            console.log(`[generateQuotationPDF] Found by quotationIdDisplay:`, !!quotation);
        }
        
        if (!quotation) {
            console.log(`[generateQuotationPDF] Quotation not found: ${identifier}`);
            // Let's also try a broader search to see if the quotation exists at all
            const anyQuotation = await Quotation.findOne({
                $or: [
                    { _id: mongoose.isValidObjectId(identifier) ? identifier : null },
                    { quotationIdDisplay: identifier }
                ]
            }).lean();
            console.log(`[generateQuotationPDF] Quotation exists in any company:`, !!anyQuotation);
            if (anyQuotation) {
                console.log(`[generateQuotationPDF] Found quotation belongs to companyId: ${anyQuotation.companyId}`);
            }
            
            return res.status(404).json({ 
                status: 'error', 
                message: 'Quotation not found or access denied' 
            });
        }

        console.log(`[generateQuotationPDF] Found quotation: ${quotation._id}, quotationIdDisplay: ${quotation.quotationIdDisplay}`);
        console.log(`[generateQuotationPDF] Quotation data preview:`, {
            _id: quotation._id,
            quotationIdDisplay: quotation.quotationIdDisplay,
            clientSnapshot: !!quotation.clientSnapshot,
            itemsCount: quotation.items?.length || 0,
            status: quotation.status,
            companyId: quotation.companyId
        });

        if (!quotation.quotationIdDisplay) {
            console.warn(`[generateQuotationPDF] Missing quotationIdDisplay for quotation: ${quotation._id}, attempting to generate one`);
            // Try to generate a quotationIdDisplay if missing
            const currentYear = new Date().getFullYear();
            const fallbackId = `Q-${currentYear}-${quotation._id.toString().slice(-6)}`;
            quotation.quotationIdDisplay = fallbackId;
            console.log(`[generateQuotationPDF] Using fallback quotationIdDisplay: ${fallbackId}`);
        }

        // Fetch company details for branding
        const company = await Company.findById(req.user.companyId);
        if (!company) {
            console.error(`[generateQuotationPDF] Company not found: ${req.user.companyId}`);
            return res.status(404).json({ 
                status: 'error', 
                message: 'Company not found' 
            });
        }
        
        console.log(`[generateQuotationPDF] Generating PDF for quotation ${quotation.quotationIdDisplay}`);
        const pdfBuffer = await generatePdfUtil(quotation, company);
        
        if (!pdfBuffer || pdfBuffer.length === 0) {
            console.error(`[generateQuotationPDF] Empty PDF buffer for quotation: ${quotation.quotationIdDisplay}`);
            return res.status(500).json({ status: 'error', message: 'Failed to generate PDF: Empty buffer.' });
        }
        
        // Check if PDF is valid by examining the first 4 bytes
        const isValidPDF = isValidPDFBuffer(pdfBuffer);

        if (!isValidPDF) {
            console.error(`[generateQuotationPDF] Invalid PDF buffer for quotation: ${quotation.quotationIdDisplay}`);
            return res.status(500).json({ status: 'error', message: 'Failed to generate PDF: Invalid PDF format.' });
        }

        console.log(`[generateQuotationPDF] PDF generated successfully for quotation ${quotation.quotationIdDisplay}, size: ${pdfBuffer.length} bytes`);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Quotation-${quotation.quotationIdDisplay}.pdf`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
        return; // Explicitly return to signal no further processing

    } catch (error) {
        console.error('Error generating quotation PDF:', error);
        
        // Provide specific error messages for common issues
        if (error.message.includes('PDF generation timed out')) {
            return res.status(408).json({ 
                status: 'error', 
                message: 'PDF generation timed out. Please try again.' 
            });
        }
        
        if (error.message.includes('Puppeteer launch failed')) {
            return res.status(500).json({ 
                status: 'error', 
                message: 'PDF service is currently unavailable.' 
            });
        }
        
        return res.status(500).json({ 
            status: 'error', 
            message: 'Failed to generate PDF' 
        });
    }
};

/**
 * Send Quotation PDF via Email
 * POST /api/quotations/:id/send-email
 */
exports.sendQuotationByEmail = async (req, res) => {
    // Remove session and transaction logic
    try {
        const companyId = req.user.companyId;
        const identifier = req.params.id; // Can be _id or quotationIdDisplay
        const { emailBody } = req.body; // Optional custom email body

        let quotation;
        // Find quotation
        if (mongoose.Types.ObjectId.isValid(identifier)) {
            quotation = await Quotation.findOne({ _id: identifier, companyId })
                .populate('clientId', 'clientName email contactNumber');
        }
        if (!quotation) {
            quotation = await Quotation.findOne({ quotationIdDisplay: identifier, companyId })
                .populate('clientId', 'clientName email contactNumber');
        }

        if (!quotation) {
            return res.status(404).json({ status: 'fail', message: 'Quotation not found.' });
        }

        if (!quotation.clientId || !quotation.clientId.email) {
            return res.status(400).json({ status: 'fail', message: 'Client email address not found for this quotation.' });
        }
        
        const company = await Company.findById(companyId).select('name address phone email logoUrl');
        if (!company) {
            console.error(`[sendQuotationByEmail] Critical: Company not found for ID: ${companyId}`);
            return res.status(500).json({ status: 'fail', message: 'Company details not found.' });
        }

        const pdfBuffer = await generatePdfUtil(quotation, company);
        
        // Check if PDF is valid using byte checking
        if (!isValidPDFBuffer(pdfBuffer)) {
            console.error(`[sendQuotationByEmail] PDF generation failed for ${quotation.quotationIdDisplay}: Invalid PDF buffer.`);
            return res.status(500).json({ status: 'error', message: 'Failed to generate PDF for email attachment.' });
        }

        const clientName = quotation.clientSnapshot?.clientName || quotation.clientId.clientName || 'Valued Client';
        const subject = `Quotation ${quotation.quotationIdDisplay} from ${company.name}`;
        
        const defaultBody = `Dear ${clientName},`
                         + `\n\nPlease find attached your quotation (${quotation.quotationIdDisplay}) from ${company.name}.`
                         + `\n\nIf you have any questions, please feel free to contact us.`
                         + `\n\nBest regards,`
                         + `\nThe ${company.name} Team`;
        
        const messageToSend = emailBody || defaultBody;

        const emailOptions = {
            email: quotation.clientId.email,
            subject: subject,
            message: messageToSend,
            attachments: [
                {
                    filename: `Quotation-${quotation.quotationIdDisplay}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        const emailSent = await sendEmail(emailOptions);

        if (emailSent) {
            // Ensure history array exists before pushing
            if (!Array.isArray(quotation.history)) {
                quotation.history = [];
            }

            quotation.history.push({
                status: quotation.status,
                notes: `Quotation PDF emailed to client (${quotation.clientId.email}). Custom message: ${emailBody ? 'Yes' : 'No'}`,
                updatedBy: req.user._id,
                timestamp: new Date()
            });

            if (quotation.status === 'Draft') {
                quotation.status = 'Sent';
                // Ensure history array exists before pushing (again, for safety, though less likely needed here if initialized above)
                if (!Array.isArray(quotation.history)) {
                    quotation.history = [];
                }
                quotation.history.push({
                    status: 'Sent',
                    updatedBy: req.user._id,
                    notes: 'Status automatically changed to Sent after successful email.',
                    timestamp: new Date()
                });
            }
            await quotation.save(); // Save changes without session

            return res.status(200).json({
                status: 'success',
                message: 'Quotation email sent successfully.'
            });

        } else {
            console.error(`[sendQuotationByEmail] Failed to send email for quotation ${quotation.quotationIdDisplay} to ${quotation.clientId.email}. sendEmail returned false.`);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to send quotation email. Please check email server configuration or contact support.'
            });
        }
    } catch (error) {
        console.error(`[sendQuotationByEmail] Error processing email for quotation ${req.params.id}:`, error);
        return res.status(500).json({
            status: 'error',
            message: 'An unexpected error occurred while sending the quotation email.',
            // error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Generate SVG preview for a quotation item
 * GET /api/quotations/:quotationId/svg/:itemId
 */
exports.generateItemSVG = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const { quotationId, itemId } = req.params;

        const quotation = await Quotation.findOne({ _id: quotationId, companyId });
        if (!quotation) {
            return res.status(404).json({
                status: 'fail',
                message: 'Quotation not found'
            });
        }

        const item = quotation.items.id(itemId);
        if (!item) {
            return res.status(404).json({
                status: 'fail',
                message: 'Item not found'
            });
        }

        // Convert Decimal128 to numbers for SVG generation
        const width = parseFloat(item.width.toString());
        const height = parseFloat(item.height.toString());
        const productTypeName = item.productTypeNameSnapshot || 'Unknown Product';

        // Generate SVG
        const svgContent = generateProductSVG(
            productTypeName,
            width,
            height,
            quotation.dimensionUnit || 'inches'
        );

        // Set response headers for SVG
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Content-Disposition', `inline; filename="item-${item._id}.svg"`);

        // Send SVG content
        res.send(svgContent);

    } catch (error) {
        console.error('Generate SVG error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while generating the SVG'
        });
    }
};

/**
 * Generate SVG previews for all quotation items
 * GET /api/quotations/:quotationId/svg
 */
exports.generateAllItemsSVG = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const { quotationId } = req.params;

        const quotation = await Quotation.findOne({ _id: quotationId, companyId });
        if (!quotation) {
            return res.status(404).json({
                status: 'fail',
                message: 'Quotation not found'
            });
        }

        if (!quotation.items || quotation.items.length === 0) {
            return res.status(404).json({
                status: 'fail',
                message: 'No items found in quotation'
            });
        }

        // Generate SVGs for all items
        const itemSVGs = quotation.items.map(item => {
            // Convert Decimal128 to numbers for SVG generation
            const width = parseFloat(item.width.toString());
            const height = parseFloat(item.height.toString());
            const productTypeName = item.productTypeNameSnapshot || 'Unknown Product';

            const svgContent = generateProductSVG(
                productTypeName,
                width,
                height,
                quotation.dimensionUnit || 'inches'
            );

            return {
                itemId: item._id,
                productType: productTypeName,
                dimensions: {
                    width,
                    height,
                    unit: quotation.dimensionUnit || 'inches'
                },
                quantity: item.quantity,
                itemLabel: item.itemLabel,
                svgContent: svgContent
            };
        });

        res.status(200).json({
            status: 'success',
            data: {
                quotationId: quotation._id,
                quotationIdDisplay: quotation.quotationIdDisplay,
                items: itemSVGs
            }
        });

    } catch (error) {
        console.error('Generate all items SVG error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while generating the SVGs'
        });
    }
};

/**
 * Generate combined SVG layout for all quotation items
 * GET /api/quotations/:quotationId/svg/layout
 */
exports.generateQuotationLayoutSVG = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const { quotationId } = req.params;
        const { layout = 'grid' } = req.query; // grid, vertical, horizontal

        const quotation = await Quotation.findOne({ _id: quotationId, companyId });
        if (!quotation) {
            return res.status(404).json({
                status: 'fail',
                message: 'Quotation not found'
            });
        }

        if (!quotation.items || quotation.items.length === 0) {
            return res.status(404).json({
                status: 'fail',
                message: 'No items found in quotation'
            });
        }

        // Generate individual SVGs for each item
        const itemSVGs = quotation.items.map(item => {
            const width = parseFloat(item.width.toString());
            const height = parseFloat(item.height.toString());
            const productTypeName = item.productTypeNameSnapshot || 'Unknown Product';

            return {
                svg: generateProductSVG(productTypeName, width, height, quotation.dimensionUnit || 'inches'),
                width: width,
                height: height,
                productType: productTypeName,
                quantity: item.quantity,
                itemLabel: item.itemLabel || `Item ${item._id.toString().slice(-4)}`
            };
        });

        // Calculate layout dimensions
        const maxItemWidth = 200; // Max width for each item in layout
        const maxItemHeight = 150; // Max height for each item in layout
        const padding = 20;
        const itemsPerRow = layout === 'vertical' ? 1 : (layout === 'horizontal' ? itemSVGs.length : Math.ceil(Math.sqrt(itemSVGs.length)));
        const rows = Math.ceil(itemSVGs.length / itemsPerRow);

        const layoutWidth = (itemsPerRow * maxItemWidth) + ((itemsPerRow + 1) * padding);
        const layoutHeight = (rows * maxItemHeight) + ((rows + 1) * padding) + 60; // Extra space for title

        // Create combined SVG
        let combinedSVG = `<svg width="${layoutWidth}" height="${layoutHeight}" viewBox="0 0 ${layoutWidth} ${layoutHeight}" xmlns="http://www.w3.org/2000/svg">`;
        
        // Background
        combinedSVG += `<rect width="${layoutWidth}" height="${layoutHeight}" fill="#ffffff"/>`;
        
        // Title
        combinedSVG += `<text x="${layoutWidth/2}" y="30" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#2d3748">Quotation ${quotation.quotationIdDisplay} - Item Layout</text>`;
        
        // Place items in layout
        itemSVGs.forEach((item, index) => {
            const row = Math.floor(index / itemsPerRow);
            const col = index % itemsPerRow;
            const x = padding + (col * (maxItemWidth + padding));
            const y = padding + 50 + (row * (maxItemHeight + padding)); // +50 for title space

            // Scale item SVG to fit in layout box
            const scaleX = (maxItemWidth - 20) / 200; // Assuming original SVG width around 200
            const scaleY = (maxItemHeight - 40) / 150; // Assuming original SVG height around 150
            const scale = Math.min(scaleX, scaleY, 1); // Don't scale up

            // Add item container
            combinedSVG += `<rect x="${x}" y="${y}" width="${maxItemWidth}" height="${maxItemHeight}" fill="#f8f9fa" stroke="#e2e8f0" stroke-width="1" rx="4"/>`;
            
            // Add scaled item SVG (simplified - in practice, you'd need to parse and embed the SVG content)
            combinedSVG += `<g transform="translate(${x + 10}, ${y + 10}) scale(${scale})">`;
            // For now, add a placeholder rectangle representing the window/door
            const itemWidth = item.width * 2; // Scale for display
            const itemHeight = item.height * 2; // Scale for display
            combinedSVG += `<rect x="5" y="5" width="${Math.min(itemWidth, maxItemWidth-20)}" height="${Math.min(itemHeight, maxItemHeight-60)}" fill="#e6fffa" stroke="#4a5568" stroke-width="2" rx="2"/>`;
            combinedSVG += `</g>`;
            
            // Add item label
            combinedSVG += `<text x="${x + maxItemWidth/2}" y="${y + maxItemHeight - 10}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#4a5568">${item.itemLabel}</text>`;
            combinedSVG += `<text x="${x + maxItemWidth/2}" y="${y + maxItemHeight - 25}" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="#718096">${item.width} × ${item.height} ${quotation.dimensionUnit} (Qty: ${item.quantity})</text>`;
        });

        combinedSVG += '</svg>';

        // Set response headers for SVG
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Content-Disposition', `inline; filename="quotation-${quotation.quotationIdDisplay}-layout.svg"`);

        // Send SVG content
        res.send(combinedSVG);

    } catch (error) {
        console.error('Generate quotation layout SVG error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while generating the layout SVG'
        });
    }
};

/**
 * Get SVG for a quotation item
 * GET /api/quotations/:quotationId/items/:itemId/svg --- (Adjusted route for clarity)
 * Or /api/quotations/:quotationId/svg/:itemId is also fine
 */
exports.generateQuotationItemSVG = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        // const { quotationId, itemId } = req.params; 
        const quotationIdentifier = req.params.id; // or quotationId
        const itemId = req.params.itemId;


        let quotation;
        if(mongoose.Types.ObjectId.isValid(quotationIdentifier)) {
            quotation = await Quotation.findOne({ _id: quotationIdentifier, companyId }).populate('items.productTypeId');
        }
        if(!quotation) {
            quotation = await Quotation.findOne({ quotationIdDisplay: quotationIdentifier, companyId }).populate('items.productTypeId');
        }


        if (!quotation) {
            return res.status(404).json({ status: 'fail', message: 'Quotation not found' });
        }

        const item = quotation.items.find(it => it._id.toString() === itemId);

        if (!item) {
            return res.status(404).json({ status: 'fail', message: 'Item not found in quotation' });
        }

        if (!item.productTypeId || !item.productTypeId.materials || item.productTypeId.materials.length === 0) {
             return res.status(400).json({ status: 'fail', message: 'Product type details for SVG generation are incomplete.' });
        }
        
        // Basic item data for SVG
        const itemData = {
            width: parseFloat(item.width.toString()),
            height: parseFloat(item.height.toString()),
            productTypeName: item.productTypeNameSnapshot,
            // Pass material info if your SVG generator uses it
            // For example, to determine frame thickness or type:
            // materials: item.productTypeId.materials 
        };

        // Use a simplified SVG generator or the more complex one
        // const svgContent = `<svg width="100" height="100"><rect x="10" y="10" width="80" height="80" fill="blue" /><text x="50" y="50" fill="white" text-anchor="middle">${itemData.productTypeName}</text></svg>`;
        const svgContent = await generateProductSVG(itemData, item.productTypeId);


        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svgContent);

    } catch (error) {
        console.error('Generate SVG error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while generating the SVG',
            error: error.message
        });
    }
};

/**
 * Save the new order
 * POST /api/quotations/:quotationId/convert
 */
exports.convertQuotationToOrder = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const { quotationId } = req.params;

        const quotation = await Quotation.findOne({ _id: quotationId, companyId });
        if (!quotation) {
            return res.status(404).json({
                status: 'fail',
                message: 'Quotation not found'
            });
        }

        // Check if quotation can be converted
        if (quotation.status !== 'Draft') {
            return res.status(400).json({
                status: 'fail',
                message: 'Only draft quotations can be converted'
            });
        }

        // Save the new order
        const newOrder = new Order({
            companyId,
            quotationId: quotation._id,
            clientId: quotation.clientId,
            clientSnapshot: quotation.clientSnapshot,
            items: quotation.items,
            charges: quotation.charges,
            discount: quotation.discount,
            termsAndConditions: quotation.termsAndConditions,
            notes: quotation.notes,
            createdBy: req.user._id,
            status: initialStatus,
            orderDate: new Date(),
        });

        // Ensure history array is initialized before pushing to it
        if (!Array.isArray(newOrder.history)) {
            newOrder.history = [];
        }
        newOrder.history.push({
            status: initialStatus,
            notes: `Order created from Quotation ${quotation.quotationIdDisplay}`,
            updatedBy: req.user._id, // Assuming req.user is available
            timestamp: new Date(),
        });
        
        await newOrder.save({ session });

        // Update quotation status
        quotation.status = 'Converted';
        await quotation.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            status: 'success',
            data: {
                order: newOrder
            }
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Convert quotation to order error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while converting the quotation to an order'
        });
    }
}; 