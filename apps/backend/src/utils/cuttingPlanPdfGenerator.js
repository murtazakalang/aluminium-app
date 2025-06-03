const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

/**
 * Generate PDF for cutting plan
 * @param {Object} params - Parameters object
 * @param {Object} params.cuttingPlan - Cutting plan document
 * @param {Object} params.order - Order document
 * @param {Object} params.company - Company details
 * @param {string} params.svgOutput - SVG visualization
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generateCuttingPlanPDF({ cuttingPlan, order, company, svgOutput }) {
  let browser;
  let page;
  
  try {
    console.log('[cuttingPlanPdfGenerator] Launching Puppeteer...');
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
    
    // Generate HTML content for the cutting plan
    const htmlContent = generateCuttingPlanHTML({ cuttingPlan, order, company, svgOutput });

    await page.setContent(htmlContent, { 
      waitUntil: 'load',
      timeout: 30000
    });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true, // Landscape for better visualization of cutting plans
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
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
    console.error('Error generating cutting plan PDF:', error);
    
    if (error.name === 'TimeoutError') {
      throw new Error('PDF generation timed out. The cutting plan may be too complex or the server is overloaded.');
    }
    
    if (error.message.includes('Protocol error')) {
      throw new Error('Browser communication error during PDF generation.');
    }
    
    throw new Error('Failed to generate cutting plan PDF');
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
 * Generate HTML content for cutting plan PDF
 * @param {Object} params - Parameters object
 * @returns {string} - HTML content
 */
function generateCuttingPlanHTML({ cuttingPlan, order, company, svgOutput }) {
  const formatDate = (date) => {
    try {
      if (!date) return 'Not specified';
      return new Date(date).toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Not specified';
    }
  };

  const formatWeight = (weight) => {
    try {
      if (!weight) return '0.00';
      const numValue = parseFloat(weight.toString());
      if (isNaN(numValue)) return '0.00';
      return numValue.toFixed(2);
    } catch (error) {
      return '0.00';
    }
  };

  // Calculate totals
  let totalPipes = 0;
  let totalWeight = 0;
  let totalScrap = 0;

  cuttingPlan.materialPlans.forEach(mp => {
    if (mp.pipesUsed) {
      totalPipes += mp.pipesUsed.length;
    }
    if (mp.totalWeight) {
      totalWeight += parseFloat(mp.totalWeight.toString() || '0');
    }
    if (mp.totalPipesPerLength) {
      mp.totalPipesPerLength.forEach(tpl => {
        totalScrap += parseFloat(tpl.totalScrap?.toString() || '0');
      });
    }
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cutting Plan ${order.orderIdDisplay} - ${company.name}</title>
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
          max-width: 297mm;
          min-height: 210mm;
          margin: 0 auto;
          padding: 12mm;
          background: white;
          position: relative;
        }
        
        /* Header Section */
        .header {
          border: 2px solid #1e40af;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 15px;
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
        }
        
        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 15px;
        }
        
        .company-section {
          flex: 1;
          padding-right: 20px;
        }
        
        .cutting-plan-title {
          font-size: 24px;
          font-weight: bold;
          color: #1e40af;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .company-name {
          font-size: 20px;
          font-weight: bold;
          color: #1e40af;
          margin-bottom: 6px;
        }
        
        .company-address {
          font-size: 10px;
          color: #4b5563;
          line-height: 1.3;
          margin-bottom: 6px;
        }
        
        .company-contact {
          font-size: 10px;
          color: #1e40af;
          font-weight: 600;
        }
        
        .order-section {
          flex: 1;
          padding-left: 20px;
          border-left: 2px solid #e2e8f0;
        }
        
        .order-info h3 {
          font-size: 14px;
          font-weight: bold;
          color: #1e40af;
          margin-bottom: 8px;
          border-bottom: 1px solid #1e40af;
          padding-bottom: 2px;
        }
        
        .order-details {
          font-size: 10px;
          line-height: 1.4;
        }
        
        .order-details .label {
          font-weight: 600;
          color: #374151;
        }
        
        .order-details .value {
          color: #4b5563;
          margin-bottom: 3px;
        }
        
        /* Metadata Table */
        .metadata-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          overflow: hidden;
        }
        
        .metadata-table th {
          background: #1e40af;
          color: white;
          padding: 6px 10px;
          text-align: center;
          font-weight: 600;
          font-size: 10px;
        }
        
        .metadata-table td {
          padding: 6px 10px;
          text-align: center;
          border-right: 1px solid #d1d5db;
          font-size: 10px;
          font-weight: 600;
          color: #374151;
        }
        
        .metadata-table td:last-child {
          border-right: none;
        }
        
        /* SVG Visualization Section */
        .visualization-section {
          margin-bottom: 20px;
        }
        
        .section-title {
          font-size: 14px;
          font-weight: bold;
          color: #1e40af;
          margin-bottom: 10px;
          padding-bottom: 3px;
          border-bottom: 2px solid #1e40af;
        }
        
        .svg-container {
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 10px;
          background: #f9fafb;
          text-align: center;
          margin-bottom: 15px;
        }
        
        .svg-container svg {
          max-width: 100%;
          height: auto;
        }
        
        /* Summary Section */
        .summary-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: 15px;
          gap: 15px;
        }
        
        .summary-box {
          flex: 1;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          overflow: hidden;
        }
        
        .summary-header {
          background: #1e40af;
          color: white;
          padding: 8px 10px;
          font-weight: bold;
          font-size: 11px;
          text-align: center;
        }
        
        .summary-content {
          padding: 10px;
          font-size: 10px;
        }
        
        .summary-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
          padding-bottom: 5px;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .summary-item:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        
        .summary-label {
          font-weight: 500;
          color: #374151;
        }
        
        .summary-value {
          font-weight: 600;
          color: #1f2937;
        }
        
        /* Materials Table */
        .materials-section {
          margin-bottom: 15px;
        }
        
        .materials-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          overflow: hidden;
          font-size: 10px;
        }
        
        .materials-table th {
          background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
          color: white;
          padding: 8px 6px;
          text-align: center;
          font-weight: 600;
          font-size: 9px;
          border-right: 1px solid rgba(255,255,255,0.2);
        }
        
        .materials-table th:last-child {
          border-right: none;
        }
        
        .materials-table td {
          padding: 8px 6px;
          border-bottom: 1px solid #e5e7eb;
          border-right: 1px solid #e5e7eb;
          font-size: 9px;
          vertical-align: top;
        }
        
        .materials-table td:last-child {
          border-right: none;
        }
        
        .materials-table tr:nth-child(even) {
          background: #f9fafb;
        }
        
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        
        /* Footer */
        .footer {
          position: absolute;
          bottom: 12mm;
          left: 12mm;
          right: 12mm;
          border-top: 1px solid #e5e7eb;
          padding-top: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 9px;
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
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .status-generated { background: #dbeafe; color: #1d4ed8; }
        .status-committed { background: #d1fae5; color: #065f46; }
        
        @media print {
          .page {
            margin: 0;
            padding: 12mm;
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
              <div class="cutting-plan-title">Cutting Plan</div>
              <div class="company-name">${company.name || 'ConceptBlogging'}</div>
              <div class="company-address">
                ${company.address || '26/14/5, ABBAS VILLA, KOTA WALA BAGH,<br>CHANDNI CHOWK'}
              </div>
              <div class="company-contact">
                Phone: ${company.phone || '08770839318'} | Email: ${company.email || 'mkalang2019@gmail.com'}
              </div>
            </div>
            
            <!-- Order Section -->
            <div class="order-section">
              <div class="order-info">
                <h3>Order Details</h3>
                <div class="order-details">
                  <div><span class="label">Order ID:</span> <span class="value">${order.orderIdDisplay}</span></div>
                  <div><span class="label">Client:</span> <span class="value">${order.clientSnapshot?.clientName || 'N/A'}</span></div>
                  <div><span class="label">Status:</span> <span class="value status-badge status-${cuttingPlan.status?.toLowerCase()}">${cuttingPlan.status}</span></div>
                  <div><span class="label">Order Date:</span> <span class="value">${formatDate(order.createdAt)}</span></div>
                  <div><span class="label">Plan Generated:</span> <span class="value">${formatDate(cuttingPlan.generatedAt)}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Metadata Table -->
        <table class="metadata-table">
          <thead>
            <tr>
              <th>Plan ID</th>
              <th>Generated Date</th>
              <th>Print Date</th>
              <th>Total Materials</th>
              <th>Total Pipes</th>
              <th>Total Weight</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${cuttingPlan._id.toString().slice(-8).toUpperCase()}</td>
              <td>${formatDate(cuttingPlan.generatedAt)}</td>
              <td>${formatDate(new Date())}</td>
              <td>${cuttingPlan.materialPlans?.length || 0}</td>
              <td>${totalPipes}</td>
              <td>${formatWeight(totalWeight)} kg</td>
            </tr>
          </tbody>
        </table>
        
        <!-- SVG Visualization -->
        <div class="visualization-section">
          <div class="section-title">Cutting Plan Visualization</div>
          <div class="svg-container">
            ${svgOutput}
          </div>
        </div>
        
        <!-- Summary Section -->
        <div class="summary-section">
          <div class="summary-box">
            <div class="summary-header">Materials Summary</div>
            <div class="summary-content">
              <div class="summary-item">
                <span class="summary-label">Total Materials:</span>
                <span class="summary-value">${cuttingPlan.materialPlans?.length || 0}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Total Pipes Used:</span>
                <span class="summary-value">${totalPipes}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Total Weight:</span>
                <span class="summary-value">${formatWeight(totalWeight)} kg</span>
              </div>
            </div>
          </div>
          
          <div class="summary-box">
            <div class="summary-header">Waste Summary</div>
            <div class="summary-content">
              <div class="summary-item">
                <span class="summary-label">Total Scrap:</span>
                <span class="summary-value">${formatWeight(totalScrap)} inches</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Efficiency:</span>
                <span class="summary-value">${totalScrap > 0 ? ((1 - totalScrap / (totalScrap + 100)) * 100).toFixed(1) : '100.0'}%</span>
              </div>
            </div>
          </div>
          
          <div class="summary-box">
            <div class="summary-header">Plan Status</div>
            <div class="summary-content">
              <div class="summary-item">
                <span class="summary-label">Status:</span>
                <span class="summary-value">${cuttingPlan.status}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Generated By:</span>
                <span class="summary-value">System</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Order Type:</span>
                <span class="summary-value">Manufacturing</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Materials Details Table -->
        <div class="materials-section">
          <div class="section-title">Material Details</div>
          <table class="materials-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Material Name</th>
                <th>Gauge</th>
                <th>Usage Unit</th>
                <th>Pipes Used</th>
                <th>Total Weight</th>
                <th>Standard Lengths</th>
              </tr>
            </thead>
            <tbody>
              ${cuttingPlan.materialPlans.map((mp, index) => `
                <tr>
                  <td class="text-center">${String(index + 1).padStart(2, '0')}</td>
                  <td class="text-left">${mp.materialNameSnapshot}</td>
                  <td class="text-center">${mp.gaugeSnapshot || 'N/A'}</td>
                  <td class="text-center">${mp.usageUnit}</td>
                  <td class="text-center">${mp.pipesUsed?.length || 0}</td>
                  <td class="text-right">${formatWeight(mp.totalWeight)} kg</td>
                  <td class="text-left">
                    ${mp.totalPipesPerLength?.map(tpl => 
                      `${tpl.quantity}x ${tpl.length}${tpl.unit}`
                    ).join(', ') || 'N/A'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <div class="footer-left">
            ${company.name || 'ConceptBlogging'}
          </div>
          <div class="footer-center">
            Professional Manufacturing | Quality Assured
          </div>
          <div class="footer-right">
            Generated on ${formatDate(new Date())}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  generateCuttingPlanPDF
}; 