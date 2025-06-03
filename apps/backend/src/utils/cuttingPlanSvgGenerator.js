const { convertUnit } = require('./unitConverter');

class CuttingPlanSvgGenerator {
    constructor() {
        this.SVG_WIDTH = 1000;
        this.SVG_HEIGHT = 144;
        this.MARGIN = 40;
        this.PIPE_HEIGHT = 30;
        this.PIPE_DEPTH = 8; // For 3D effect
        this.TITLE_Y = 32;
        this.PIPE_Y = 50;
        this.TEXT_Y = 68;
        this.FONT_SIZE = {
            TITLE: 16,
            LABEL: 11,
            PIPE_LABEL: 12
        };
        this.COLORS = {
            // Aluminum pipe colors with gradients
            PIPE_BASE: '#E8E8E8',
            PIPE_HIGHLIGHT: '#F5F5F5',
            PIPE_SHADOW: '#CCCCCC',
            PIPE_BORDER: '#AAAAAA',
            
            // Cut section colors
            CUT_BASE: '#4CAF50',
            CUT_HIGHLIGHT: '#66BB6A',
            CUT_SHADOW: '#388E3C',
            CUT_BORDER: '#2E7D32',
            
            // Scrap section colors
            SCRAP_BASE: '#F44336',
            SCRAP_HIGHLIGHT: '#EF5350',
            SCRAP_SHADOW: '#D32F2F',
            SCRAP_BORDER: '#C62828',
            
            TEXT: '#000000',
            WHITE: '#FFFFFF',
            SHADOW: 'rgba(0,0,0,0.2)'
        };

        // Bind all methods to the instance
        this.generateCuttingPlanSVG = this.generateCuttingPlanSVG.bind(this);
        this._createEmptySVG = this._createEmptySVG.bind(this);
        this._initSVG = this._initSVG.bind(this);
        this._initSVGWithHeight = this._initSVGWithHeight.bind(this);
        this._addTitle = this._addTitle.bind(this);
        this._drawPipe = this._drawPipe.bind(this);
        this._addPipeLabel = this._addPipeLabel.bind(this);
        this._drawCut = this._drawCut.bind(this);
        this._addCutLabel = this._addCutLabel.bind(this);
        this._drawScrap = this._drawScrap.bind(this);
        this._addScrapLabel = this._addScrapLabel.bind(this);
        this._addGradientDefs = this._addGradientDefs.bind(this);
        this._drawCutLine = this._drawCutLine.bind(this);
    }

    // Helper function to safely convert values to string (handles both lean and non-lean MongoDB results)
    _safeToString(value) {
        if (!value && value !== 0) return '0';
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return value.toString();
        if (value.$numberDecimal) return value.$numberDecimal;
        if (value.toString && typeof value.toString === 'function') return value.toString();
        return '0';
    }

    generateCuttingPlanSVG(materialPlanOrPlans) {
        // Handle both single material plan and array of material plans
        const materialPlans = Array.isArray(materialPlanOrPlans) ? materialPlanOrPlans : [materialPlanOrPlans];
        
        if (!materialPlans || materialPlans.length === 0) {
            return this._createEmptySVG();
        }

        // Check if any material plan has pipes
        const hasAnyPipes = materialPlans.some(mp => mp.pipesUsed && mp.pipesUsed.length > 0);
        if (!hasAnyPipes) {
            return this._createEmptySVG();
        }

        // Calculate total height needed for all material plans
        let totalPipes = 0;
        materialPlans.forEach(mp => {
            if (mp.pipesUsed) {
                totalPipes += mp.pipesUsed.length;
            }
        });
        
        const heightPerPipe = this.PIPE_HEIGHT + this.PIPE_DEPTH + 35; // Extra space for 3D effect and labels
        const heightPerMaterial = 60; // Extra space for material title
        const totalHeight = Math.max(this.SVG_HEIGHT, 
            this.PIPE_Y + (totalPipes * heightPerPipe) + (materialPlans.length * heightPerMaterial) + 40);

        let svg = this._initSVGWithHeight(totalHeight);
        svg += this._addGradientDefs();
        
        let currentY = this.PIPE_Y;
        
        // Process each material plan
        for (let materialIndex = 0; materialIndex < materialPlans.length; materialIndex++) {
            const materialPlan = materialPlans[materialIndex];
            
            if (!materialPlan.pipesUsed || materialPlan.pipesUsed.length === 0) {
                continue;
            }
            
            // Add material title
            svg += this._addTitle(materialPlan, currentY - 25);
            
            // Process each pipe in this material
            for (let i = 0; i < materialPlan.pipesUsed.length; i++) {
                const pipe = materialPlan.pipesUsed[i];
                const pipeY = currentY + (i * heightPerPipe);
                
                // Validate pipe data
                if (!pipe.standardLength || !pipe.standardLengthUnit) {
                    console.warn(`[SVG Generator] Skipping pipe ${i} due to missing standardLength or standardLengthUnit`);
                    continue;
                }
                
                // Convert pipe length to inches for consistent scaling
                const conversionResult = convertUnit(parseFloat(this._safeToString(pipe.standardLength)), pipe.standardLengthUnit, 'inches');
                if (conversionResult.error || conversionResult.result === null) {
                    console.warn(`[SVG Generator] Skipping pipe ${i} due to unit conversion error: ${conversionResult.error}`);
                    continue;
                }
                const pipeLength = conversionResult.result;
                if (isNaN(pipeLength) || pipeLength <= 0) {
                    console.warn(`[SVG Generator] Skipping pipe ${i} due to invalid pipe length: ${pipeLength}`);
                    continue;
                }
                const pixelsPerInch = (this.SVG_WIDTH - 2 * this.MARGIN) / pipeLength;

                // Draw base pipe with 3D effect
                svg += this._drawPipe(pipeLength, pipeY, pixelsPerInch, i + 1);
                svg += this._addPipeLabel(pipe, pipeY, i + 1);

                // Draw cuts with cut lines
                let currentX = this.MARGIN;
                if (pipe.cutsMade && Array.isArray(pipe.cutsMade)) {
                    for (const cut of pipe.cutsMade) {
                        if (cut.requiredLength) {
                            const cutConversionResult = convertUnit(parseFloat(this._safeToString(cut.requiredLength)), materialPlan.usageUnit, 'inches');
                            if (cutConversionResult.error || cutConversionResult.result === null) {
                                console.warn(`[SVG Generator] Skipping cut due to unit conversion error: ${cutConversionResult.error}`);
                                continue;
                            }
                            const cutLength = cutConversionResult.result;
                            const cutWidth = cutLength * pixelsPerInch;
                            
                            svg += this._drawCut(currentX, pipeY, cutWidth);
                            svg += this._addCutLabel(currentX, cutWidth, pipeY, this._safeToString(cut.requiredLength), cut.identifier, materialPlan.usageUnit);
                            
                            currentX += cutWidth;
                            
                            // Add cut line if not the last cut
                            if (currentX < this.MARGIN + (pipeLength * pixelsPerInch)) {
                                svg += this._drawCutLine(currentX, pipeY);
                            }
                        }
                    }
                }

                // Draw scrap if any
                if (pipe.scrapLength) {
                    const scrapConversionResult = convertUnit(parseFloat(this._safeToString(pipe.scrapLength)), materialPlan.usageUnit, 'inches');
                    if (scrapConversionResult.error || scrapConversionResult.result === null) {
                        console.warn(`[SVG Generator] Skipping scrap due to unit conversion error: ${scrapConversionResult.error}`);
                    } else {
                        const scrapLengthInches = scrapConversionResult.result;
                        if (scrapLengthInches > 0) {
                            const scrapWidth = scrapLengthInches * pixelsPerInch;
                            svg += this._drawScrap(currentX, pipeY, scrapWidth);
                            svg += this._addScrapLabel(currentX, scrapWidth, pipeY, this._safeToString(pipe.scrapLength), materialPlan.usageUnit);
                        }
                    }
                }
            }
            
            // Update currentY for next material
            currentY += materialPlan.pipesUsed.length * heightPerPipe + heightPerMaterial;
        }

        svg += '</svg>';
        return svg;
    }

    _addGradientDefs() {
        return `
        <defs>
            <!-- Aluminum pipe gradient -->
            <linearGradient id="pipeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:${this.COLORS.PIPE_HIGHLIGHT};stop-opacity:1" />
                <stop offset="30%" style="stop-color:${this.COLORS.PIPE_BASE};stop-opacity:1" />
                <stop offset="70%" style="stop-color:${this.COLORS.PIPE_BASE};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${this.COLORS.PIPE_SHADOW};stop-opacity:1" />
            </linearGradient>
            
            <!-- Cut section gradient -->
            <linearGradient id="cutGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:${this.COLORS.CUT_HIGHLIGHT};stop-opacity:0.9" />
                <stop offset="50%" style="stop-color:${this.COLORS.CUT_BASE};stop-opacity:0.9" />
                <stop offset="100%" style="stop-color:${this.COLORS.CUT_SHADOW};stop-opacity:0.9" />
            </linearGradient>
            
            <!-- Scrap section gradient -->
            <linearGradient id="scrapGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:${this.COLORS.SCRAP_HIGHLIGHT};stop-opacity:0.8" />
                <stop offset="50%" style="stop-color:${this.COLORS.SCRAP_BASE};stop-opacity:0.8" />
                <stop offset="100%" style="stop-color:${this.COLORS.SCRAP_SHADOW};stop-opacity:0.8" />
            </linearGradient>
            
            <!-- Shadow filter -->
            <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="2" dy="3" stdDeviation="2" flood-color="${this.COLORS.SHADOW}"/>
            </filter>
            
            <!-- Metallic shine effect -->
            <linearGradient id="metallicShine" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:rgba(255,255,255,0);stop-opacity:0" />
                <stop offset="20%" style="stop-color:rgba(255,255,255,0.3);stop-opacity:1" />
                <stop offset="40%" style="stop-color:rgba(255,255,255,0.6);stop-opacity:1" />
                <stop offset="60%" style="stop-color:rgba(255,255,255,0.3);stop-opacity:1" />
                <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:0" />
            </linearGradient>
        </defs>`;
    }

    _createEmptySVG() {
        return `<svg width="${this.SVG_WIDTH}" height="${this.SVG_HEIGHT}" xmlns="http://www.w3.org/2000/svg" style="background: linear-gradient(to bottom, #f8f9fa, #e9ecef);">
            <text x="${this.MARGIN}" y="${this.TITLE_Y}" font-size="${this.FONT_SIZE.TITLE}" font-family="Arial, sans-serif" fill="${this.COLORS.TEXT}">No cutting plan available</text>
        </svg>`;
    }

    _initSVG() {
        return `<svg width="${this.SVG_WIDTH}" height="${this.SVG_HEIGHT}" xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" style="background: linear-gradient(to bottom, #f8f9fa, #e9ecef);">`;
    }

    _initSVGWithHeight(height) {
        return `<svg width="${this.SVG_WIDTH}" height="${height}" xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" style="background: linear-gradient(to bottom, #f8f9fa, #e9ecef);">`;
    }

    _addTitle(materialPlan, y = this.TITLE_Y) {
        return `<text x="${this.MARGIN}" y="${y}" font-size="${this.FONT_SIZE.TITLE}" font-weight="bold" fill="${this.COLORS.TEXT}" font-family="Arial, sans-serif">Material: ${materialPlan.materialNameSnapshot} (Gauge: ${materialPlan.gaugeSnapshot})</text>`;
    }

    _drawPipe(length, y, pixelsPerInch, pipeNumber) {
        const width = length * pixelsPerInch;
        const topY = y;
        const frontY = y + this.PIPE_DEPTH;
        
        // Draw shadow first
        let svg = `<rect x="${this.MARGIN + 3}" y="${frontY + 3}" width="${width}" height="${this.PIPE_HEIGHT}" fill="${this.COLORS.SHADOW}" rx="3" ry="3" opacity="0.3"/>`;
        
        // Draw 3D pipe structure
        // Top face (slightly visible)
        svg += `<polygon points="${this.MARGIN},${topY} ${this.MARGIN + width},${topY} ${this.MARGIN + width + this.PIPE_DEPTH},${topY + this.PIPE_DEPTH} ${this.MARGIN + this.PIPE_DEPTH},${topY + this.PIPE_DEPTH}" 
                 fill="url(#pipeGradient)" stroke="${this.COLORS.PIPE_BORDER}" stroke-width="1" opacity="0.8"/>`;
        
        // Right face (depth)
        svg += `<polygon points="${this.MARGIN + width},${topY} ${this.MARGIN + width + this.PIPE_DEPTH},${topY + this.PIPE_DEPTH} ${this.MARGIN + width + this.PIPE_DEPTH},${frontY + this.PIPE_HEIGHT} ${this.MARGIN + width},${frontY + this.PIPE_HEIGHT}" 
                 fill="${this.COLORS.PIPE_SHADOW}" stroke="${this.COLORS.PIPE_BORDER}" stroke-width="1"/>`;
        
        // Front face (main visible surface)
        svg += `<rect x="${this.MARGIN}" y="${frontY}" width="${width}" height="${this.PIPE_HEIGHT}" 
                 fill="url(#pipeGradient)" stroke="${this.COLORS.PIPE_BORDER}" stroke-width="2" rx="3" ry="3" filter="url(#dropShadow)"/>`;
        
        // Add metallic shine effect
        svg += `<rect x="${this.MARGIN}" y="${frontY}" width="${width}" height="${this.PIPE_HEIGHT}" 
                 fill="url(#metallicShine)" rx="3" ry="3" opacity="0.4"/>`;
        
        // Add subtle inner highlights
        svg += `<rect x="${this.MARGIN + 2}" y="${frontY + 2}" width="${width - 4}" height="2" 
                 fill="${this.COLORS.PIPE_HIGHLIGHT}" rx="1" ry="1" opacity="0.7"/>`;
        
        return svg;
    }

    _addPipeLabel(pipe, y, pipeNumber) {
        const labelY = y + this.PIPE_HEIGHT + this.PIPE_DEPTH + 15;
        return `<text x="${this.MARGIN - 5}" y="${labelY}" font-size="${this.FONT_SIZE.PIPE_LABEL}" fill="${this.COLORS.TEXT}" font-weight="bold" font-family="Arial, sans-serif">${this._safeToString(pipe.standardLength)} ${pipe.standardLengthUnit} Pipe ${pipeNumber}:</text>`;
    }

    _drawCut(x, y, width) {
        const frontY = y + this.PIPE_DEPTH;
        
        // Cut section with transparency to show it's a marked area
        let svg = `<rect x="${x}" y="${frontY}" width="${width}" height="${this.PIPE_HEIGHT}" 
                   fill="url(#cutGradient)" stroke="${this.COLORS.CUT_BORDER}" stroke-width="1" rx="2" ry="2"/>`;
        
        // Add inner highlight for cut section
        svg += `<rect x="${x + 1}" y="${frontY + 1}" width="${width - 2}" height="2" 
                fill="${this.COLORS.CUT_HIGHLIGHT}" rx="1" ry="1" opacity="0.8"/>`;
        
        return svg;
    }

    _drawCutLine(x, y) {
        const frontY = y + this.PIPE_DEPTH;
        // Red dashed cut line
        return `<line x1="${x}" y1="${frontY - 5}" x2="${x}" y2="${frontY + this.PIPE_HEIGHT + 5}" 
                stroke="red" stroke-width="2" stroke-dasharray="4,2" opacity="0.8"/>
                <circle cx="${x}" cy="${frontY - 8}" r="2" fill="red" opacity="0.8"/>
                <circle cx="${x}" cy="${frontY + this.PIPE_HEIGHT + 8}" r="2" fill="red" opacity="0.8"/>`;
    }

    _addCutLabel(x, width, y, length, identifier, usageUnit = '') {
        const labelX = x + (width / 2);
        const frontY = y + this.PIPE_DEPTH;
        let idText = '';
        
        if (identifier) {
            idText = `<text x="${labelX}" y="${frontY + 12}" font-size="${this.FONT_SIZE.LABEL - 1}" fill="${this.COLORS.WHITE}" text-anchor="middle" font-weight="bold" font-family="Arial, sans-serif">${identifier}</text>`;
        }
        const lengthWithUnit = usageUnit ? `${length} ${usageUnit}` : length;
        const lengthText = `<text x="${labelX}" y="${frontY + 24}" font-size="${this.FONT_SIZE.LABEL}" fill="${this.COLORS.WHITE}" text-anchor="middle" font-weight="bold" font-family="Arial, sans-serif">${lengthWithUnit}</text>`;
        return idText + lengthText;
    }

    _drawScrap(x, y, width) {
        const frontY = y + this.PIPE_DEPTH;
        
        // Scrap section with dotted pattern
        let svg = `<rect x="${x}" y="${frontY}" width="${width}" height="${this.PIPE_HEIGHT}" 
                   fill="url(#scrapGradient)" stroke="${this.COLORS.SCRAP_BORDER}" stroke-width="1" stroke-dasharray="3,2" rx="2" ry="2"/>`;
        
        // Add diagonal lines to indicate scrap
        for (let i = 0; i < width; i += 8) {
            svg += `<line x1="${x + i}" y1="${frontY}" x2="${x + i + 6}" y2="${frontY + this.PIPE_HEIGHT}" 
                    stroke="${this.COLORS.SCRAP_SHADOW}" stroke-width="1" opacity="0.6"/>`;
        }
        
        return svg;
    }

    _addScrapLabel(x, width, y, scrapLength, usageUnit = '') {
        const labelX = x + (width / 2);
        const frontY = y + this.PIPE_DEPTH;
        const scrapWithUnit = usageUnit ? `Scrap: ${scrapLength} ${usageUnit}` : `Scrap: ${scrapLength}`;
        return `<text x="${labelX}" y="${frontY + 18}" font-size="${this.FONT_SIZE.LABEL}" fill="${this.COLORS.WHITE}" text-anchor="middle" font-weight="bold" font-family="Arial, sans-serif">${scrapWithUnit}</text>`;
    }
}

// Export a singleton instance
const svgGenerator = new CuttingPlanSvgGenerator();
module.exports = svgGenerator; 