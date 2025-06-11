// console.log("[pdfGenerator.js] TOP OF FILE"); // Removed
// console.log("[pdfGenerator.js] Attempting to require puppeteer..."); // Removed
const puppeteer = require('puppeteer');
// console.log("[pdfGenerator.js] Successfully required puppeteer."); // Removed
// // process.exit(0); // REMOVED Force exit after puppeteer require for testing // This was already commented
const path = require('path');
const fs = require('fs'); // Added fs import

/**
 * Generate PDF for quotation
 * @param {Object} quotation - Quotation document
 * @param {Object} company - Company details for branding
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generateQuotationPDF(quotation, company = {}) {
  let browser;
  let page;
  
  try {
    // Fetch current settings if quotation doesn't have terms populated
    let effectivePaymentTerms = quotation.paymentTerms;
    let effectiveTermsAndConditions = quotation.termsAndConditions;
    
    if (!effectivePaymentTerms || !effectiveTermsAndConditions) {
      try {
        const Setting = require('../models/Setting');
        const settings = await Setting.findOne({ companyId: quotation.companyId });
        if (settings) {
          if (!effectivePaymentTerms) {
            effectivePaymentTerms = settings.paymentTerms?.quotation || '';
          }
          if (!effectiveTermsAndConditions) {
            effectiveTermsAndConditions = settings.termsAndConditions?.quotation || '';
          }
        }
      } catch (settingsError) {
        console.warn('Could not fetch settings for PDF generation:', settingsError.message);
      }
    }
    
    // Fetch SVG technical drawings for items
    let quotationWithSVG = { ...quotation };
    try {
      const ProductType = require('../models/ProductType');
      const itemsWithSVG = [];
      
      for (const item of quotation.items || []) {
        const itemCopy = { ...item };
        
        // Fetch product type with technical drawing
        if (item.productTypeId) {
          try {
            const productType = await ProductType.findOne({ 
              _id: item.productTypeId, 
              companyId: quotation.companyId 
            }).select('technicalDrawing').lean();
            
            if (productType?.technicalDrawing?.svgContent && productType.technicalDrawing.isActive) {
              // For PDF compatibility, create a simplified HTML representation instead of complex SVG
              const productName = item.productTypeNameSnapshot.toLowerCase();
              const prompt = productType.technicalDrawing.prompt || item.prompt || '';
              let htmlDrawing = '';
              
              if (productName.includes('3 track') || productName.includes('3-track')) {
                // Create 3-track sliding window representation
                const width = item.width && item.width.$numberDecimal ? parseFloat(item.width.$numberDecimal).toFixed(0) : parseFloat(item.width?.toString() || '0').toFixed(0);
                const height = item.height && item.height.$numberDecimal ? parseFloat(item.height.$numberDecimal).toFixed(0) : parseFloat(item.height?.toString() || '0').toFixed(0);
                
                htmlDrawing = `
                  <div style="width: 160px; height: 100px; border: 2px solid #333; position: relative; background: #f9f9f9;">
                    <div style="position: absolute; top: 5px; left: 5px; width: 46px; height: 88px; border: 1px solid #666; background: #fff;">
                      ${prompt && prompt.toLowerCase().includes('mesh') ? 
                        '<div style="background: repeating-linear-gradient(45deg, transparent, transparent 3px, #ccc 3px, #ccc 4px); width: 100%; height: 100%;"></div>' : 
                        '<div style="background: linear-gradient(135deg, #e6fffa 0%, #b3f0f0 100%); width: 100%; height: 100%; position: relative;"><div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 20px; height: 1px; background: #333; transform: rotate(45deg);"></div></div>'
                      }
                    </div>
                    <div style="position: absolute; top: 5px; left: 54px; width: 46px; height: 88px; border: 1px solid #666; background: linear-gradient(135deg, #e6fffa 0%, #b3f0f0 100%);">
                      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 20px; height: 1px; background: #333; transform: rotate(45deg);"></div>
                    </div>
                    <div style="position: absolute; top: 5px; left: 103px; width: 46px; height: 88px; border: 1px solid #666; background: linear-gradient(135deg, #e6fffa 0%, #b3f0f0 100%);">
                      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 20px; height: 1px; background: #333; transform: rotate(45deg);"></div>
                    </div>
                    <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); font-size: 7px; color: #333; font-weight: bold;">${width}" × ${height}"</div>
                    <div style="position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%); font-size: 8px; color: #333;">${prompt && prompt.toLowerCase().includes('mesh') ? '3-Track (2 Glass + 1 Mesh)' : '3-Track Window'}</div>
                  </div>
                `;
              } else {
                // Default simple window representation
                const width = item.width && item.width.$numberDecimal ? parseFloat(item.width.$numberDecimal).toFixed(0) : parseFloat(item.width?.toString() || '0').toFixed(0);
                const height = item.height && item.height.$numberDecimal ? parseFloat(item.height.$numberDecimal).toFixed(0) : parseFloat(item.height?.toString() || '0').toFixed(0);
                
                htmlDrawing = `
                  <div style="width: 160px; height: 100px; border: 2px solid #333; position: relative; background: #f9f9f9;">
                    <div style="position: absolute; top: 5px; left: 5px; width: 148px; height: 88px; border: 1px solid #666; background: linear-gradient(135deg, #e6fffa 0%, #b3f0f0 100%);">
                      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 30px; height: 1px; background: #333; transform: rotate(45deg);"></div>
                    </div>
                    <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); font-size: 7px; color: #333; font-weight: bold;">${width}" × ${height}"</div>
                    <div style="position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%); font-size: 8px; color: #333;">Window</div>
                  </div>
                `;
              }
              
              itemCopy.technicalDrawingSvg = htmlDrawing;
              console.log(`[generateQuotationPDF] Added HTML drawing for item: ${item.productTypeNameSnapshot}`);
            }
          } catch (svgError) {
            console.warn(`[generateQuotationPDF] Error fetching SVG for product ${item.productTypeId}:`, svgError.message);
            // Continue without SVG if there's an error
          }
        }
        
        itemsWithSVG.push(itemCopy);
      }
      
      quotationWithSVG.items = itemsWithSVG;
    } catch (svgFetchError) {
      console.warn('[generateQuotationPDF] Error fetching SVG data:', svgFetchError.message);
      // Continue with original quotation if SVG fetching fails
    }
    
    // Add the effective terms to quotation object for PDF generation
    const quotationWithTerms = {
      ...quotationWithSVG,
      paymentTerms: effectivePaymentTerms,
      termsAndConditions: effectiveTermsAndConditions
    };
    
    // console.log(`[pdfGenerator.js] Current PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
    // console.log('[pdfGenerator.js] Attempting to launch Puppeteer...');
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ],
        timeout: 30000
      });
      // console.log('[pdfGenerator.js] Puppeteer launched successfully.');
    } catch (launchError) {
      console.error('[pdfGenerator.js] CRITICAL: Puppeteer launch failed:', launchError);
      throw new Error(`Puppeteer launch failed: ${launchError.message}`);
    }
    
    try {
      page = await browser.newPage();
      // console.log('[pdfGenerator.js] Puppeteer new page created successfully.');
    } catch (newPageError) {
      console.error('[pdfGenerator.js] CRITICAL: Puppeteer new page creation failed:', newPageError);
      throw new Error(`Puppeteer new page creation failed: ${newPageError.message}`);
    }
    
    // Capture console logs from Puppeteer's page context
    page.on('console', msg => {
      console.log('[PUPPETEER PAGE CONSOLE]', msg.type(), msg.text());
      for (let i = 0; i < msg.args().length; ++i) {
        console.log(`  ARG ${i}: ${msg.args()[i]}`);
      }
    });
    page.on('pageerror', error => {
      console.error('[PUPPETEER PAGE ERROR]', error.message);
    });
    page.on('error', error => {
      console.error('[PUPPETEER ERROR]', error.message);
    });
    page.on('requestfailed', request => {
      console.error('[PUPPETEER REQUEST FAILED]', request.url(), request.failure()?.errorText);
    });
    page.on('response', response => {
      if (!response.ok()) {
        console.error('[PUPPETEER RESPONSE ERROR]', response.url(), response.status(), response.statusText());
      }
    });

    // Set viewport for consistent rendering
    await page.setViewport({ 
      width: 1200, 
      height: 800,
      deviceScaleFactor: 1
    });
    
    // Generate HTML content for the quotation
    const htmlContent = generateQuotationHTML(quotationWithTerms, company);
    // console.log('[pdfGenerator.js] Full HTML content for debug:', htmlContent); // Uncomment if needed, can be very verbose

    // Validate HTML content before proceeding
    if (!htmlContent || htmlContent.length < 1000) {
      console.error('[pdfGenerator.js] Generated HTML content is too short or empty:', htmlContent?.length || 0);
      throw new Error('Generated HTML content is invalid or too short');
    }

    // Basic HTML validation - check for common issues
    const openTags = (htmlContent.match(/</g) || []).length;
    const closeTags = (htmlContent.match(/>/g) || []).length;
    if (Math.abs(openTags - closeTags) > 5) { // Allow some tolerance for self-closing tags
      console.error('[pdfGenerator.js] HTML appears to have unmatched tags. Open:', openTags, 'Close:', closeTags);
    }

    // Write the full HTML content to a debug file
    // const debugHtmlPath = path.join(__dirname, 'debug_quotation.html');
    // try {
    //   fs.writeFileSync(debugHtmlPath, htmlContent);
    //   console.log(`[pdfGenerator.js] Full HTML content for debugging has been written to: ${debugHtmlPath}`);
    // } catch (writeErr) {
    //   console.error(`[pdfGenerator.js] Error writing debug HTML to file: ${writeErr.message}`);
    // }

    try {
      // console.log('[pdfGenerator.js] Attempting page.setContent()...');
      await page.setContent(htmlContent, { 
        waitUntil: 'load',
        timeout: 30000
      });
      // console.log('[pdfGenerator.js] page.setContent() successful.');
    } catch (setContentError) {
      console.error('[pdfGenerator.js] CRITICAL: page.setContent() failed:', setContentError);
      throw new Error(`Page setContent failed: ${setContentError.message}`);
    }
    
    // Take a screenshot before generating PDF for debugging
    // const screenshotPath = path.join(__dirname, 'debug_puppeteer_screenshot.png');
    // try {
    //   await page.screenshot({ path: screenshotPath, fullPage: true });
    //   console.log(`[pdfGenerator.js] Screenshot for debugging saved to: ${screenshotPath}`);
    // } catch (screenshotError) {
    //   console.error(`[pdfGenerator.js] Error taking screenshot: ${screenshotError.message}`);
    // }

    let pdfBuffer;
    try {
      // console.log('[pdfGenerator.js] Attempting page.pdf() with minimal options...');
      pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0.75in',
          bottom: '0.75in',
          left: '0.5in',
          right: '0.5in'
        },
        timeout: 30000
      });
      // console.log('[pdfGenerator.js] page.pdf() with minimal options successful.');
    } catch (pdfError) {
      console.error('[pdfGenerator.js] CRITICAL: page.pdf() with minimal options failed:', pdfError);
      throw new Error(`Page PDF generation with minimal options failed: ${pdfError.message}`);
    }
    
    if (!pdfBuffer || pdfBuffer.length === 0) {
      console.error('[pdfGenerator.js] Error: Generated PDF buffer is empty after successful page.pdf() call.');
      throw new Error('Generated PDF buffer is empty');
    }

    // Check if the buffer is actually a PDF. If not, log its content as text.
    const pdfHeaderText = pdfBuffer.subarray(0, 1024).toString('utf-8'); // Look at the first 1KB as text
    if (!pdfHeaderText.startsWith('%PDF')) {
      // console.warn('[pdfGenerator.js] WARNING: Buffer returned by page.pdf() does NOT start with %PDF. Content (first 1KB):');
      // console.warn(pdfHeaderText); // Intentionally commented out to prevent large log outputs
    }
    
    // Check EOF marker
    // const eofMarker = pdfBuffer.slice(-6).toString('ascii'); // Intentionally commented out
    // console.log('[pdfGenerator.js] EOF marker last 6 bytes ascii:', eofMarker); // Intentionally commented out
    // let lastBytes = []; // Intentionally commented out
    // for (let i = Math.max(0, pdfBuffer.length - 10); i < pdfBuffer.length; i++) { // Intentionally commented out
    //   lastBytes.push(pdfBuffer[i]); // Intentionally commented out
    // }
    // console.log('[pdfGenerator.js] Last 10 raw bytes:', lastBytes.join(',')); // Intentionally commented out
    
    // Convert Uint8Array to Buffer if needed (Fix from PDF_GENERATION_FIX.md)
    const properBuffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
    return properBuffer;
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    
    // Provide more specific error information
    if (error.name === 'TimeoutError') {
      throw new Error('PDF generation timed out. The quotation may be too complex or the server is overloaded.');
    }
    
    if (error.message.includes('Protocol error')) {
      throw new Error('Browser communication error during PDF generation.');
    }
    
    throw new Error('Failed to generate PDF');
  } finally {
    if (page) {
      try {
        await page.close();
        // console.log('[pdfGenerator.js] Puppeteer page closed successfully.');
      } catch (pageCloseError) {
        console.error('[pdfGenerator.js] Error closing Puppeteer page:', pageCloseError);
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
}

/**
 * Generate HTML content for quotation PDF
 * @param {Object} quotation - Quotation document
 * @param {Object} company - Company details
 * @returns {string} - HTML content
 */
function generateQuotationHTML(quotation, company) {
  // Helper function to format currency - now handles Decimal128
  const formatCurrency = (amount) => {
    let numericValue = 0;
    
    console.log('[formatCurrency] Input received:', typeof amount, JSON.stringify(amount));
    
    // Handle Mongoose Decimal128 instances (they have toString method)
    if (amount && typeof amount === 'object' && typeof amount.toString === 'function' && amount.constructor.name === 'Decimal128') {
      numericValue = parseFloat(amount.toString());
      console.log('[formatCurrency] Mongoose Decimal128 found, converted to:', numericValue);
    }
    // Handle MongoDB Decimal128 objects with $numberDecimal property
    else if (amount && typeof amount === 'object' && amount.$numberDecimal) {
      numericValue = parseFloat(amount.$numberDecimal);
      console.log('[formatCurrency] Plain Decimal128 object found, converted to:', numericValue);
    } 
    // Handle regular numbers
    else if (typeof amount === 'number' && !isNaN(amount)) {
      numericValue = amount;
      console.log('[formatCurrency] Regular number:', numericValue);
    }
    // Handle string numbers
    else if (typeof amount === 'string' && !isNaN(parseFloat(amount))) {
      numericValue = parseFloat(amount);
      console.log('[formatCurrency] String number converted to:', numericValue);
    }
    // Try toString() method for other objects (including potential Decimal128)
    else if (amount && typeof amount === 'object' && typeof amount.toString === 'function') {
      const stringVal = amount.toString();
      numericValue = parseFloat(stringVal);
      if (!isNaN(numericValue)) {
        console.log('[formatCurrency] Object toString() converted to:', numericValue);
      } else {
        numericValue = 0;
        console.log('[formatCurrency] Object toString() failed, using 0');
      }
    }
    // Fallback to 0
    else {
      numericValue = 0;
      console.log('[formatCurrency] Fallback to 0, original value was:', amount);
    }
    
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numericValue);
    
    console.log('[formatCurrency] Final formatted result:', formatted);
    return formatted;
  };

  // Helper function to format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Helper function to safely handle address field
  const getSafeAddressString = (addressInput) => {
    if (!addressInput) return '';
    
    if (typeof addressInput === 'string') {
      return addressInput;
    }
    
    if (typeof addressInput === 'object') {
      // Extract address components for structured objects
      const parts = [];
      if (addressInput.street) parts.push(addressInput.street);
      if (addressInput.city) parts.push(addressInput.city);
      if (addressInput.state) parts.push(addressInput.state);
      if (addressInput.zipCode) parts.push(addressInput.zipCode);
      return parts.join(', ');
    }
    
    return '';
  };

  // Helper function to escape HTML entities
  const escapeHtml = (text) => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // Safe field access with HTML escaping
  const safeField = (value, defaultValue = 'N/A') => {
    return escapeHtml(value || defaultValue);
  };

  // Validate required data
  if (!quotation) {
    console.error('[generateQuotationHTML] No quotation data provided');
    throw new Error('Quotation data is required for PDF generation');
  }

  console.log('[generateQuotationHTML] Quotation validation:', {
    id: quotation._id,
    quotationIdDisplay: quotation.quotationIdDisplay,
    hasClientSnapshot: !!quotation.clientSnapshot,
    itemsCount: quotation.items?.length || 0
  });

  console.log('[generateQuotationHTML] Full quotation data structure:', {
    hasQuotationIdDisplay: !!quotation.quotationIdDisplay,
    hasClientSnapshot: !!quotation.clientSnapshot,
    clientSnapshotKeys: quotation.clientSnapshot ? Object.keys(quotation.clientSnapshot) : [],
    hasItems: !!quotation.items,
    itemsLength: quotation.items?.length || 0,
    quotationKeys: Object.keys(quotation || {}),
    quotationType: typeof quotation
  });

  if (!quotation.quotationIdDisplay) {
    console.warn('[generateQuotationHTML] Missing quotationIdDisplay, attempting to use _id or fallback');
    // Try to use _id as fallback or generate a temporary ID
    if (quotation._id) {
      quotation.quotationIdDisplay = `Q-${quotation._id.toString().slice(-8)}`;
      console.log(`[generateQuotationHTML] Using fallback quotationIdDisplay: ${quotation.quotationIdDisplay}`);
    } else {
      quotation.quotationIdDisplay = `Q-${Date.now()}`;
      console.log(`[generateQuotationHTML] Using timestamp fallback quotationIdDisplay: ${quotation.quotationIdDisplay}`);
    }
  }

  if (!quotation.clientSnapshot) {
    console.error('[generateQuotationHTML] Missing client snapshot data');
    throw new Error('Client snapshot data is required');
  }

  // Add null safety for client snapshot fields
  if (!quotation.clientSnapshot.clientName) {
    console.warn('[generateQuotationHTML] Warning: Client name is missing, using fallback');
    quotation.clientSnapshot.clientName = 'Valued Customer';
  }

  if (!quotation.clientSnapshot.contactNumber) {
    console.warn('[generateQuotationHTML] Warning: Contact number is missing');
    quotation.clientSnapshot.contactNumber = 'N/A';
  }

  if (!quotation.items || quotation.items.length === 0) {
    console.error('[generateQuotationHTML] No items found in quotation');
    throw new Error('Quotation must have at least one item');
  }

  // Safely handle items to prevent undefined errors
  const safeItems = quotation.items.map(item => ({
    ...item,
    productTypeNameSnapshot: item.productTypeNameSnapshot || 'Unknown Product',
    width: item.width || 0,
    height: item.height || 0,
    quantity: item.quantity || 1,
    totalChargeableArea: item.totalChargeableArea || 0,
    pricePerAreaUnit: item.pricePerAreaUnit || 0,
    itemSubtotal: item.itemSubtotal || 0,
    itemLabel: item.itemLabel || ''
  }));

  // Calculate totals for summary - convert Decimal128 to numbers
  const subtotal = quotation.subtotal && typeof quotation.subtotal.toString === 'function' ? parseFloat(quotation.subtotal.toString()) : 0;
  const totalCharges = quotation.totalCharges && typeof quotation.totalCharges.toString === 'function' ? parseFloat(quotation.totalCharges.toString()) : 0;
  const discountAmount = quotation.discountAmount && typeof quotation.discountAmount.toString === 'function' ? parseFloat(quotation.discountAmount.toString()) : 0;
  const grandTotal = quotation.grandTotal && typeof quotation.grandTotal.toString === 'function' ? parseFloat(quotation.grandTotal.toString()) : 0;
  const gstAmount = totalCharges;

  console.log('[generateQuotationHTML] Totals calculation:');
  console.log('[generateQuotationHTML] quotation.subtotal:', typeof quotation.subtotal, JSON.stringify(quotation.subtotal));
  console.log('[generateQuotationHTML] quotation.totalCharges:', typeof quotation.totalCharges, JSON.stringify(quotation.totalCharges));
  console.log('[generateQuotationHTML] quotation.grandTotal:', typeof quotation.grandTotal, JSON.stringify(quotation.grandTotal));
  console.log('[generateQuotationHTML] calculated subtotal:', subtotal);
  console.log('[generateQuotationHTML] calculated totalCharges:', totalCharges);
  console.log('[generateQuotationHTML] calculated grandTotal:', grandTotal);

  // Helper function to get logo HTML
  const getLogoHTML = (company) => {
    if (company && company.logoUrl) {
      const logoPath = company.logoUrl.startsWith('/uploads/') 
        ? `http://localhost:3001${company.logoUrl}` 
        : company.logoUrl;
      return `<img src="${logoPath}" alt="Company Logo" class="company-logo" />`;
    }
    return '';
  };

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Quotation ${quotation.quotationIdDisplay} - ${safeField(company?.name || 'Company')}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Arial', 'Helvetica', sans-serif;
          line-height: 1.4;
          color: #333;
          background: #fff;
          font-size: 12px;
        }
        
        .page {
          max-width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          padding: 0;
          background: white;
          position: relative;
        }
        
        /* Company Logo */
        .company-logo {
          max-height: 60px;
          max-width: 120px;
          width: auto;
          height: auto;
          margin-bottom: 10px;
          object-fit: contain;
        }
        
        /* Header Section */
        .header {
          border: 2px solid #1e40af;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
        }
        
        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        
        .company-section {
          flex: 1;
          padding-right: 20px;
        }
        
        .quotation-title {
          font-size: 28px;
          font-weight: bold;
          color: #1e40af;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .company-name {
          font-size: 24px;
          font-weight: bold;
          color: #1e40af;
          margin-bottom: 8px;
        }
        
        .company-address {
          font-size: 11px;
          color: #4b5563;
          line-height: 1.3;
          margin-bottom: 8px;
        }
        
        .company-contact {
          font-size: 11px;
          color: #1e40af;
          font-weight: 600;
        }
        
        .client-section {
          flex: 1;
          padding-left: 20px;
          border-left: 2px solid #e2e8f0;
        }
        
        .client-info {
          margin-bottom: 15px;
        }
        
        .client-info h3 {
          font-size: 14px;
          font-weight: bold;
          color: #1e40af;
          margin-bottom: 8px;
          border-bottom: 1px solid #1e40af;
          padding-bottom: 2px;
        }
        
        .client-details {
          font-size: 11px;
          line-height: 1.4;
        }
        
        .client-details .label {
          font-weight: 600;
          color: #374151;
        }
        
        .client-details .value {
          color: #4b5563;
          margin-bottom: 3px;
        }
        
        /* Quotation Metadata Table */
        .metadata-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          overflow: hidden;
        }
        
        .metadata-table th {
          background: #1e40af;
          color: white;
          padding: 8px 12px;
          text-align: center;
          font-weight: 600;
          font-size: 11px;
        }
        
        .metadata-table td {
          padding: 8px 12px;
          text-align: center;
          border-right: 1px solid #d1d5db;
          font-size: 11px;
          font-weight: 600;
          color: #374151;
        }
        
        .metadata-table td:last-child {
          border-right: none;
        }
        
        /* Introductory Text */
        .intro-section {
          margin-bottom: 20px;
          padding: 15px;
          background: #f8fafc;
          border-left: 4px solid #1e40af;
          border-radius: 4px;
        }
        
        .intro-text {
          font-size: 11px;
          line-height: 1.5;
          color: #374151;
        }
        
        .intro-text .greeting {
          font-weight: 600;
          margin-bottom: 8px;
        }
        
        .intro-list {
          margin: 8px 0;
          padding-left: 15px;
        }
        
        .intro-list li {
          margin-bottom: 3px;
        }
        
        /* Items Section */
        .items-section {
          margin-bottom: 25px;
        }
        
        .section-title {
          font-size: 16px;
          font-weight: bold;
          color: #1e40af;
          margin-bottom: 12px;
          padding-bottom: 5px;
          border-bottom: 2px solid #1e40af;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .items-table th {
          background: #1e40af;
          color: white;
          padding: 12px 8px;
          text-align: center;
          font-weight: 600;
          font-size: 10px;
          border-right: 1px solid rgba(255,255,255,0.2);
        }
        
        .items-table th:last-child {
          border-right: none;
        }
        
        .items-table td {
          padding: 12px 8px;
          border-bottom: 1px solid #e5e7eb;
          border-right: 1px solid #e5e7eb;
          font-size: 10px;
          vertical-align: top;
        }
        
        .items-table td:last-child {
          border-right: none;
        }
        
        .items-table tr:nth-child(even) {
          background: #f9fafb;
        }
        
        .items-table tr:hover {
          background: #f3f4f6;
        }
        
        .item-description {
          font-weight: 600;
          color: #374151;
          margin-bottom: 4px;
        }
        
        .item-specs {
          font-size: 9px;
          color: #6b7280;
          font-style: italic;
        }
        
        /* Technical Drawing Container - Prevent page breaks */
        .technical-drawing-container {
          page-break-inside: avoid;
          break-inside: avoid;
          margin: 8px 0; 
          text-align: center; 
          display: block; 
          width: 100%; 
          overflow: hidden;
        }
        
        /* Prevent item rows from breaking across pages */
        .items-table tr {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        
        /* Summary Section */
        .summary-section {
          margin-bottom: 25px;
          display: flex;
          justify-content: flex-end;
        }
        
        .summary-box {
          width: 400px;
          border: 2px solid #1e40af;
          border-radius: 8px;
          overflow: hidden;
        }
        
        .summary-header {
          background: #1e40af;
          color: white;
          padding: 10px 15px;
          font-weight: bold;
          font-size: 14px;
          text-align: center;
        }
        
        .summary-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .summary-table td {
          padding: 8px 15px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 11px;
        }
        
        .summary-table .label {
          text-align: left;
          color: #374151;
          font-weight: 500;
          width: 60%;
        }
        
        .summary-table .value {
          text-align: right;
          color: #1f2937;
          font-weight: 600;
          width: 40%;
        }
        
        .summary-table .grand-total {
          background: #f3f4f6;
          font-weight: bold;
          font-size: 12px;
          color: #1e40af;
        }
        
        .summary-table .discount-row {
          color: #dc2626;
        }
        
        /* Payment Terms */
        .payment-terms {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 20px;
        }
        
        .payment-terms h4 {
          font-size: 12px;
          font-weight: bold;
          color: #92400e;
          margin-bottom: 6px;
        }
        
        .payment-terms p {
          font-size: 11px;
          color: #78350f;
          margin: 0;
        }
        
        /* Notes Section */
        .notes-section {
          margin-bottom: 20px;
        }
        
        .notes-content {
          background: #f0f9ff;
          border: 1px solid #0284c7;
          border-radius: 6px;
          padding: 15px;
          font-size: 11px;
          line-height: 1.5;
          color: #0c4a6e;
        }
        
        /* Terms Section */
        .terms-section {
          margin-bottom: 20px;
        }
        
        .terms-content {
          background: #f8fafc;
          border: 1px solid #64748b;
          border-radius: 6px;
          padding: 15px;
          font-size: 10px;
          line-height: 1.4;
          color: #475569;
        }
        
        /* Footer */
        .footer {
          margin-top: 30px;
          border-top: 1px solid #e5e7eb;
          padding-top: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 10px;
          color: #6b7280;
        }
        
        .footer-left {
          font-weight: 600;
          color: #1e40af;
        }
        
        .footer-center {
          text-align: center;
          font-style: italic;
        }
        
        .footer-right {
          text-align: right;
        }
        
        /* Status Badge */
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .status-draft { background: #f3f4f6; color: #374151; }
        .status-sent { background: #dbeafe; color: #1d4ed8; }
        .status-viewed { background: #fef3c7; color: #d97706; }
        .status-accepted { background: #d1fae5; color: #065f46; }
        .status-rejected { background: #fee2e2; color: #dc2626; }
        .status-expired { background: #fed7aa; color: #ea580c; }
        .status-converted { background: #e9d5ff; color: #7c3aed; }
        
        @media print {
          .page {
            margin: 0;
            padding: 0;
          }
          
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <!-- Header Section -->
        <div class="header">
          <div class="header-top">
            <!-- Company Section -->
            <div class="company-section">
              ${getLogoHTML(company)}
              <div class="quotation-title">Quotation</div>
              <div class="company-name">${safeField(company?.name || 'Company')}</div>
              <div class="company-address">
                ${safeField(company?.address || 'Business Address')}
              </div>
              <div class="company-contact">
                Phone: ${safeField(company?.phone || '+91 XXXXX XXXXX')} | Email: ${safeField(company?.email || 'info@company.com')}
              </div>
            </div>
            
            <!-- Client Section -->
            <div class="client-section">
              <!-- Bill To -->
              <div class="client-info">
                <h3>Bill To</h3>
                <div class="client-details">
                  <div><span class="label">Client Name:</span> <span class="value">${safeField(quotation.clientSnapshot.clientName)}</span></div>
                  <div><span class="label">Contact:</span> <span class="value">${safeField(quotation.clientSnapshot.contactNumber)}</span></div>
                  <div><span class="label">Email:</span> <span class="value">${safeField(quotation.clientSnapshot.email || 'murtazakalang@gmail.com')}</span></div>
                  <div><span class="label">Address:</span> <span class="value">${safeField(getSafeAddressString(quotation.clientSnapshot.billingAddress))}</span></div>
                  ${quotation.clientSnapshot.gstin ? `<div><span class="label">GSTIN:</span> <span class="value">${safeField(quotation.clientSnapshot.gstin)}</span></div>` : ''}
                </div>
              </div>
              
              <!-- Deliver To / Site Address -->
              ${quotation.clientSnapshot.siteAddress ? `
                <div class="client-info">
                  <h3>Deliver To</h3>
                  <div class="client-details">
                    <div><span class="label">Contact Person:</span> <span class="value">${safeField(quotation.clientSnapshot.contactPerson || quotation.clientSnapshot.clientName)}</span></div>
                    <div><span class="label">Site Address:</span> <span class="value">${safeField(getSafeAddressString(quotation.clientSnapshot.siteAddress))}</span></div>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
          
          <!-- Status Badge -->
          <div style="text-align: right; margin-top: 10px;">
            <span class="status-badge status-${quotation.status.toLowerCase()}">
              ${quotation.status}
            </span>
          </div>
        </div>
        
        <!-- Quotation Metadata Table -->
        <table class="metadata-table">
          <thead>
            <tr>
              <th>Quote No.</th>
              <th>Quote Date</th>
              <th>Print Date</th>
              <th>Valid Upto</th>
              <th>Responsible Person</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${quotation.quotationIdDisplay}</td>
              <td>${formatDate(quotation.createdAt)}</td>
              <td>${formatDate(new Date())}</td>
              <td>${quotation.validUntil ? formatDate(quotation.validUntil) : 'Not specified'}</td>
              <td>Murtaza K.</td>
            </tr>
          </tbody>
        </table>
        
        <!-- Introductory Text -->
        <div class="intro-section">
          <div class="intro-text">
            <div class="greeting">Dear ${safeField(quotation.clientSnapshot.clientName)},</div>
            <p>Thank you for your interest in ${safeField(company?.name || 'our company')}'s products and services. We are pleased to provide the following quotation for your consideration:</p>
            <ul class="intro-list">
              <li>Product design, specification, and pricing</li>
              <li>Professional installation and quality assurance</li>
              <li>Terms and conditions as specified below</li>
            </ul>
          </div>
        </div>
        
        <!-- Items Section -->
        <div class="items-section">
          <div class="section-title">Itemized Quotation</div>
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 5%;">Item #</th>
                <th style="width: 50%;">Product Description</th>
                <th style="width: 10%;">Qty</th>
                <th style="width: 15%;">Rate per ${quotation.areaUnit || 'sqft'}</th>
                <th style="width: 20%;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${safeItems.map((item, index) => `
                <tr>
                  <td class="text-center">${String(index + 1).padStart(3, '0')}</td>
                  <td class="text-left">
                    <div class="item-description">${safeField(item.productTypeNameSnapshot)}</div>
                    ${item.itemLabel ? `<div class="item-specs">Label: ${safeField(item.itemLabel)}</div>` : ''}
                    ${item.selectedGlassTypeNameSnapshot ? `<div class="item-specs">Glass: ${safeField(item.selectedGlassTypeNameSnapshot)}</div>` : ''}
                    ${item.frameColour ? `<div class="item-specs">Frame: ${safeField(item.frameColour)}</div>` : ''}
                    <div class="item-specs">Dimension: ${item.width && item.width.$numberDecimal ? parseFloat(item.width.$numberDecimal).toFixed(2) : parseFloat(item.width.toString() || '0').toFixed(2)}W × ${item.height && item.height.$numberDecimal ? parseFloat(item.height.$numberDecimal).toFixed(2) : parseFloat(item.height.toString() || '0').toFixed(2)}H = ${item.totalChargeableArea && item.totalChargeableArea.$numberDecimal ? parseFloat(item.totalChargeableArea.$numberDecimal).toFixed(2) : parseFloat(item.totalChargeableArea.toString() || '0').toFixed(2)} ${quotation.areaUnit || 'sqft'}</div>
                    ${item.technicalDrawingSvg ? `<div class="technical-drawing-container">${item.technicalDrawingSvg}</div>` : ''}
                    <div class="item-specs">System: Premium Quality</div>
                  </td>
                  <td class="text-center">${item.quantity}</td>
                  <td class="text-right">${formatCurrency(item.pricePerAreaUnit)}</td>
                  <td class="text-right"><strong>${formatCurrency(item.itemSubtotal)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <!-- Summary Section -->
        <div class="summary-section">
          <div class="summary-box">
            <div class="summary-header">Quotation Summary</div>
            <table class="summary-table">
              <tr>
                <td class="label">Total Material Price:</td>
                <td class="value">${formatCurrency(subtotal)}</td>
              </tr>
              ${discountAmount > 0 ? `
                <tr class="discount-row">
                  <td class="label">Discount Applied:</td>
                  <td class="value">-${formatCurrency(discountAmount)}</td>
                </tr>
                <tr>
                  <td class="label">Material Subtotal:</td>
                  <td class="value">${formatCurrency(subtotal - discountAmount)}</td>
                </tr>
              ` : ''}
              ${quotation.charges && quotation.charges.length > 0 ? quotation.charges.map(charge => `
                <tr>
                  <td class="label">${charge.description}:</td>
                  <td class="value">${formatCurrency(charge.amount)}</td>
                </tr>
              `).join('') : ''}
              <tr class="grand-total">
                <td class="label">Grand Total:</td>
                <td class="value">${formatCurrency(grandTotal)}</td>
              </tr>
            </table>
          </div>
        </div>
        
        <!-- Payment Terms -->
        ${quotation.paymentTerms ? `
          <div class="payment-terms">
            <h4>Payment Terms</h4>
            <p>${safeField(quotation.paymentTerms)}</p>
          </div>
        ` : `
          <div class="payment-terms">
            <h4>Payment Terms</h4>
            <p>100% Advance payment required before commencement of work. Payment can be made via bank transfer, UPI, or cash.</p>
          </div>
        `}
        
        <!-- Notes Section -->
        ${quotation.notes ? `
          <div class="notes-section">
            <div class="section-title">Special Notes</div>
            <div class="notes-content">${safeField(quotation.notes)}</div>
          </div>
        ` : ''}
        
        <!-- Terms and Conditions -->
        ${quotation.termsAndConditions ? `
          <div class="terms-section">
            <div class="section-title">Terms and Conditions</div>
            <div class="terms-content">${safeField(quotation.termsAndConditions)}</div>
          </div>
        ` : `
          <div class="terms-section">
            <div class="section-title">Terms and Conditions</div>
            <div class="terms-content">
              1. This quotation is valid for 30 days from the date of issue.<br>
              2. Prices are subject to change without prior notice.<br>
              3. Installation charges are included in the quoted price unless specified otherwise.<br>
              4. Material delivery will be coordinated with the client.<br>
              5. Any additional work beyond the scope will be charged separately.<br>
              6. ConceptBlogging reserves the right to modify specifications based on site conditions.
            </div>
          </div>
        `}
        
        <!-- Footer -->
        <div class="footer">
          <div>Thank you for your business! | ${safeField(company?.name || 'Company')} | Page 1 of 1</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate PDF for invoice
 * @param {Object} invoice - Invoice document
 * @param {Object} company - Company details for branding
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generateInvoicePDF(invoice, company = {}) {
  let browser;
  let page;
  
  try {
    // Fetch current settings if invoice doesn't have terms populated
    let effectivePaymentTerms = invoice.paymentTerms;
    let effectiveTermsAndConditions = invoice.termsAndConditions;
    
    if (!effectivePaymentTerms || !effectiveTermsAndConditions) {
      try {
        const Setting = require('../models/Setting');
        const settings = await Setting.findOne({ companyId: invoice.companyId });
        if (settings) {
          if (!effectivePaymentTerms) {
            effectivePaymentTerms = settings.paymentTerms?.invoice || '';
          }
          if (!effectiveTermsAndConditions) {
            effectiveTermsAndConditions = settings.termsAndConditions?.invoice || '';
          }
        }
      } catch (settingsError) {
        console.warn('Could not fetch settings for invoice PDF generation:', settingsError.message);
      }
    }
    
    // Add the effective terms to invoice object for PDF generation
    const invoiceWithTerms = {
      ...invoice,
      paymentTerms: effectivePaymentTerms,
      termsAndConditions: effectiveTermsAndConditions
    };

    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      timeout: 30000
    });
    
    page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({ 
      width: 1200, 
      height: 800,
      deviceScaleFactor: 1
    });
    
    // Generate HTML content for the invoice
    const htmlContent = generateInvoiceHTML(invoiceWithTerms, company);

    await page.setContent(htmlContent, { 
      waitUntil: 'load',
      timeout: 30000
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.75in',
        bottom: '0.75in',
        left: '0.5in',
        right: '0.5in'
      },
      timeout: 30000
    });
    
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Generated PDF buffer is empty');
    }
    
    // Convert Uint8Array to Buffer if needed (Fix from PDF_GENERATION_FIX.md)
    const properBuffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
    return properBuffer;
    
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    
    if (error.name === 'TimeoutError') {
      throw new Error('PDF generation timed out. The invoice may be too complex or the server is overloaded.');
    }
    
    if (error.message.includes('Protocol error')) {
      throw new Error('Browser communication error during PDF generation.');
    }
    
    throw new Error('Failed to generate invoice PDF');
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (pageCloseError) {
        console.error('Error closing Puppeteer page:', pageCloseError);
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
}

/**
 * Generate HTML content for invoice PDF
 * @param {Object} invoice - Invoice document
 * @param {Object} company - Company details
 * @returns {string} - HTML content
 */
function generateInvoiceHTML(invoice, company) {
  const formatCurrency = (amount) => {
    try {
      let numericValue = 0;
      
      // Handle Mongoose Decimal128 instances (they have toString method)
      if (amount && typeof amount === 'object' && typeof amount.toString === 'function' && amount.constructor.name === 'Decimal128') {
        numericValue = parseFloat(amount.toString());
      }
      // Handle MongoDB Decimal128 objects with $numberDecimal property
      else if (amount && typeof amount === 'object' && amount.$numberDecimal) {
        numericValue = parseFloat(amount.$numberDecimal);
      } 
      // Handle regular numbers
      else if (typeof amount === 'number' && !isNaN(amount)) {
        numericValue = amount;
      }
      // Handle string numbers
      else if (typeof amount === 'string' && !isNaN(parseFloat(amount))) {
        numericValue = parseFloat(amount);
      }
      // Try toString() method for other objects (including potential Decimal128)
      else if (amount && typeof amount === 'object' && typeof amount.toString === 'function') {
        const stringVal = amount.toString();
        numericValue = parseFloat(stringVal);
        if (!isNaN(numericValue)) {
          console.log('[formatCurrency] Object toString() converted to:', numericValue);
        } else {
          numericValue = 0;
          console.log('[formatCurrency] Object toString() failed, using 0');
        }
      }
      // Fallback to 0
      else {
        numericValue = 0;
        console.log('[formatCurrency] Fallback to 0, original value was:', amount);
      }
      
      return `₹${numericValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } catch (error) {
      return '₹0.00';
    }
  };
  
  const formatDate = (date) => {
    try {
      return new Date(date).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const getSafeAddressString = (addressInput) => {
    if (!addressInput) return 'Not specified';
    const cleanAddress = String(addressInput)
      .replace(/undefined/g, '')
      .replace(/null/g, '')
      .replace(/,\s*,/g, ',')
      .replace(/^,\s*|,\s*$/g, '')
      .trim();
    return cleanAddress || 'Not specified';
  };

  // HTML escape function to prevent injection and parsing errors
  const escapeHtml = (text) => {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // Safe field access with HTML escaping
  const safeField = (value, defaultValue = 'N/A') => {
    return escapeHtml(value || defaultValue);
  };

  // Safe handling of invoice data
  const safeInvoice = {
    invoiceIdDisplay: invoice.invoiceIdDisplay || 'INV-000',
    status: invoice.status || 'Draft',
    invoiceDate: invoice.invoiceDate || new Date(),
    dueDate: invoice.dueDate || new Date(),
    grandTotal: invoice.grandTotal || '0.00',
    subtotal: invoice.subtotal || '0.00',
    totalCharges: invoice.totalCharges || '0.00',
    totalTax: invoice.totalTax || '0.00',
    amountPaid: invoice.amountPaid || '0.00',
    balanceDue: invoice.balanceDue || '0.00',
    clientSnapshot: invoice.clientSnapshot || {},
    items: invoice.items || [],
    charges: invoice.charges || [],
    discount: invoice.discount || { type: 'fixed', value: '0.00' },
    payments: invoice.payments || [],
    termsAndConditions: invoice.termsAndConditions || '',
    notes: invoice.notes || '',
    paymentTerms: invoice.paymentTerms || ''
  };

  const safeItems = safeInvoice.items.filter(item => item && item.productTypeNameSnapshot);

  // Calculate totals
  const subtotal = parseFloat(safeInvoice.subtotal.toString() || '0');
  const totalCharges = parseFloat(safeInvoice.totalCharges.toString() || '0');
  const totalTax = parseFloat(safeInvoice.totalTax.toString() || '0');
  const grandTotal = parseFloat(safeInvoice.grandTotal.toString() || '0');
  const amountPaid = parseFloat(safeInvoice.amountPaid.toString() || '0');
  const balanceDue = parseFloat(safeInvoice.balanceDue.toString() || '0');

  // Calculate discount amount
  let discountAmount = 0;
  if (safeInvoice.discount && safeInvoice.discount.value) {
    const discountValue = parseFloat(safeInvoice.discount.value.toString() || '0');
    if (safeInvoice.discount.type === 'percentage') {
      discountAmount = (subtotal * discountValue) / 100;
    } else {
      discountAmount = discountValue;
    }
  }

  // Helper function to get logo HTML for invoice
  const getLogoHTML = (company) => {
    if (company && company.logoUrl) {
      const logoPath = company.logoUrl.startsWith('/uploads/') 
        ? `http://localhost:3001${company.logoUrl}` 
        : company.logoUrl;
      return `<img src="${logoPath}" alt="Company Logo" class="company-logo" />`;
    }
    return '';
  };

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${safeInvoice.invoiceIdDisplay} - ${safeField(company?.name || 'Company')}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; line-height: 1.4; color: #333; background: #fff; }
        .invoice-container { max-width: 210mm; margin: 0 auto; padding: 15mm; }
        
        /* Company Logo */
        .company-logo {
          max-height: 60px;
          max-width: 120px;
          width: auto;
          height: auto;
          margin-bottom: 10px;
          object-fit: contain;
        }
        
        /* Header */
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 15px; }
        .company-info { flex: 1; }
        .company-name { font-size: 24px; font-weight: bold; color: #1f2937; margin-bottom: 5px; }
        .company-tagline { font-size: 12px; color: #6b7280; margin-bottom: 10px; }
        .company-details { font-size: 11px; color: #6b7280; line-height: 1.3; }
        .invoice-title { text-align: right; }
        .invoice-title h1 { font-size: 28px; color: #dc2626; margin-bottom: 5px; }
        .invoice-number { font-size: 14px; color: #6b7280; }
        
        /* Client and Invoice Info */
        .invoice-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .client-section { flex: 1; margin-right: 20px; }
        .client-info { margin-bottom: 15px; }
        .client-info h3 { color: #1f2937; margin-bottom: 8px; font-size: 14px; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; }
        .client-details div { margin-bottom: 3px; }
        .label { font-weight: 600; color: #374151; display: inline-block; width: 80px; }
        .value { color: #6b7280; }
        
        /* Invoice Details Table */
        .invoice-details { flex: 0 0 300px; }
        .details-table { width: 100%; border-collapse: collapse; border: 1px solid #d1d5db; }
        .details-table th, .details-table td { padding: 8px; border: 1px solid #d1d5db; text-align: left; }
        .details-table th { background-color: #f9fafb; font-weight: 600; }
        
        /* Status Badge */
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
        .status-draft { background-color: #fef3c7; color: #92400e; }
        .status-sent { background-color: #dbeafe; color: #1e40af; }
        .status-paid { background-color: #d1fae5; color: #065f46; }
        .status-partially.paid { background-color: #fed7aa; color: #c2410c; }
        .status-overdue { background-color: #fecaca; color: #991b1b; }
        .status-void { background-color: #f3f4f6; color: #6b7280; }
        
        /* Items Table */
        .items-section { margin: 20px 0; }
        .section-title { font-size: 16px; font-weight: bold; color: #1f2937; margin-bottom: 10px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items-table th, .items-table td { padding: 10px 8px; border: 1px solid #d1d5db; }
        .items-table th { background-color: #f9fafb; font-weight: 600; text-align: center; }
        .items-table tbody tr:nth-child(even) { background-color: #f9fafb; }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .item-description { font-weight: 600; margin-bottom: 2px; }
        .item-specs { font-size: 10px; color: #6b7280; }
        
        /* Summary Section */
        .summary-section { display: flex; justify-content: flex-end; margin: 20px 0; }
        .summary-box { border: 2px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb; min-width: 300px; }
        .summary-header { font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 10px; color: #1f2937; }
        .summary-table { width: 100%; }
        .summary-table td { padding: 6px 0; }
        .summary-table .label { font-weight: 500; }
        .summary-table .value { text-align: right; font-weight: 600; }
        .grand-total { border-top: 2px solid #374151; margin-top: 5px; }
        .grand-total .label, .grand-total .value { font-size: 14px; font-weight: bold; color: #1f2937; padding-top: 8px; }
        .discount-row { color: #dc2626; }
        .balance-due { background-color: #fef2f2; border-top: 2px solid #dc2626; }
        .balance-due .label, .balance-due .value { color: #dc2626; font-weight: bold; padding-top: 8px; }
        
        /* Payments Section */
        .payments-section { margin: 20px 0; }
        .payments-table { width: 100%; border-collapse: collapse; }
        .payments-table th, .payments-table td { padding: 8px; border: 1px solid #d1d5db; }
        .payments-table th { background-color: #f9fafb; font-weight: 600; }
        
        /* Footer */
        .footer {
          margin-top: 30px;
          border-top: 1px solid #e5e7eb;
          padding-top: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 10px;
          color: #6b7280;
        }
        
        /* Page break utilities */
        .page-break { page-break-before: always; }
        
        @media print {
          .invoice-container { margin: 0; padding: 0; }
          
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header -->
        <div class="header">
          <div class="company-info">
            ${getLogoHTML(company)}
            <div class="company-name">${safeField(company?.name || 'Company')}</div>
            <div class="company-tagline">Premium Window Solutions</div>
            <div class="company-details">
              ${safeField(company?.address || 'Business Address')}<br>
              Phone: ${safeField(company?.phone || '+91 XXXXX XXXXX')}<br>
              Email: ${safeField(company?.email || 'info@company.com')}
            </div>
          </div>
          <div class="invoice-title">
            <h1>INVOICE</h1>
            <div class="invoice-number">#${safeInvoice.invoiceIdDisplay}</div>
          </div>
        </div>
        
        <!-- Invoice and Client Information -->
        <div class="invoice-info">
          <div class="client-section">
            <!-- Bill To -->
            <div class="client-info">
              <h3>Bill To</h3>
              <div class="client-details">
                <div><span class="label">Client Name:</span> <span class="value">${safeField(safeInvoice.clientSnapshot.clientName)}</span></div>
                <div><span class="label">Contact:</span> <span class="value">${safeField(safeInvoice.clientSnapshot.contactNumber)}</span></div>
                <div><span class="label">Email:</span> <span class="value">${safeField(safeInvoice.clientSnapshot.email)}</span></div>
                <div><span class="label">Address:</span> <span class="value">${safeField(getSafeAddressString(safeInvoice.clientSnapshot.billingAddress))}</span></div>
                ${safeInvoice.clientSnapshot.gstin ? `<div><span class="label">GSTIN:</span> <span class="value">${safeField(safeInvoice.clientSnapshot.gstin)}</span></div>` : ''}
              </div>
            </div>
            
            <!-- Deliver To / Site Address -->
            ${safeInvoice.clientSnapshot.siteAddress ? `
              <div class="client-info">
                <h3>Deliver To</h3>
                <div class="client-details">
                  <div><span class="label">Contact Person:</span> <span class="value">${safeField(safeInvoice.clientSnapshot.contactPerson)}</span></div>
                  <div><span class="label">Site Address:</span> <span class="value">${safeField(getSafeAddressString(safeInvoice.clientSnapshot.siteAddress))}</span></div>
                </div>
              </div>
            ` : ''}
          </div>
          
          <!-- Invoice Details -->
          <div class="invoice-details">
            <table class="details-table">
              <tr>
                <th>Invoice Date</th>
                <td>${formatDate(safeInvoice.invoiceDate)}</td>
              </tr>
              <tr>
                <th>Due Date</th>
                <td>${formatDate(safeInvoice.dueDate)}</td>
              </tr>
              <tr>
                <th>Status</th>
                <td><span class="status-badge status-${safeInvoice.status.toLowerCase().replace(' ', '-')}">${safeInvoice.status}</span></td>
              </tr>
              ${invoice.orderId ? `
                <tr>
                  <th>Order No.</th>
                  <td>${safeField(invoice.orderIdDisplaySnapshot)}</td>
                </tr>
              ` : ''}
            </table>
          </div>
        </div>
        
        <!-- Items Section -->
        <div class="items-section">
          <div class="section-title">Invoice Items</div>
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 5%;">Item #</th>
                <th style="width: 35%;">Product Description</th>
                <th style="width: 15%;">Dimensions<br>(W × H)</th>
                <th style="width: 10%;">Area</th>
                <th style="width: 8%;">Qty</th>
                <th style="width: 12%;">Rate</th>
                <th style="width: 15%;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${safeItems.map((item, index) => `
                <tr>
                  <td class="text-center">${String(index + 1).padStart(3, '0')}</td>
                  <td class="text-left">
                    <div class="item-description">${safeField(item.productTypeNameSnapshot)}</div>
                    ${item.itemLabel ? `<div class="item-specs">Label: ${safeField(item.itemLabel)}</div>` : ''}
                    ${item.selectedGlassTypeNameSnapshot ? `<div class="item-specs">Glass: ${safeField(item.selectedGlassTypeNameSnapshot)}</div>` : ''}
                    ${item.frameColour ? `<div class="item-specs">Frame: ${safeField(item.frameColour)}</div>` : ''}
                  </td>
                  <td class="text-center">
                    ${item.finalWidth ? parseFloat(item.finalWidth.toString()).toFixed(2) : '0.00'} × ${item.finalHeight ? parseFloat(item.finalHeight.toString()).toFixed(2) : '0.00'}
                  </td>
                  <td class="text-center">
                    ${item.finalTotalChargeableArea ? parseFloat(item.finalTotalChargeableArea.toString()).toFixed(2) : '0.00'}
                  </td>
                  <td class="text-center">${item.finalQuantity || 1}</td>
                  <td class="text-right">${formatCurrency(item.pricePerAreaUnit)}</td>
                  <td class="text-right"><strong>${formatCurrency(item.finalItemSubtotal)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <!-- Summary Section -->
        <div class="summary-section">
          <div class="summary-box">
            <div class="summary-header">Invoice Summary</div>
            <table class="summary-table">
              <tr>
                <td class="label">Subtotal:</td>
                <td class="value">${formatCurrency(subtotal)}</td>
              </tr>
              ${discountAmount > 0 ? `
                <tr class="discount-row">
                  <td class="label">Discount Applied:</td>
                  <td class="value">-${formatCurrency(discountAmount)}</td>
                </tr>
              ` : ''}
              ${safeInvoice.charges && safeInvoice.charges.length > 0 ? safeInvoice.charges.map(charge => `
                <tr>
                  <td class="label">${charge.description}:</td>
                  <td class="value">${formatCurrency(charge.amount)}</td>
                </tr>
              `).join('') : ''}
              ${totalTax > 0 ? `
                <tr>
                  <td class="label">Tax:</td>
                  <td class="value">${formatCurrency(totalTax)}</td>
                </tr>
              ` : ''}
              <tr class="grand-total">
                <td class="label">Total Amount:</td>
                <td class="value">${formatCurrency(grandTotal)}</td>
              </tr>
              ${amountPaid > 0 ? `
                <tr>
                  <td class="label">Amount Paid:</td>
                  <td class="value">${formatCurrency(amountPaid)}</td>
                </tr>
              ` : ''}
              ${balanceDue > 0 ? `
                <tr class="balance-due">
                  <td class="label">Balance Due:</td>
                  <td class="value">${formatCurrency(balanceDue)}</td>
                </tr>
              ` : ''}
            </table>
          </div>
        </div>
        
        <!-- Payments Section -->
        ${safeInvoice.payments && safeInvoice.payments.length > 0 ? `
          <div class="payments-section">
            <div class="section-title">Payment History</div>
            <table class="payments-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                ${safeInvoice.payments.map(payment => `
                  <tr>
                    <td>${formatDate(payment.paymentDate)}</td>
                    <td>${formatCurrency(payment.amount)}</td>
                    <td>${safeField(payment.method)}</td>
                    <td>${safeField(payment.reference)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
        
        <!-- Notes Section -->
        ${safeInvoice.notes ? `
          <div class="notes-section">
            <div class="section-title">Notes</div>
            <div class="notes-content">${safeField(safeInvoice.notes)}</div>
          </div>
        ` : ''}
        
        <!-- Terms and Conditions -->
        ${safeInvoice.termsAndConditions ? `
          <div class="terms-section">
            <div class="section-title">Terms and Conditions</div>
            <div class="terms-content">${safeField(safeInvoice.termsAndConditions)}</div>
          </div>
        ` : ''}
        
        <!-- Payment Terms -->
        ${safeInvoice.paymentTerms ? `
          <div class="terms-section">
            <div class="section-title">Payment Terms</div>
            <div class="terms-content">${safeField(safeInvoice.paymentTerms)}</div>
          </div>
        ` : `
          <div class="terms-section">
            <div class="section-title">Payment Terms</div>
            <div class="terms-content">
              • Payment is due within 30 days of invoice date.<br>
              • Late payments may incur additional charges.<br>
              • All work and materials are guaranteed for 12 months.<br>
              • Disputes must be reported within 7 days of delivery.
            </div>
          </div>
        `}
        
        <!-- Footer -->
        <div class="footer">
          <div>Thank you for your business! | ${safeField(company?.name || 'Company')} | Page 1 of 1</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  generateQuotationPDF,
  generateInvoicePDF
}; 