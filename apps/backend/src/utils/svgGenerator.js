/**
 * SVG Generator for Window/Door Visualizations
 * Generates SVG representations of aluminium windows and doors based on product types and dimensions
 */

/**
 * Convert dimensions to standardized units (pixels for SVG)
 * @param {number} value - The dimension value
 * @param {string} unit - The unit ('inches', 'mm', 'ft', 'm')
 * @param {number} scale - Scale factor for SVG display (default: 10 pixels per inch)
 * @returns {number} - Value in pixels
 */
function convertToPixels(value, unit, scale = 10) {
    switch (unit) {
        case 'inches':
            return value * scale;
        case 'mm':
            return (value / 25.4) * scale; // Convert mm to inches, then to pixels
        case 'ft':
            return value * 12 * scale; // Convert ft to inches, then to pixels
        case 'm':
            return (value * 39.3701) * scale; // Convert m to inches, then to pixels
        default:
            return value * scale;
    }
}

/**
 * Generate SVG for a sliding window (2-track, 3-track, etc.)
 * @param {number} width - Width in specified unit
 * @param {number} height - Height in specified unit
 * @param {string} unit - Dimension unit
 * @param {number} tracks - Number of tracks (default: 2)
 * @returns {string} - SVG string
 */
function generateSlidingWindowSVG(width, height, unit, tracks = 2, prompt = '') {
    const pixelWidth = convertToPixels(width, unit);
    const pixelHeight = convertToPixels(height, unit);
    const frameThickness = 8;
    const glassInset = 4;
    
    let svg = `<svg width="${pixelWidth + 20}" height="${pixelHeight + 40}" viewBox="0 0 ${pixelWidth + 20} ${pixelHeight + 40}" xmlns="http://www.w3.org/2000/svg">`;
    
    // Background
    svg += `<rect width="${pixelWidth + 20}" height="${pixelHeight + 40}" fill="#f8f9fa"/>`;
    
    // Main frame
    svg += `<rect x="10" y="20" width="${pixelWidth}" height="${pixelHeight}" fill="#8b9dc3" stroke="#4a5568" stroke-width="2"/>`;
    
    // Inner frame cavity
    svg += `<rect x="${10 + frameThickness}" y="${20 + frameThickness}" width="${pixelWidth - 2*frameThickness}" height="${pixelHeight - 2*frameThickness}" fill="#e2e8f0"/>`;
    
    // Generate sliding panels based on tracks
    const panelWidth = (pixelWidth - 2*frameThickness) / tracks;
    
    for (let i = 0; i < tracks; i++) {
        const panelX = 10 + frameThickness + (i * panelWidth);
        const panelY = 20 + frameThickness;
        
        // Panel frame
        svg += `<rect x="${panelX + 2}" y="${panelY + 2}" width="${panelWidth - 4}" height="${pixelHeight - 2*frameThickness - 4}" fill="#a0aec0" stroke="#4a5568" stroke-width="1"/>`;
        
        // Determine if this panel should be mesh with smarter detection
        let isMeshPanel = false;
        if (tracks === 3 && prompt.toLowerCase().includes('mesh')) {
            // Default: first panel is mesh (current behavior)
            // But in future could analyze prompt for "2 glass + 1 mesh" patterns
            isMeshPanel = (i === 0);
        }
        
        if (isMeshPanel) {
            // Mesh panel with white background
            const meshX = panelX + 2 + glassInset;
            const meshY = panelY + 2 + glassInset;
            const meshW = panelWidth - 4 - 2*glassInset;
            const meshH = pixelHeight - 2*frameThickness - 4 - 2*glassInset;
            
            svg += `<rect x="${meshX}" y="${meshY}" width="${meshW}" height="${meshH}" fill="#ffffff" stroke="#64748b" stroke-width="1"/>`;
            
            // Add grid/cross-hatch pattern like in reference images
            const gridSize = 8; // Smaller grid for finer mesh pattern
            
            // Vertical lines
            for (let x = meshX; x <= meshX + meshW; x += gridSize) {
                svg += `<line x1="${x}" y1="${meshY}" x2="${x}" y2="${meshY + meshH}" stroke="#999999" stroke-width="0.5" opacity="0.8"/>`;
            }
            
            // Horizontal lines
            for (let y = meshY; y <= meshY + meshH; y += gridSize) {
                svg += `<line x1="${meshX}" y1="${y}" x2="${meshX + meshW}" y2="${y}" stroke="#999999" stroke-width="0.5" opacity="0.8"/>`;
            }
        } else {
            // Glass panel with glass indicators
            const glassX = panelX + 2 + glassInset;
            const glassY = panelY + 2 + glassInset;
            const glassW = panelWidth - 4 - 2*glassInset;
            const glassH = pixelHeight - 2*frameThickness - 4 - 2*glassInset;
            
            svg += `<rect x="${glassX}" y="${glassY}" width="${glassW}" height="${glassH}" fill="#e6fffa" stroke="#81c9c6" stroke-width="1" opacity="0.7"/>`;
            
            // Add glass indicators (small diagonal lines) 
            const centerX = glassX + glassW/2;
            const centerY = glassY + glassH/2;
            svg += `<line x1="${centerX - 15}" y1="${centerY - 15}" x2="${centerX - 5}" y2="${centerY - 5}" stroke="#2d3748" stroke-width="1" opacity="0.6"/>`;
            svg += `<line x1="${centerX + 5}" y1="${centerY - 15}" x2="${centerX + 15}" y2="${centerY - 5}" stroke="#2d3748" stroke-width="1" opacity="0.6"/>`;
        }
        
        // Handle
        const handleX = panelX + panelWidth - 20;
        const handleY = panelY + (pixelHeight - 2*frameThickness) / 2;
        svg += `<circle cx="${handleX}" cy="${handleY}" r="4" fill="#2d3748"/>`;
    }
    
    // Dimensions text
    svg += `<text x="${pixelWidth/2 + 10}" y="15" text-anchor="middle" font-family="Arial" font-size="12" fill="#2d3748">${width} ${unit}</text>`;
    svg += `<text x="5" y="${pixelHeight/2 + 20}" text-anchor="middle" font-family="Arial" font-size="12" fill="#2d3748" transform="rotate(-90, 5, ${pixelHeight/2 + 20})">${height} ${unit}</text>`;
    
    // Product type label
    svg += `<text x="${pixelWidth/2 + 10}" y="${pixelHeight + 35}" text-anchor="middle" font-family="Arial" font-size="10" fill="#4a5568">${tracks === 3 && prompt.toLowerCase().includes('mesh') ? `3-Track Sliding Window (2 Glass + 1 Mesh)` : `${tracks}-Track Sliding Window`}</text>`;
    
    svg += '</svg>';
    return svg;
}

/**
 * Generate SVG for a casement window
 * @param {number} width - Width in specified unit
 * @param {number} height - Height in specified unit
 * @param {string} unit - Dimension unit
 * @param {string} openingType - 'single' or 'double'
 * @returns {string} - SVG string
 */
function generateCasementWindowSVG(width, height, unit, openingType = 'single') {
    const pixelWidth = convertToPixels(width, unit);
    const pixelHeight = convertToPixels(height, unit);
    const frameThickness = 8;
    const glassInset = 4;
    
    let svg = `<svg width="${pixelWidth + 20}" height="${pixelHeight + 40}" viewBox="0 0 ${pixelWidth + 20} ${pixelHeight + 40}" xmlns="http://www.w3.org/2000/svg">`;
    
    // Background
    svg += `<rect width="${pixelWidth + 20}" height="${pixelHeight + 40}" fill="#f8f9fa"/>`;
    
    // Main frame
    svg += `<rect x="10" y="20" width="${pixelWidth}" height="${pixelHeight}" fill="#8b9dc3" stroke="#4a5568" stroke-width="2"/>`;
    
    if (openingType === 'double') {
        // Double casement - two panels
        const panelWidth = (pixelWidth - 3*frameThickness) / 2;
        
        // Left panel
        svg += `<rect x="${10 + frameThickness}" y="${20 + frameThickness}" width="${panelWidth}" height="${pixelHeight - 2*frameThickness}" fill="#a0aec0" stroke="#4a5568" stroke-width="1"/>`;
        svg += `<rect x="${10 + frameThickness + glassInset}" y="${20 + frameThickness + glassInset}" width="${panelWidth - 2*glassInset}" height="${pixelHeight - 2*frameThickness - 2*glassInset}" fill="${(tracks === 3 && i === 0 && prompt.includes('mesh')) ? '#f0f9ff' : '#e6fffa'}" stroke="${(tracks === 3 && i === 0 && prompt.includes('mesh')) ? '#64748b' : '#81c9c6'}" stroke-width="1" opacity="0.7"/>`;
        
        // Center mullion
        svg += `<rect x="${10 + frameThickness + panelWidth}" y="${20 + frameThickness}" width="${frameThickness}" height="${pixelHeight - 2*frameThickness}" fill="#8b9dc3"/>`;
        
        // Right panel
        svg += `<rect x="${10 + 2*frameThickness + panelWidth}" y="${20 + frameThickness}" width="${panelWidth}" height="${pixelHeight - 2*frameThickness}" fill="#a0aec0" stroke="#4a5568" stroke-width="1"/>`;
        svg += `<rect x="${10 + 2*frameThickness + panelWidth + glassInset}" y="${20 + frameThickness + glassInset}" width="${panelWidth - 2*glassInset}" height="${pixelHeight - 2*frameThickness - 2*glassInset}" fill="${(tracks === 3 && i === 0 && prompt.includes('mesh')) ? '#f0f9ff' : '#e6fffa'}" stroke="${(tracks === 3 && i === 0 && prompt.includes('mesh')) ? '#64748b' : '#81c9c6'}" stroke-width="1" opacity="0.7"/>`;
        
        // Handles
        svg += `<circle cx="${10 + frameThickness + 15}" cy="${20 + frameThickness + 30}" r="3" fill="#2d3748"/>`;
        svg += `<circle cx="${10 + 2*frameThickness + panelWidth + panelWidth - 15}" cy="${20 + frameThickness + 30}" r="3" fill="#2d3748"/>`;
        
        // Hinges
        svg += `<rect x="${10 + frameThickness - 2}" y="${20 + frameThickness + 20}" width="4" height="8" fill="#2d3748"/>`;
        svg += `<rect x="${10 + frameThickness - 2}" y="${20 + pixelHeight - frameThickness - 28}" width="4" height="8" fill="#2d3748"/>`;
        svg += `<rect x="${10 + 2*frameThickness + 2*panelWidth + 2}" y="${20 + frameThickness + 20}" width="4" height="8" fill="#2d3748"/>`;
        svg += `<rect x="${10 + 2*frameThickness + 2*panelWidth + 2}" y="${20 + pixelHeight - frameThickness - 28}" width="4" height="8" fill="#2d3748"/>`;
    } else {
        // Single casement
        svg += `<rect x="${10 + frameThickness}" y="${20 + frameThickness}" width="${pixelWidth - 2*frameThickness}" height="${pixelHeight - 2*frameThickness}" fill="#a0aec0" stroke="#4a5568" stroke-width="1"/>`;
        svg += `<rect x="${10 + frameThickness + glassInset}" y="${20 + frameThickness + glassInset}" width="${pixelWidth - 2*frameThickness - 2*glassInset}" height="${pixelHeight - 2*frameThickness - 2*glassInset}" fill="${(tracks === 3 && i === 0 && prompt.includes('mesh')) ? '#f0f9ff' : '#e6fffa'}" stroke="${(tracks === 3 && i === 0 && prompt.includes('mesh')) ? '#64748b' : '#81c9c6'}" stroke-width="1" opacity="0.7"/>`;
        
        // Handle
        svg += `<circle cx="${10 + frameThickness + 15}" cy="${20 + frameThickness + 30}" r="3" fill="#2d3748"/>`;
        
        // Hinges
        svg += `<rect x="${10 + frameThickness - 2}" y="${20 + frameThickness + 20}" width="4" height="8" fill="#2d3748"/>`;
        svg += `<rect x="${10 + frameThickness - 2}" y="${20 + pixelHeight - frameThickness - 28}" width="4" height="8" fill="#2d3748"/>`;
    }
    
    // Dimensions text
    svg += `<text x="${pixelWidth/2 + 10}" y="15" text-anchor="middle" font-family="Arial" font-size="12" fill="#2d3748">${width} ${unit}</text>`;
    svg += `<text x="5" y="${pixelHeight/2 + 20}" text-anchor="middle" font-family="Arial" font-size="12" fill="#2d3748" transform="rotate(-90, 5, ${pixelHeight/2 + 20})">${height} ${unit}</text>`;
    
    // Product type label
    svg += `<text x="${pixelWidth/2 + 10}" y="${pixelHeight + 35}" text-anchor="middle" font-family="Arial" font-size="10" fill="#4a5568">${openingType === 'double' ? 'Double' : 'Single'} Casement Window</text>`;
    
    svg += '</svg>';
    return svg;
}

/**
 * Generate SVG for a fixed window
 * @param {number} width - Width in specified unit
 * @param {number} height - Height in specified unit
 * @param {string} unit - Dimension unit
 * @returns {string} - SVG string
 */
function generateFixedWindowSVG(width, height, unit) {
    const pixelWidth = convertToPixels(width, unit);
    const pixelHeight = convertToPixels(height, unit);
    const frameThickness = 8;
    const glassInset = 4;
    
    let svg = `<svg width="${pixelWidth + 20}" height="${pixelHeight + 40}" viewBox="0 0 ${pixelWidth + 20} ${pixelHeight + 40}" xmlns="http://www.w3.org/2000/svg">`;
    
    // Background
    svg += `<rect width="${pixelWidth + 20}" height="${pixelHeight + 40}" fill="#f8f9fa"/>`;
    
    // Main frame
    svg += `<rect x="10" y="20" width="${pixelWidth}" height="${pixelHeight}" fill="#8b9dc3" stroke="#4a5568" stroke-width="2"/>`;
    
    // Glass area
    svg += `<rect x="${10 + frameThickness}" y="${20 + frameThickness}" width="${pixelWidth - 2*frameThickness}" height="${pixelHeight - 2*frameThickness}" fill="${(tracks === 3 && i === 0 && prompt.includes('mesh')) ? '#f0f9ff' : '#e6fffa'}" stroke="${(tracks === 3 && i === 0 && prompt.includes('mesh')) ? '#64748b' : '#81c9c6'}" stroke-width="1" opacity="0.7"/>`;
    
    // Glazing beads (decorative)
    svg += `<rect x="${10 + frameThickness + glassInset}" y="${20 + frameThickness + glassInset}" width="${pixelWidth - 2*frameThickness - 2*glassInset}" height="${pixelHeight - 2*frameThickness - 2*glassInset}" fill="none" stroke="#a0aec0" stroke-width="1"/>`;
    
    // Dimensions text
    svg += `<text x="${pixelWidth/2 + 10}" y="15" text-anchor="middle" font-family="Arial" font-size="12" fill="#2d3748">${width} ${unit}</text>`;
    svg += `<text x="5" y="${pixelHeight/2 + 20}" text-anchor="middle" font-family="Arial" font-size="12" fill="#2d3748" transform="rotate(-90, 5, ${pixelHeight/2 + 20})">${height} ${unit}</text>`;
    
    // Product type label
    svg += `<text x="${pixelWidth/2 + 10}" y="${pixelHeight + 35}" text-anchor="middle" font-family="Arial" font-size="10" fill="#4a5568">Fixed Window</text>`;
    
    svg += '</svg>';
    return svg;
}

/**
 * Generate SVG for a door
 * @param {number} width - Width in specified unit
 * @param {number} height - Height in specified unit
 * @param {string} unit - Dimension unit
 * @param {string} doorType - 'single' or 'double'
 * @returns {string} - SVG string
 */
function generateDoorSVG(width, height, unit, doorType = 'single') {
    const pixelWidth = convertToPixels(width, unit);
    const pixelHeight = convertToPixels(height, unit);
    const frameThickness = 8;
    const glassInset = 4;
    
    let svg = `<svg width="${pixelWidth + 20}" height="${pixelHeight + 40}" viewBox="0 0 ${pixelWidth + 20} ${pixelHeight + 40}" xmlns="http://www.w3.org/2000/svg">`;
    
    // Background
    svg += `<rect width="${pixelWidth + 20}" height="${pixelHeight + 40}" fill="#f8f9fa"/>`;
    
    // Main frame
    svg += `<rect x="10" y="20" width="${pixelWidth}" height="${pixelHeight}" fill="#8b9dc3" stroke="#4a5568" stroke-width="2"/>`;
    
    // Floor/threshold
    svg += `<rect x="10" y="${20 + pixelHeight - 10}" width="${pixelWidth}" height="10" fill="#6b7280"/>`;
    
    if (doorType === 'double') {
        // Double door - two panels
        const panelWidth = (pixelWidth - 3*frameThickness) / 2;
        
        // Left panel
        svg += `<rect x="${10 + frameThickness}" y="${20 + frameThickness}" width="${panelWidth}" height="${pixelHeight - 2*frameThickness}" fill="#a0aec0" stroke="#4a5568" stroke-width="1"/>`;
        
        // Glass area in left panel (upper portion)
        const glassHeight = (pixelHeight - 2*frameThickness) * 0.6;
        svg += `<rect x="${10 + frameThickness + glassInset}" y="${20 + frameThickness + glassInset}" width="${panelWidth - 2*glassInset}" height="${glassHeight - glassInset}" fill="${(tracks === 3 && i === 0 && prompt.includes('mesh')) ? '#f0f9ff' : '#e6fffa'}" stroke="${(tracks === 3 && i === 0 && prompt.includes('mesh')) ? '#64748b' : '#81c9c6'}" stroke-width="1" opacity="0.7"/>`;
        
        // Center mullion
        svg += `<rect x="${10 + frameThickness + panelWidth}" y="${20 + frameThickness}" width="${frameThickness}" height="${pixelHeight - 2*frameThickness}" fill="#8b9dc3"/>`;
        
        // Right panel
        svg += `<rect x="${10 + 2*frameThickness + panelWidth}" y="${20 + frameThickness}" width="${panelWidth}" height="${pixelHeight - 2*frameThickness}" fill="#a0aec0" stroke="#4a5568" stroke-width="1"/>`;
        
        // Glass area in right panel (upper portion)
        svg += `<rect x="${10 + 2*frameThickness + panelWidth + glassInset}" y="${20 + frameThickness + glassInset}" width="${panelWidth - 2*glassInset}" height="${glassHeight - glassInset}" fill="${(tracks === 3 && i === 0 && prompt.includes('mesh')) ? '#f0f9ff' : '#e6fffa'}" stroke="${(tracks === 3 && i === 0 && prompt.includes('mesh')) ? '#64748b' : '#81c9c6'}" stroke-width="1" opacity="0.7"/>`;
        
        // Handles
        svg += `<circle cx="${10 + frameThickness + 15}" cy="${20 + frameThickness + pixelHeight/3}" r="4" fill="#2d3748"/>`;
        svg += `<circle cx="${10 + 2*frameThickness + panelWidth + panelWidth - 15}" cy="${20 + frameThickness + pixelHeight/3}" r="4" fill="#2d3748"/>`;
        
        // Hinges
        svg += `<rect x="${10 + frameThickness - 2}" y="${20 + frameThickness + 20}" width="4" height="12" fill="#2d3748"/>`;
        svg += `<rect x="${10 + frameThickness - 2}" y="${20 + pixelHeight - frameThickness - 32}" width="4" height="12" fill="#2d3748"/>`;
        svg += `<rect x="${10 + 2*frameThickness + 2*panelWidth + 2}" y="${20 + frameThickness + 20}" width="4" height="12" fill="#2d3748"/>`;
        svg += `<rect x="${10 + 2*frameThickness + 2*panelWidth + 2}" y="${20 + pixelHeight - frameThickness - 32}" width="4" height="12" fill="#2d3748"/>`;
    } else {
        // Single door
        svg += `<rect x="${10 + frameThickness}" y="${20 + frameThickness}" width="${pixelWidth - 2*frameThickness}" height="${pixelHeight - 2*frameThickness}" fill="#a0aec0" stroke="#4a5568" stroke-width="1"/>`;
        
        // Glass area (upper portion)
        const glassHeight = (pixelHeight - 2*frameThickness) * 0.6;
        svg += `<rect x="${10 + frameThickness + glassInset}" y="${20 + frameThickness + glassInset}" width="${pixelWidth - 2*frameThickness - 2*glassInset}" height="${glassHeight - glassInset}" fill="${(tracks === 3 && i === 0 && prompt.includes('mesh')) ? '#f0f9ff' : '#e6fffa'}" stroke="${(tracks === 3 && i === 0 && prompt.includes('mesh')) ? '#64748b' : '#81c9c6'}" stroke-width="1" opacity="0.7"/>`;
        
        // Handle
        svg += `<circle cx="${10 + frameThickness + 15}" cy="${20 + frameThickness + pixelHeight/3}" r="4" fill="#2d3748"/>`;
        
        // Hinges
        svg += `<rect x="${10 + frameThickness - 2}" y="${20 + frameThickness + 20}" width="4" height="12" fill="#2d3748"/>`;
        svg += `<rect x="${10 + frameThickness - 2}" y="${20 + pixelHeight - frameThickness - 32}" width="4" height="12" fill="#2d3748"/>`;
    }
    
    // Dimensions text
    svg += `<text x="${pixelWidth/2 + 10}" y="15" text-anchor="middle" font-family="Arial" font-size="12" fill="#2d3748">${width} ${unit}</text>`;
    svg += `<text x="5" y="${pixelHeight/2 + 20}" text-anchor="middle" font-family="Arial" font-size="12" fill="#2d3748" transform="rotate(-90, 5, ${pixelHeight/2 + 20})">${height} ${unit}</text>`;
    
    // Product type label
    svg += `<text x="${pixelWidth/2 + 10}" y="${pixelHeight + 35}" text-anchor="middle" font-family="Arial" font-size="10" fill="#4a5568">${doorType === 'double' ? 'Double' : 'Single'} Door</text>`;
    
    svg += '</svg>';
    return svg;
}

/**
 * Main function to generate SVG based on product type and dimensions
 * @param {string} productTypeName - Name of the product type
 * @param {number} width - Width in specified unit
 * @param {number} height - Height in specified unit
 * @param {string} unit - Dimension unit ('inches', 'mm', 'ft', 'm')
 * @returns {string} - SVG string
 */
function generateProductSVG(productTypeName, width, height, unit = 'inches', prompt = '') {
    console.log("[DEBUG] SVG Generator - Product:", productTypeName, "Prompt:", prompt);
    
    // Convert productTypeName to lowercase for easier matching
    const lowerProductName = productTypeName.toLowerCase();
    
    // Pattern matching with more comprehensive detection
    if (lowerProductName.includes('sliding') || lowerProductName.includes('slider') || 
        lowerProductName.includes('3track') || lowerProductName.includes('3-track') || 
        lowerProductName.includes('3 track') || lowerProductName.includes('2track') || 
        lowerProductName.includes('2-track') || lowerProductName.includes('2 track') ||
        lowerProductName.includes('4track') || lowerProductName.includes('4-track') || 
        lowerProductName.includes('4 track')) {
        
        // Determine tracks count
        let tracks = 2; // Default
        if (lowerProductName.includes('3')) tracks = 3;
        else if (lowerProductName.includes('4')) tracks = 4;
        
        return generateSlidingWindowSVG(width, height, unit, tracks, prompt);
    } else if (lowerProductName.includes('double casement') || lowerProductName.includes('casement double')) {
        return generateCasementWindowSVG(width, height, unit, 'double');
    } else if (lowerProductName.includes('casement')) {
        return generateCasementWindowSVG(width, height, unit, 'single');
    } else if (lowerProductName.includes('fixed') || lowerProductName.includes('picture')) {
        return generateFixedWindowSVG(width, height, unit);
    } else if (lowerProductName.includes('double door') || lowerProductName.includes('door double')) {
        return generateDoorSVG(width, height, unit, 'double');
    } else if (lowerProductName.includes('door')) {
        return generateDoorSVG(width, height, unit, 'single');
    } else {
        // Default to fixed window for unknown types
        return generateFixedWindowSVG(width, height, unit);
    }
}

module.exports = {
    generateProductSVG,
    generateSlidingWindowSVG,
    generateCasementWindowSVG,
    generateFixedWindowSVG,
    generateDoorSVG,
    convertToPixels
}; 