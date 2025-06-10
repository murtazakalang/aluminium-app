const mongoose = require('mongoose');
const EstimationService = require('../services/estimationService');
const Estimation = require('../models/Estimation');
const PDFDocument = require('pdfkit');

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
 * Estimation Controller
 * Handles CRUD operations and calculation for material estimations
 */
module.exports = {
    /**
     * Create a new estimation
     * @route POST /api/estimations
     * @access Protected (Manager, Admin)
     */
    createEstimation: async (req, res) => {
        try {
            const { 
                projectName, 
                clientId, 
                dimensionUnitUsed, 
                items 
            } = req.body;

            // Validate input
            if (!projectName) {
                return res.status(400).json({ 
                    error: 'Project name is required' 
                });
            }

            if (!items || items.length === 0) {
                return res.status(400).json({ 
                    error: 'At least one estimation item is required' 
                });
            }

            // Validate items
            items.forEach(item => {
                if (!mongoose.Types.ObjectId.isValid(item.productTypeId)) {
                    throw new Error(`Invalid product type ID: ${item.productTypeId}`);
                }
                if (item.width <= 0 || item.height <= 0) {
                    throw new Error('Width and height must be positive numbers');
                }
            });

            // Clean up clientId - convert empty string to undefined for ObjectId field
            const cleanedClientId = clientId === '' ? undefined : clientId;

            // Clean up items data - convert empty strings to undefined for ObjectId fields
            const cleanedItems = items.map(item => ({
                ...item,
                selectedGlassTypeId: item.selectedGlassTypeId === '' ? undefined : item.selectedGlassTypeId
            }));

            const estimation = await EstimationService.createEstimation(
                { 
                    projectName, 
                    clientId: cleanedClientId, 
                    dimensionUnitUsed, 
                    items: cleanedItems 
                }, 
                req.user.companyId, 
                req.user._id
            );

            res.status(201).json({
                message: 'Estimation created successfully',
                estimation
            });
        } catch (error) {
            console.error('Create Estimation Error:', error);
            res.status(400).json({ 
                error: error.message 
            });
        }
    },

    /**
     * List estimations for the company
     * @route GET /api/estimations
     * @access Protected (Manager, Admin)
     */
    listEstimations: async (req, res) => {
        try {
            const { 
                page = 1, 
                limit = 10, 
                status, 
                sortBy = 'createdAt', 
                sortOrder = 'desc' 
            } = req.query;

            const query = { 
                companyId: req.user.companyId 
            };

            if (status) {
                query.status = status;
            }

            const sortOptions = { 
                [sortBy]: sortOrder === 'desc' ? -1 : 1 
            };

            const estimations = await Estimation.find(query)
                .sort(sortOptions)
                .skip((page - 1) * limit)
                .limit(Number(limit))
                .populate('clientId', 'clientName')
                .select('-calculatedMaterials'); // Exclude detailed materials to reduce payload

            const total = await Estimation.countDocuments(query);

            res.status(200).json({
                estimations,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalEstimations: total
                }
            });
        } catch (error) {
            console.error('List Estimations Error:', error);
            res.status(500).json({ 
                error: 'Failed to retrieve estimations' 
            });
        }
    },

    /**
     * Get a specific estimation
     * @route GET /api/estimations/:id
     * @access Protected (Manager, Admin)
     */
    getEstimation: async (req, res) => {
        try {
            const estimation = await Estimation.findOne({
                _id: req.params.id,
                companyId: req.user.companyId
            })
            .populate('clientId', 'clientName')
            .populate('items.productTypeId', 'name');

            if (!estimation) {
                return res.status(404).json({ 
                    error: 'Estimation not found' 
                });
            }

            res.status(200).json(estimation);
        } catch (error) {
            console.error('Get Estimation Error:', error);
            res.status(500).json({ 
                error: 'Failed to retrieve estimation' 
            });
        }
    },

    /**
     * Update an estimation
     * @route PUT /api/estimations/:id
     * @access Protected (Manager, Admin)
     */
    updateEstimation: async (req, res) => {
        try {
            const { 
                projectName, 
                clientId, 
                dimensionUnitUsed, 
                items,
                calculatedMaterials,
                manualCharges,
                markupPercentage
            } = req.body;

            // Clean up clientId - convert empty string to undefined for ObjectId field
            const cleanedClientId = clientId === '' ? undefined : clientId;

            // Clean up items data - convert empty strings to undefined for ObjectId fields
            const cleanedItems = items ? items.map(item => ({
                ...item,
                selectedGlassTypeId: item.selectedGlassTypeId === '' ? undefined : item.selectedGlassTypeId
            })) : items;

            // First update the estimation with new data
            const estimation = await EstimationService.updateEstimation(
                req.params.id, 
                { 
                    projectName, 
                    clientId: cleanedClientId, 
                    dimensionUnitUsed, 
                    items: cleanedItems,
                    calculatedMaterials,
                    manualCharges,
                    markupPercentage
                }, 
                req.user.companyId
            );

            // Auto-recalculate materials if items were changed and estimation is in Draft or Calculated status
            if (items && (estimation.status === 'Draft' || estimation.status === 'Calculated')) {
                console.log('[EstimationController] Items changed, auto-recalculating materials...');
                try {
                    const recalculatedEstimation = await EstimationService.calculateEstimationMaterials(
                        req.params.id, 
                        req.user.companyId
                    );
                    console.log('[EstimationController] Materials auto-recalculated successfully');
                    
                    res.status(200).json({
                        message: 'Estimation updated and materials recalculated successfully',
                        estimation: recalculatedEstimation
                    });
                } catch (recalcError) {
                    console.warn('[EstimationController] Auto-recalculation failed:', recalcError.message);
                    // Still return the updated estimation even if recalculation fails
                    res.status(200).json({
                        message: 'Estimation updated successfully (manual recalculation may be needed)',
                        estimation,
                        warning: 'Material recalculation failed. Please use the Calculate button to update materials.'
                    });
                }
            } else {
                res.status(200).json({
                    message: 'Estimation updated successfully',
                    estimation
                });
            }
        } catch (error) {
            console.error('Update Estimation Error:', error);
            res.status(400).json({ 
                error: error.message 
            });
        }
    },

    /**
     * Delete an estimation
     * @route DELETE /api/estimations/:id
     * @access Protected (Manager, Admin)
     */
    deleteEstimation: async (req, res) => {
        try {
            await EstimationService.deleteEstimation(
                req.params.id, 
                req.user.companyId
            );

            res.status(200).json({ 
                message: 'Estimation deleted successfully' 
            });
        } catch (error) {
            console.error('Delete Estimation Error:', error);
            res.status(400).json({ 
                error: error.message 
            });
        }
    },

    /**
     * Calculate materials for an estimation
     * @route POST /api/estimations/:id/calculate
     * @access Protected (Manager, Admin)
     */
    calculateEstimationMaterials: async (req, res) => {
        try {
            const estimation = await EstimationService.calculateEstimationMaterials(
                req.params.id, 
                req.user.companyId
            );

            res.status(200).json({
                message: 'Materials calculated successfully',
                estimation
            });
        } catch (error) {
            console.error('Calculate Estimation Materials Error:', error);
            res.status(400).json({ 
                error: error.message 
            });
        }
    },

    /**
     * Generate PDF for an estimation
     * @route GET /api/estimations/:id/pdf
     * @access Protected (Manager, Admin)
     */
    generateEstimationPDF: async (req, res) => {
        try {
            const estimation = await Estimation.findOne({
                _id: req.params.id,
                companyId: req.user.companyId
            })
            .populate('clientId', 'clientName email contactPerson contactNumber')
            .populate('items.productTypeId', 'name');

            if (!estimation) {
                return res.status(404).json({ 
                    status: 'error',
                    message: 'Estimation not found or access denied' 
                });
            }

            // Fetch company details for branding
            const Company = require('../models/Company');
            const company = await Company.findById(req.user.companyId);
            
            if (!company) {
                return res.status(404).json({ 
                    status: 'error', 
                    message: 'Company not found' 
                });
            }

            // Use HTML-to-PDF approach like quotations
            const puppeteer = require('puppeteer');
            const { generateEstimationHTML } = require('../utils/estimationPdfGenerator');

            // Generate HTML content with enhanced validation
            const htmlContent = generateEstimationHTML(estimation, company);
            
            // Basic HTML validation
            if (!htmlContent || htmlContent.length < 100) {
                throw new Error('Generated HTML content is invalid or too short');
            }

            // Launch browser and generate PDF
            const browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                timeout: 30000 // 30 second timeout
            });

            const page = await browser.newPage();
            
            // Set content with timeout and error handling
            try {
                await page.setContent(htmlContent, { 
                    waitUntil: 'networkidle0',
                    timeout: 15000 // 15 second timeout for content loading
                });
            } catch (contentError) {
                await browser.close();
                console.error('Error setting page content:', contentError);
                throw new Error('Failed to render PDF content');
            }

            // Generate PDF with enhanced options
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '10mm',
                    right: '10mm',
                    bottom: '10mm',
                    left: '10mm'
                },
                timeout: 15000 // 15 second timeout for PDF generation
            });

            await browser.close();

            // Validate PDF buffer
            if (!pdfBuffer || pdfBuffer.length === 0) {
                return res.status(500).json({ 
                    status: 'error', 
                    message: 'Failed to generate PDF: Empty buffer' 
                });
            }
            
            // Check if PDF is valid by examining the first 4 bytes
            const isValidPDF = isValidPDFBuffer(pdfBuffer);

            if (!isValidPDF) {
                console.error('Invalid PDF generated for estimation:', req.params.id);
                console.error('PDF buffer length:', pdfBuffer.length);
                console.error('First 8 bytes:', Array.from(pdfBuffer.slice(0, 8)));
                return res.status(500).json({ 
                    status: 'error', 
                    message: 'Failed to generate PDF: Invalid PDF format' 
                });
            }

            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="estimation-${estimation.projectName.replace(/\s+/g, '-')}.pdf"`);
            res.setHeader('Content-Length', pdfBuffer.length);
            
            // Add debug logging to track the response
            console.log(`[generateEstimationPDF] PDF generation completed. Buffer length: ${pdfBuffer.length}`);
            console.log(`[generateEstimationPDF] PDF validation result: ${isValidPDF}. First 10 bytes: ${Array.from(pdfBuffer.slice(0, 10)).join(',')}`);
            console.log(`[generateEstimationPDF] Sending PDF response with headers. Content-Length: ${pdfBuffer.length}`);
            
            // Send PDF - use res.end() to ensure binary data is sent correctly
            // res.send() can cause JSON serialization of buffers, use res.end() for binary data
            res.end(pdfBuffer);
            return; // Explicitly return to signal no further processing

        } catch (error) {
            console.error('Generate Estimation PDF Error:', error);
            
            // Provide specific error messages for common issues
            if (error.message.includes('PDF generation timed out') || error.message.includes('timeout')) {
                return res.status(408).json({ 
                    status: 'error', 
                    message: 'PDF generation timed out. Please try again.' 
                });
            }
            
            if (error.message.includes('Puppeteer launch failed') || error.message.includes('Failed to launch')) {
                return res.status(500).json({ 
                    status: 'error', 
                    message: 'PDF service is currently unavailable.' 
                });
            }
            
            if (error.message.includes('Failed to render PDF content')) {
                return res.status(500).json({ 
                    status: 'error', 
                    message: 'Failed to render PDF content. Please check estimation data.' 
                });
            }
            
            return res.status(500).json({ 
                status: 'error',
                message: 'Failed to generate PDF' 
            });
        }
    },

    convertToQuotation: async (req, res) => {
        try {
            const { id } = req.params;
            const companyId = req.user.companyId;
            const userId = req.user._id;

            // TODO: Implement service logic
            const quotation = await EstimationService.convertEstimationToQuotation(id, companyId, userId);

            res.status(200).json({
                message: 'Estimation converted to quotation successfully',
                quotationId: quotation._id // Or other relevant quotation identifier
            });
        } catch (error) {
            console.error('Convert Estimation to Quotation Error:', error);
            res.status(500).json({ 
                error: error.message || 'Failed to convert estimation to quotation' 
            });
        }
    },

    /**
     * Calculate glass for a specific estimation item
     * @route GET /api/estimations/:id/calculate-glass
     * @access Protected (Manager, Admin, Staff)
     */
    calculateGlassForItem: async (req, res) => {
        try {
            const { id } = req.params;
            const { itemId } = req.query;
            const companyId = req.user.companyId;

            if (!itemId) {
                return res.status(400).json({ 
                    error: 'Item ID is required' 
                });
            }

            // Get estimation
            const estimation = await Estimation.findOne({
                _id: id,
                companyId: companyId
            }).populate('items.productTypeId');

            if (!estimation) {
                return res.status(404).json({ 
                    error: 'Estimation not found' 
                });
            }

            // Find specific item
            const item = estimation.items.find(item => item._id.toString() === itemId);
            if (!item) {
                return res.status(404).json({ 
                    error: 'Estimation item not found' 
                });
            }

            // Get product type
            const productType = await mongoose.model('ProductType').findOne({ 
                _id: item.productTypeId, 
                companyId: companyId 
            });

            if (!productType) {
                return res.status(404).json({ 
                    error: 'Product type not found' 
                });
            }

            // Calculate glass for this item
            const glassCalculation = await EstimationService.calculateGlassForItem(
                item, 
                productType, 
                estimation.dimensionUnitUsed, 
                companyId
            );

            res.status(200).json({
                message: 'Glass calculation completed',
                itemId: itemId,
                glassCalculation: glassCalculation
            });

        } catch (error) {
            console.error('Calculate Glass for Item Error:', error);
            res.status(500).json({ 
                error: error.message || 'Failed to calculate glass for item' 
            });
        }
    }
}; 