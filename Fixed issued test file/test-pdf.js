console.log('<<< TOP OF test-pdf.js >>>');

const fs = require('fs');
const path = require('path');

console.log('Attempting to require pdfGenerator.js...');
const { generateQuotationPDF } = require('./src/utils/pdfGenerator');
console.log('Successfully required pdfGenerator.js.');


// Sample quotation data for testing
const sampleQuotation = {
  quotationIdDisplay: 'QT-2024-001',
  status: 'Draft',
  createdAt: new Date(),
  dimensionUnit: 'feet',
  areaUnit: 'sq feet',
  clientSnapshot: {
    clientName: 'Test Client Ltd.',
    contactPerson: 'John Doe',
    contactNumber: '+91 9876543210',
    email: 'john@testclient.com',
    billingAddress: '123 Test Street, Test City, 123456',
    gstin: '29GGGGG1314R9Z6'
  },
  items: [
    {
      productTypeNameSnapshot: 'Aluminum Window',
      itemLabel: 'Living Room Window',
      width: 4.5,
      height: 3.0,
      quantity: 2,
      totalChargeableArea: 27.0,
      pricePerAreaUnit: 150.00,
      itemSubtotal: 4050.00
    },
    {
      productTypeNameSnapshot: 'Aluminum Door',
      itemLabel: 'Main Entrance Door',
      width: 3.0,
      height: 7.0,
      quantity: 1,
      totalChargeableArea: 21.0,
      pricePerAreaUnit: 200.00,
      itemSubtotal: 4200.00
    }
  ],
  subtotal: 8250.00,
  charges: [
    {
      description: 'Installation Charges',
      amount: 500.00
    }
  ],
  discount: {
    type: 'fixed',
    value: 250.00
  },
  grandTotal: 8500.00,
  notes: 'This is a test quotation for PDF generation validation.',
  termsAndConditions: 'Payment terms: 50% advance, 50% on completion.\nDelivery: 15-20 working days.',
  validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
};

// Sample company data
const sampleCompany = {
  name: 'Test Aluminum Works',
  address: '456 Business Park, Industrial Area, Mumbai - 400001',
  phone: '+91 9123456789',
  email: 'info@testaluminum.com'
};

async function testPDFGeneration() {
  console.log('Inside testPDFGeneration() function - before try block.');
  try {
    console.log(`Executing test-pdf.js - Run ID: ${new Date().toISOString()}`);
    console.log('Starting PDF generation test with REAL generateQuotationPDF call...');
    
    console.log('About to call REAL generateQuotationPDF...');
    let pdfBuffer;
    try {
      pdfBuffer = await generateQuotationPDF(sampleQuotation, sampleCompany);
      console.log(`REAL generateQuotationPDF returned. Type: ${typeof pdfBuffer}, Length: ${pdfBuffer ? pdfBuffer.length : 'N/A'}`);
    } catch (pdfGenError) {
      console.error('Error: generateQuotationPDF call failed:', pdfGenError.message);
      console.error('Full error:', pdfGenError);
      return;
    }
    
    if (!pdfBuffer || pdfBuffer.length === 0) {
      console.error('Error: pdfBuffer is null, undefined, or empty. Skipping save.');
      return;
    }
    
    console.log(`PDF generated successfully. Buffer size: ${pdfBuffer.length} bytes`);
    
    // Verify PDF header
    const pdfHeader = pdfBuffer.toString('ascii', 0, 4);
    if (pdfHeader === '%PDF') {
      console.log('✅ PDF header validation passed');
    } else {
      console.log('❌ PDF header validation failed:', pdfHeader);
      return;
    }
    
    // Save to file for manual inspection
    const outputPath = path.join(__dirname, 'test-quotation.pdf');
    console.log(`Attempting to save PDF to: ${outputPath}`);
    try {
      fs.writeFileSync(outputPath, pdfBuffer);
      console.log(`✅ Test PDF saved successfully to: ${outputPath}`);
    } catch (writeError) {
      console.error(`❌ Error writing PDF to file: ${outputPath}`, writeError.message);
      console.error('Full write error:', writeError);
      return;
    }
    
    // Check file size
    const stats = fs.statSync(outputPath);
    console.log(`File size: ${stats.size} bytes`);
    
    if (stats.size > 1000) { // Should be at least 1KB for a valid PDF
      console.log('✅ PDF generation test completed successfully!');
    } else {
      console.log('❌ Generated PDF seems too small, might be corrupted');
    }
    
  } catch (error) {
    console.error('❌ PDF generation test failed:', error.message);
    console.error('Full error:', error);
  }
}

async function runTest() {
  console.log('--- Inside runTest() ---');
  await testPDFGeneration();
  console.log('--- Finished testPDFGeneration() call ---');
}

// Run the test
runTest().then(() => {
  console.log('<<< runTest() completed >>>');
}).catch(err => {
  console.error('<<< runTest() failed with error >>>', err);
});

console.log('<<< BOTTOM OF test-pdf.js >>>'); 