/**
 * PDF Download utilities for handling blob validation and download
 * Based on fix for "Failed to load PDF document" issue
 */

/**
 * Validate if a blob is a valid PDF using binary validation
 * @param blob - The blob to validate
 * @returns Promise<boolean> - True if valid PDF
 */
export const isValidPDFBlob = async (blob: Blob): Promise<boolean> => {
  if (!blob || blob.size === 0) {
    console.error('PDF Validation: Blob is null or empty');
    return false;
  }

  // Quick check: if MIME type is application/pdf, it's likely valid
  if (blob.type === 'application/pdf') {
    return true;
  }

  // If MIME type is text/html, application/json, or text/plain, it's likely an error response
  if (blob.type === 'text/html' || blob.type === 'application/json' || blob.type === 'text/plain') {
    try {
      const text = await blob.text();
      const trimmedText = text.trim();
      
      // Check if it's JSON (error response)
      if (trimmedText.startsWith('{') || trimmedText.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmedText);
          console.error('PDF Validation: Received JSON response instead of PDF:', parsed);
          return false;
        } catch {
          // Not JSON, continue validation
        }
      }
      
      // Check if it's HTML (error page)
      if (trimmedText.startsWith('<!DOCTYPE') || trimmedText.startsWith('<html')) {
        console.error('PDF Validation: Received HTML response instead of PDF');
        return false;
      }
    } catch (error) {
      console.error('PDF Validation: Error reading blob as text:', error);
    }
  }

  // Check PDF magic numbers (binary validation)
  try {
    const arrayBuffer = await blob.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // PDF files start with "%PDF"
    if (bytes.length >= 4 && 
        bytes[0] === 0x25 && // %
        bytes[1] === 0x50 && // P
        bytes[2] === 0x44 && // D
        bytes[3] === 0x46) { // F
      return true;
    }
    
    console.error('PDF Validation: Invalid PDF magic numbers', Array.from(bytes.slice(0, 8)));
    return false;
  } catch (error) {
    console.error('PDF Validation: Error reading blob binary data:', error);
    return false;
  }
};

/**
 * Download PDF with multiple fallback methods
 * @param blob - PDF blob to download
 * @param filename - Filename for download
 */
export const downloadPDF = async (blob: Blob, filename: string): Promise<void> => {
  try {
    // Validate the blob before proceeding
    const isValid = await isValidPDFBlob(blob);
    if (!isValid) {
      throw new Error('Invalid PDF file received from server');
    }

    console.log(`PDF Download: Starting download of ${filename} (${blob.size} bytes)`);

    // Method 1: Try using the download attribute (works in most modern browsers)
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
      
      console.log('PDF Download: Successfully downloaded using method 1');
      return;
    } catch (downloadError) {
      console.warn('PDF Download: Method 1 failed, trying method 2:', downloadError);
      
      // Method 2: Fallback - try opening in new window
      try {
        const url = URL.createObjectURL(blob);
        const newWindow = window.open(url, '_blank');
        
        if (!newWindow) {
          throw new Error('Popup blocked - please allow popups for this site');
        }
        
        // Clean up after a delay
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 10000);
        
        console.log('PDF Download: Successfully opened using method 2');
        return;
      } catch (windowError) {
        console.error('PDF Download: Method 2 failed:', windowError);
        throw new Error('Unable to download or display PDF. Please check your browser settings.');
      }
    }
  } catch (error) {
    console.error('PDF Download: All methods failed:', error);
    throw error;
  }
};

/**
 * Enhanced PDF generation and download
 * @param generateFn - Function that returns a Promise<Blob>
 * @param filename - Filename for download  
 */
export const generateAndDownloadPDF = async (
  generateFn: () => Promise<Blob>,
  filename: string
): Promise<void> => {
  try {
    console.log(`PDF Generation: Starting generation of ${filename}`);
    const blob = await generateFn();
    
    if (!blob || blob.size === 0) {
      throw new Error('Generated PDF is empty - server may have returned an error');
    }

    console.log(`PDF Generation: Received blob of ${blob.size} bytes, type: ${blob.type}`);
    await downloadPDF(blob, filename);
    console.log(`PDF Generation: Successfully completed for ${filename}`);
  } catch (error) {
    console.error('PDF Generation: Failed:', error);
    throw error;
  }
};

/**
 * Debug function to log blob details
 * @param blob - Blob to inspect
 * @param label - Label for logging
 */
export const debugBlob = async (blob: Blob, label: string = 'Blob'): Promise<void> => {
  try {
    console.group(`${label} Debug Info`);
    console.log('Size:', blob.size, 'bytes');
    console.log('Type:', blob.type);
    
    if (blob.size > 0) {
      // Read first 16 bytes to check PDF header
      const arrayBuffer = await blob.slice(0, 16).arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      console.log('First 16 bytes:', Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
      
      // Check if it starts with PDF magic
      if (bytes.length >= 4) {
        const pdfMagic = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
        console.log('PDF Magic Found:', pdfMagic);
      }
      
      // If small blob, check if it's text (error response)
      if (blob.size < 10000) {
        try {
          const text = await blob.text();
          if (text.length < 1000) {
            console.log('Blob content (first 1000 chars):', text.substring(0, 1000));
          }
        } catch (textError) {
          console.log('Cannot read as text:', textError);
        }
      }
    }
    
    console.groupEnd();
  } catch (error) {
    console.error(`${label} Debug failed:`, error);
  }
}; 