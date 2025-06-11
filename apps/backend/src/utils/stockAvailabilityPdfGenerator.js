const puppeteer = require('puppeteer');
const path = require('path');

/**
 * Generate Stock Availability Check PDF
 * @param {Object} orderData - Order data
 * @param {Array} stockAvailability - Stock availability results
 * @param {Array} glassRequirements - Glass requirements
 * @param {Object} company - Company data
 * @returns {Buffer} PDF buffer
 */
const generateStockAvailabilityPDF = async (orderData, stockAvailability, glassRequirements, company) => {
    let browser;
    
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process'
            ],
            timeout: 30000
        });

        const page = await browser.newPage();
        
        // Set page size and format
        await page.setViewport({ width: 1200, height: 800 });

        // Helper functions
        const formatDate = (date) => {
            return new Date(date).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: '2-digit'
            });
        };

        const formatStockDetails = (details, materialCategory) => {
            if (!details || details.length === 0) return '—';
            return details.map(detail => {
                // Handle both numeric and string length values
                const lengthDisplay = typeof detail.length === 'number' 
                    ? detail.length.toFixed(2) 
                    : detail.length; // For wire mesh dimensions like "2ft x 3.75ft"
                
                // For profiles, always show count (even for 1 piece) to match estimation pattern
                if (materialCategory === 'Profile') {
                    const countText = detail.count === 1 ? 'piece' : 'pieces';
                    return `${lengthDisplay} ${detail.unit} (${detail.count} ${countText})`;
                }
                // For hardware and wire mesh, only show count when > 1
                else if (detail.count === 1) {
                    // When count is 1, show just "length unit" (e.g., "10 pcs" or "2.5 x 2.33 ft")
                    return `${lengthDisplay} ${detail.unit}`;
                } else {
                    // When count > 1, show "length unit (count pieces)"
                    return `${lengthDisplay} ${detail.unit} (${detail.count} pieces)`;
                }
            }).join(', ');
        };

        const getStatusColor = (status) => {
            switch (status) {
                case 'Sufficient':
                case 'Sufficient (Simplified Check)':
                    return '#10b981'; // green
                case 'Insufficient':
                case 'Insufficient (Simplified Check)':
                    return '#ef4444'; // red
                case 'Material Not Found':
                case 'MaterialV2 Not Found':
                    return '#f59e0b'; // amber
                default:
                    return '#6b7280'; // gray
            }
        };

        const safeField = (value) => {
            if (value === null || value === undefined) return '';
            return String(value).replace(/[<>&"']/g, (match) => {
                const escapeMap = {
                    '<': '&lt;',
                    '>': '&gt;',
                    '&': '&amp;',
                    '"': '&quot;',
                    "'": '&#39;'
                };
                return escapeMap[match];
            });
        };

        // Calculate summary statistics
        const totalMaterials = stockAvailability.length;
        const sufficientMaterials = stockAvailability.filter(s => 
            s.status === 'Sufficient' || s.status === 'Sufficient (Simplified Check)'
        ).length;
        const insufficientMaterials = stockAvailability.filter(s => 
            s.status === 'Insufficient' || s.status === 'Insufficient (Simplified Check)'
        ).length;
        const totalGlassTypes = glassRequirements.length;

        // Generate HTML content
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Stock Availability Check - Order ${safeField(orderData.orderIdDisplay)}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    color: #1f2937;
                    line-height: 1.4;
                    font-size: 12px;
                }
                
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #e5e7eb;
                }
                
                .company-info {
                    flex: 1;
                }
                
                .company-name {
                    font-size: 24px;
                    font-weight: bold;
                    color: #1f2937;
                    margin-bottom: 5px;
                }
                
                .company-details {
                    font-size: 11px;
                    color: #6b7280;
                    line-height: 1.3;
                }
                
                .document-title {
                    text-align: center;
                    flex: 1;
                }
                
                .document-title h1 {
                    font-size: 20px;
                    color: #1f2937;
                    margin: 0;
                }
                
                .document-title p {
                    font-size: 11px;
                    color: #6b7280;
                    margin: 5px 0 0 0;
                }
                
                .order-info {
                    background: #f9fafb;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 25px;
                    border: 1px solid #e5e7eb;
                }
                
                .order-info h2 {
                    margin: 0 0 10px 0;
                    font-size: 14px;
                    color: #374151;
                }
                
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 15px;
                }
                
                .info-item {
                    display: flex;
                    flex-direction: column;
                }
                
                .info-label {
                    font-size: 10px;
                    color: #6b7280;
                    margin-bottom: 2px;
                    text-transform: uppercase;
                    font-weight: 600;
                }
                
                .info-value {
                    font-size: 12px;
                    color: #1f2937;
                    font-weight: 500;
                }
                
                .summary-stats {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 15px;
                    margin-bottom: 25px;
                }
                
                .stat-card {
                    background: white;
                    padding: 15px;
                    border-radius: 8px;
                    text-align: center;
                    border: 2px solid #e5e7eb;
                }
                
                .stat-card.sufficient {
                    border-color: #10b981;
                    background: #ecfdf5;
                }
                
                .stat-card.insufficient {
                    border-color: #ef4444;
                    background: #fef2f2;
                }
                
                .stat-card.total {
                    border-color: #3b82f6;
                    background: #eff6ff;
                }
                
                .stat-card.glass {
                    border-color: #8b5cf6;
                    background: #f5f3ff;
                }
                
                .stat-number {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                
                .stat-label {
                    font-size: 10px;
                    color: #6b7280;
                    text-transform: uppercase;
                    font-weight: 600;
                }
                
                .section {
                    margin-bottom: 30px;
                }
                
                .section-title {
                    font-size: 16px;
                    font-weight: bold;
                    color: #1f2937;
                    margin-bottom: 15px;
                    padding-bottom: 5px;
                    border-bottom: 1px solid #e5e7eb;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    overflow: hidden;
                }
                
                th {
                    background: #f9fafb;
                    padding: 12px 8px;
                    text-align: left;
                    font-weight: 600;
                    color: #374151;
                    font-size: 11px;
                    text-transform: uppercase;
                    border-bottom: 1px solid #e5e7eb;
                }
                
                td {
                    padding: 10px 8px;
                    border-bottom: 1px solid #f3f4f6;
                    font-size: 11px;
                    vertical-align: top;
                }
                
                tr:last-child td {
                    border-bottom: none;
                }
                
                tr:nth-child(even) {
                    background: #f9fafb;
                }
                
                .status-badge {
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 10px;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: white;
                    text-align: center;
                    display: inline-block;
                    min-width: 70px;
                }
                
                .status-sufficient {
                    background: #10b981;
                }
                
                .status-insufficient {
                    background: #ef4444;
                }
                
                .status-not-found {
                    background: #f59e0b;
                }
                
                .status-other {
                    background: #6b7280;
                }
                
                .material-name {
                    font-weight: 600;
                    color: #1f2937;
                }
                
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                    text-align: center;
                    font-size: 10px;
                    color: #6b7280;
                }
                
                .note-box {
                    background: #fef3c7;
                    border: 1px solid #f59e0b;
                    border-radius: 6px;
                    padding: 12px;
                    margin: 15px 0;
                }
                
                .note-title {
                    font-weight: 600;
                    color: #92400e;
                    margin-bottom: 5px;
                    font-size: 11px;
                }
                
                .note-text {
                    color: #92400e;
                    font-size: 10px;
                }
                
                @media print {
                    body { -webkit-print-color-adjust: exact; }
                    .page-break { page-break-before: always; }
                }
            </style>
        </head>
        <body>
            <!-- Header -->
            <div class="header">
                <div class="company-info">
                    <div class="company-name">${safeField(company.name || 'Company Name')}</div>
                    <div class="company-details">
                        ${company.address ? safeField(company.address) + '<br>' : ''}
                        ${company.phone ? 'Phone: ' + safeField(company.phone) + '<br>' : ''}
                        ${company.email ? 'Email: ' + safeField(company.email) : ''}
                    </div>
                </div>
                <div class="document-title">
                    <h1>Stock Availability Check</h1>
                    <p>Manufacturing Readiness Report</p>
                </div>
                <div style="width: 150px;"></div>
            </div>
            
            <!-- Order Information -->
            <div class="order-info">
                <h2>Order Information</h2>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Order ID</div>
                        <div class="info-value">${safeField(orderData.orderIdDisplay)}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Client</div>
                        <div class="info-value">${safeField(orderData.clientSnapshot?.clientName || 'N/A')}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Status</div>
                        <div class="info-value">${safeField(orderData.status)}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Order Date</div>
                        <div class="info-value">${formatDate(orderData.createdAt)}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Check Date</div>
                        <div class="info-value">${formatDate(new Date())}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Total Items</div>
                        <div class="info-value">${orderData.items?.length || 0}</div>
                    </div>
                </div>
            </div>
            
            <!-- Summary Statistics -->
            <div class="summary-stats">
                <div class="stat-card total">
                    <div class="stat-number" style="color: #3b82f6;">${totalMaterials}</div>
                    <div class="stat-label">Total Materials</div>
                </div>
                <div class="stat-card sufficient">
                    <div class="stat-number" style="color: #10b981;">${sufficientMaterials}</div>
                    <div class="stat-label">In Stock</div>
                </div>
                <div class="stat-card insufficient">
                    <div class="stat-number" style="color: #ef4444;">${insufficientMaterials}</div>
                    <div class="stat-label">Insufficient</div>
                </div>
                <div class="stat-card glass">
                    <div class="stat-number" style="color: #8b5cf6;">${totalGlassTypes}</div>
                    <div class="stat-label">Glass Types</div>
                </div>
            </div>
            
            <!-- Stock Availability Section -->
            <div class="section">
                <h2 class="section-title">Material Stock Availability</h2>
                
                ${stockAvailability.length > 0 ? `
                <table>
                    <thead>
                        <tr>
                            <th style="width: 25%;">Material Name</th>
                            <th style="width: 10%;">Category</th>
                            <th style="width: 12%;">Status</th>
                            <th style="width: 18%;">Required</th>
                            <th style="width: 18%;">Available</th>
                            <th style="width: 17%;">Shortfall</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stockAvailability.map(stock => {
                            const statusClass = stock.status.includes('Sufficient') ? 'status-sufficient' : 
                                              stock.status.includes('Insufficient') ? 'status-insufficient' :
                                              stock.status.includes('Not Found') ? 'status-not-found' : 'status-other';
                            
                            return `
                            <tr>
                                <td class="material-name">${safeField(stock.materialName)}</td>
                                <td>${safeField(stock.category || 'N/A')}</td>
                                <td>
                                    <span class="status-badge ${statusClass}">
                                        ${safeField(stock.status)}
                                    </span>
                                </td>
                                <td>${formatStockDetails(stock.requiredCutsDetail, stock.category)}</td>
                                <td>${formatStockDetails(stock.availableStockDetail, stock.category)}</td>
                                <td>${formatStockDetails(stock.shortfallDetail, stock.category)}</td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                ` : `
                <div style="text-align: center; padding: 40px; color: #6b7280;">
                    <p>No stock availability data available.</p>
                    <p style="font-size: 10px; margin-top: 10px;">Stock check needs to be performed to see material availability.</p>
                </div>
                `}
            </div>
            
            <!-- Glass Requirements Section -->
            ${glassRequirements.length > 0 ? `
            <div class="section">
                <h2 class="section-title">Glass Requirements</h2>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 15%;">Window #</th>
                            <th style="width: 35%;">Glass Type</th>
                            <th style="width: 15%;">Width</th>
                            <th style="width: 15%;">Height</th>
                            <th style="width: 20%;">Total Pieces</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${glassRequirements.map(glass => `
                        <tr>
                            <td style="text-align: center; font-weight: 600;">${glass.itemNumber}</td>
                            <td class="material-name">${safeField(glass.material)}</td>
                            <td>${glass.width} ${glass.widthUnit}</td>
                            <td>${glass.height} ${glass.heightUnit}</td>
                            <td style="text-align: center; font-weight: 600;">${glass.totalGlassPieces}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}
            
            <!-- Notes Section -->
            <div class="note-box">
                <div class="note-title">Important Notes:</div>
                <div class="note-text">
                    • This report shows material and glass availability at the time of generation.<br>
                    • Stock levels may change due to ongoing production and incoming deliveries.<br>
                    • Materials marked as "Insufficient" need to be ordered before manufacturing can proceed.<br>
                    • Glass requirements are calculated based on product specifications and item dimensions.<br>
                    • Contact procurement team for materials showing shortfall before starting production.
                </div>
            </div>
            
            <!-- Footer -->
            <div class="footer">
                <p>Stock Availability Check Report • Generated on ${formatDate(new Date())} • ${safeField(company.name || 'Company')}</p>
                <p style="margin-top: 5px;">This document is for internal manufacturing planning purposes only.</p>
            </div>
        </body>
        </html>
        `;

        // Set HTML content
        await page.setContent(htmlContent, { 
            waitUntil: 'networkidle0',
            timeout: 15000 
        });

        // Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: {
                top: '15mm',
                right: '10mm',
                bottom: '15mm',
                left: '10mm'
            },
            printBackground: true,
            timeout: 15000
        });

        return pdfBuffer;

    } catch (error) {
        console.error('Error generating stock availability PDF:', error);
        throw new Error(`PDF generation failed: ${error.message}`);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};

module.exports = { generateStockAvailabilityPDF }; 