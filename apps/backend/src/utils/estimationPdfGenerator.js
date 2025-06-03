const mongoose = require('mongoose');

/**
 * Generate HTML content for estimation PDF
 * @param {Object} estimation - Estimation document
 * @param {Object} company - Company details
 * @returns {string} - HTML content
 */
function generateEstimationHTML(estimation, company) {
  // Enhanced data validation
  if (!estimation) {
    throw new Error('Estimation data is required for PDF generation');
  }
  
  if (!estimation.projectName) {
    throw new Error('Project name is required for PDF generation');
  }

  const formatCurrency = (amount) => {
    try {
      if (amount === null || typeof amount === 'undefined') return '₹0.00';
      const numValue = parseFloat(amount.toString());
      if (isNaN(numValue)) return '₹0.00';
      return `₹${numValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } catch (error) {
      return '₹0.00';
    }
  };
  
  const formatDate = (date) => {
    try {
      if (!date) return 'Not specified';
      return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (error) {
      return 'Not specified';
    }
  };

  const formatDecimal = (value, decimals = 2) => {
    try {
      if (value === null || value === undefined) return '0.00';
      if (typeof value === 'number') return value.toFixed(decimals);
      if (value instanceof mongoose.Types.Decimal128) return parseFloat(value.toString()).toFixed(decimals);
      return parseFloat(value.toString()).toFixed(decimals) || '0.00';
    } catch (error) {
      return '0.00';
    }
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

  // Safe field access with HTML escaping and null checks
  const safeField = (value, defaultValue = '') => {
    try {
      return escapeHtml(value || defaultValue);
    } catch (error) {
      return escapeHtml(defaultValue);
    }
  };

  // Helper function to get logo HTML with validation
  const getLogoHTML = (company) => {
    try {
      if (company && company.logoUrl) {
        const logoPath = company.logoUrl.startsWith('/uploads/') 
          ? `http://localhost:3001${company.logoUrl}` 
          : company.logoUrl;
        return `<img src="${safeField(logoPath)}" alt="Company Logo" class="company-logo" />`;
      }
      return '';
    } catch (error) {
      console.warn('Error processing logo URL:', error);
      return '';
    }
  };

  // Validate required estimation data
  const safeEstimation = {
    projectName: estimation.projectName || 'Unnamed Project',
    dimensionUnitUsed: estimation.dimensionUnitUsed || 'inches',
    status: estimation.status || 'Draft',
    items: estimation.items || [],
    calculatedMaterials: estimation.calculatedMaterials || [],
    manualCharges: estimation.manualCharges || [],
    subtotalMaterials: estimation.subtotalMaterials || '0.00',
    subtotalManualCharges: estimation.subtotalManualCharges || '0.00',
    totalEstimatedCost: estimation.totalEstimatedCost || '0.00',
    markupPercentage: estimation.markupPercentage || '0.00',
    markedUpTotal: estimation.markedUpTotal || '0.00',
    notes: estimation.notes || '',
    createdAt: estimation.createdAt || new Date(),
    updatedAt: estimation.updatedAt || new Date()
  };

  // Validate company data
  const safeCompany = {
    name: company?.name || 'ConceptBlogging',
    address: company?.address || '',
    contactNumber: company?.contactNumber || '',
    email: company?.email || '',
    logoUrl: company?.logoUrl || ''
  };

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Material Estimation - ${safeField(safeEstimation.projectName)} | ${safeField(safeCompany.name)}</title>
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
          padding: 15mm;
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
          border: 2px solid #dc2626;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
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
        
        .estimation-title {
          font-size: 28px;
          font-weight: bold;
          color: #dc2626;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .company-name {
          font-size: 24px;
          font-weight: bold;
          color: #dc2626;
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
          color: #dc2626;
          font-weight: 600;
        }
        
        .project-section {
          flex: 1;
          padding-left: 20px;
          border-left: 2px solid #e2e8f0;
        }
        
        .project-info h3 {
          font-size: 14px;
          font-weight: bold;
          color: #dc2626;
          margin-bottom: 8px;
          border-bottom: 1px solid #dc2626;
          padding-bottom: 2px;
        }
        
        .project-details {
          font-size: 11px;
          line-height: 1.4;
        }
        
        .project-details .label {
          font-weight: 600;
          color: #374151;
        }
        
        .project-details .value {
          color: #4b5563;
          margin-bottom: 3px;
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
          margin-top: 10px;
        }
        
        .status-draft { background: #f3f4f6; color: #374151; }
        .status-calculated { background: #dbeafe; color: #1d4ed8; }
        .status-converted { background: #d1fae5; color: #065f46; }
        .status-archived { background: #fed7aa; color: #ea580c; }
        
        /* Items Section */
        .items-section {
          margin-bottom: 25px;
        }
        
        .section-title {
          font-size: 16px;
          font-weight: bold;
          color: #dc2626;
          margin-bottom: 12px;
          padding-bottom: 5px;
          border-bottom: 2px solid #dc2626;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          margin-bottom: 20px;
        }
        
        .items-table th {
          background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
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
        
        /* Materials Section */
        .materials-section {
          margin-bottom: 25px;
        }
        
        .materials-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          font-size: 10px;
        }
        
        .materials-table th {
          background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%);
          color: white;
          padding: 10px 8px;
          text-align: center;
          font-weight: 600;
          font-size: 9px;
          border-right: 1px solid rgba(255,255,255,0.2);
        }
        
        .materials-table th:last-child {
          border-right: none;
        }
        
        .materials-table td {
          padding: 10px 8px;
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
        
        .pipe-breakdown {
          font-size: 8px;
          color: #6b7280;
          margin-top: 2px;
        }
        
        /* Summary Section */
        .summary-section {
          margin-bottom: 25px;
          display: flex;
          justify-content: flex-end;
        }
        
        .summary-box {
          width: 400px;
          border: 2px solid #dc2626;
          border-radius: 8px;
          overflow: hidden;
        }
        
        .summary-header {
          background: #dc2626;
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
          color: #dc2626;
        }
        
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        
        /* Footer */
        .footer {
          position: absolute;
          bottom: 15mm;
          left: 15mm;
          right: 15mm;
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
          color: #dc2626;
        }
        
        .footer-center {
          text-align: center;
          font-style: italic;
        }
        
        .footer-right {
          text-align: right;
        }
        
        /* Notes Section */
        .notes-section {
          margin-bottom: 20px;
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 6px;
          padding: 12px;
        }
        
        .notes-section h4 {
          font-size: 12px;
          font-weight: bold;
          color: #92400e;
          margin-bottom: 6px;
        }
        
        .notes-content {
          font-size: 11px;
          color: #78350f;
          line-height: 1.4;
        }
        
        @media print {
          .page {
            margin: 0;
            padding: 15mm;
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
              ${getLogoHTML(safeCompany)}
              <div class="estimation-title">Material Estimation</div>
              <div class="company-name">${safeField(safeCompany.name)}</div>
              ${safeCompany.address ? `<div class="company-address">${safeField(safeCompany.address)}</div>` : ''}
              ${safeCompany.contactNumber ? `<div class="company-contact">Phone: ${safeField(safeCompany.contactNumber)}</div>` : ''}
              ${safeCompany.email ? `<div class="company-contact">Email: ${safeField(safeCompany.email)}</div>` : ''}
            </div>
            
            <!-- Project Section -->
            <div class="project-section">
              <div class="project-info">
                <h3>Project Information</h3>
                <div class="project-details">
                  <div><span class="label">Project Name:</span> <span class="value">${safeField(safeEstimation.projectName)}</span></div>
                  ${estimation.clientId && estimation.clientId.clientName ? `
                    <div><span class="label">Client:</span> <span class="value">${safeField(estimation.clientId.clientName)}</span></div>
                    ${estimation.clientId.contactPerson ? `<div><span class="label">Contact Person:</span> <span class="value">${safeField(estimation.clientId.contactPerson)}</span></div>` : ''}
                    ${estimation.clientId.contactNumber ? `<div><span class="label">Contact Number:</span> <span class="value">${safeField(estimation.clientId.contactNumber)}</span></div>` : ''}
                  ` : ''}
                  <div><span class="label">Dimension Unit:</span> <span class="value">${safeField(safeEstimation.dimensionUnitUsed)}</span></div>
                  <div><span class="label">Created:</span> <span class="value">${formatDate(safeEstimation.createdAt)}</span></div>
                  <div><span class="label">Last Updated:</span> <span class="value">${formatDate(safeEstimation.updatedAt)}</span></div>
                </div>
              </div>
              
              <!-- Status Badge -->
              <div style="text-align: right; margin-top: 10px;">
                <span class="status-badge status-${safeEstimation.status.toLowerCase()}">
                  ${safeEstimation.status}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Project Items Section -->
        <div class="items-section">
          <div class="section-title">Project Items</div>
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 8%;">Item #</th>
                <th style="width: 40%;">Product Description</th>
                <th style="width: 20%;">Dimensions<br>(W × H)</th>
                <th style="width: 12%;">Quantity</th>
                <th style="width: 20%;">Label</th>
              </tr>
            </thead>
            <tbody>
              ${safeEstimation.items && safeEstimation.items.length > 0 ? safeEstimation.items.map((item, index) => {
                const productName = item.productTypeId && item.productTypeId.name 
                  ? item.productTypeId.name 
                  : item.productTypeNameSnapshot || 'Unknown Product';
                
                return `
                  <tr>
                    <td class="text-center">${String(index + 1).padStart(2, '0')}</td>
                    <td class="text-left">
                      <div class="item-description">${safeField(productName)}</div>
                    </td>
                    <td class="text-center">
                      ${formatDecimal(item.width)} × ${formatDecimal(item.height)}<br>
                      <span style="font-size: 9px; color: #6b7280;">${safeEstimation.dimensionUnitUsed}</span>
                    </td>
                    <td class="text-center">${item.quantity}</td>
                    <td class="text-left">${safeField(item.itemLabel || '—')}</td>
                  </tr>
                `;
              }).join('') : '<tr><td colspan="5" class="text-center">No items added</td></tr>'}
            </tbody>
          </table>
        </div>
        
        <!-- Material Requirements Section -->
        ${safeEstimation.calculatedMaterials && safeEstimation.calculatedMaterials.length > 0 ? `
          <div class="materials-section">
            <div class="section-title">Material Requirements</div>
            <table class="materials-table">
              <thead>
                <tr>
                  <th style="width: 5%;">#</th>
                  <th style="width: 25%;">Material Name</th>
                  <th style="width: 12%;">Category</th>
                  <th style="width: 15%;">Total Quantity</th>
                  <th style="width: 12%;">Weight</th>
                  <th style="width: 13%;">Rate</th>
                  <th style="width: 18%;">Estimated Cost</th>
                </tr>
              </thead>
              <tbody>
                ${safeEstimation.calculatedMaterials.map((material, index) => {
                  const hasManualRate = material.manualUnitRate && parseFloat(material.manualUnitRate.toString()) > 0;
                  const rate = hasManualRate ? parseFloat(material.manualUnitRate.toString()) : parseFloat(material.autoUnitRate?.toString() || '0');
                  const rateUnit = hasManualRate ? (material.manualRateUnit || material.autoRateUnit) : material.autoRateUnit;
                  
                  return `
                    <tr>
                      <td class="text-center">${String(index + 1).padStart(2, '0')}</td>
                      <td class="text-left">
                        <div style="font-weight: 600;">${safeField(material.materialNameSnapshot)}</div>
                      </td>
                      <td class="text-center">${safeField(material.materialCategorySnapshot)}</td>
                      <td class="text-center">
                        ${material.pipeBreakdown && material.pipeBreakdown.length > 0 ? `
                          ${material.pipeBreakdown.reduce((sum, pipe) => sum + pipe.count, 0)} ${material.pipeBreakdown.map(pipe => 
                            `(${pipe.count} × ${formatDecimal(pipe.length)}${pipe.unit})`
                          ).join('')}<br>
                          ${material.totalWeight && parseFloat(material.totalWeight.toString()) > 0 
                            ? `<span style="font-size: 9px; color: #6b7280;">Weight: ${formatDecimal(material.totalWeight, 2)}${material.weightUnit || 'kg'}</span>` 
                            : ''}
                        ` : `
                          ${formatDecimal(material.totalQuantity)} ${material.quantityUnit}<br>
                          ${material.totalWeight && parseFloat(material.totalWeight.toString()) > 0 
                            ? `<span style="font-size: 9px; color: #6b7280;">Weight: ${formatDecimal(material.totalWeight, 2)}${material.weightUnit || 'kg'}</span>` 
                            : ''}
                        `}
                      </td>
                      <td class="text-center">
                        ${material.totalWeight && parseFloat(material.totalWeight.toString()) > 0 && !material.pipeBreakdown 
                          ? `${formatDecimal(material.totalWeight, 3)} ${material.weightUnit || 'kg'}` 
                          : '—'}
                      </td>
                      <td class="text-center">
                        ${rate > 0 ? `${formatCurrency(rate)} per ${rateUnit}` : '—'}
                        ${hasManualRate ? '<br><span style="font-size: 8px; color: #059669;">(Manual)</span>' : ''}
                      </td>
                      <td class="text-right">
                        <strong>${formatCurrency(material.calculatedCost)}</strong>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
        
        <!-- Manual Charges Section -->
        ${safeEstimation.manualCharges && safeEstimation.manualCharges.length > 0 ? `
          <div class="materials-section">
            <div class="section-title">Additional Charges</div>
            <table class="materials-table">
              <thead>
                <tr>
                  <th style="width: 8%;">#</th>
                  <th style="width: 70%;">Description</th>
                  <th style="width: 22%;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${safeEstimation.manualCharges.map((charge, index) => `
                  <tr>
                    <td class="text-center">${String(index + 1).padStart(2, '0')}</td>
                    <td class="text-left">${safeField(charge.description)}</td>
                    <td class="text-right"><strong>${formatCurrency(charge.amount)}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
        
        <!-- Cost Summary Section -->
        <div class="summary-section">
          <div class="summary-box">
            <div class="summary-header">Cost Summary</div>
            <table class="summary-table">
              <tr>
                <td class="label">Materials Subtotal:</td>
                <td class="value">${formatCurrency(safeEstimation.subtotalMaterials)}</td>
              </tr>
              ${safeEstimation.manualCharges && safeEstimation.manualCharges.length > 0 ? `
                <tr>
                  <td class="label">Additional Charges:</td>
                  <td class="value">${formatCurrency(safeEstimation.subtotalManualCharges)}</td>
                </tr>
              ` : ''}
              <tr>
                <td class="label">Total Estimated Cost:</td>
                <td class="value">${formatCurrency(safeEstimation.totalEstimatedCost)}</td>
              </tr>
              ${safeEstimation.markupPercentage && parseFloat(safeEstimation.markupPercentage.toString()) > 0 ? `
                <tr>
                  <td class="label">Markup (${formatDecimal(safeEstimation.markupPercentage, 1)}%):</td>
                  <td class="value">${formatCurrency(parseFloat(safeEstimation.markedUpTotal?.toString() || '0') - parseFloat(safeEstimation.totalEstimatedCost?.toString() || '0'))}</td>
                </tr>
                <tr class="grand-total">
                  <td class="label">Final Total with Markup:</td>
                  <td class="value">${formatCurrency(safeEstimation.markedUpTotal)}</td>
                </tr>
              ` : `
                <tr class="grand-total">
                  <td class="label">Final Total:</td>
                  <td class="value">${formatCurrency(safeEstimation.totalEstimatedCost)}</td>
                </tr>
              `}
            </table>
          </div>
        </div>
        
        <!-- Notes Section -->
        ${safeEstimation.notes ? `
          <div class="notes-section">
            <h4>Notes & Disclaimers</h4>
            <div class="notes-content">${safeField(safeEstimation.notes)}</div>
          </div>
        ` : `
          <div class="notes-section">
            <h4>Important Notes</h4>
            <div class="notes-content">
              • This is a material estimation for planning purposes only.<br>
              • Actual costs may vary based on final specifications and market rates.<br>
              • Material quantities include standard wastage allowances.<br>
              • Installation costs and additional services are not included unless specified.<br>
              • Prices are subject to change without prior notice.
            </div>
          </div>
        `}
        
        <!-- Footer -->
        <div class="footer">
          <div class="footer-left">
            ${safeField(safeCompany.name)}
          </div>
          <div class="footer-center">
            Material Estimation | For Planning Purposes
          </div>
          <div class="footer-right">
            Generated on ${formatDate(new Date())} | Page 1 of 1
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = { generateEstimationHTML }; 