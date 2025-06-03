import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { 
  Wand2, 
  Eye, 
  EyeOff, 
  Download, 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  AlertCircle,
  Sparkles,
  FileImage
} from 'lucide-react';
import { productApi, TechnicalDrawing, SVGGenerationRequest } from '@/lib/api/productService';

interface TechnicalDrawingFormProps {
  productId?: string;
  productName?: string;
  currentDrawing?: TechnicalDrawing;
  onSave: (drawing: TechnicalDrawing) => void;
  disabled?: boolean;
}

const TechnicalDrawingForm: React.FC<TechnicalDrawingFormProps> = ({
  productId,
  productName,
  currentDrawing,
  onSave,
  disabled = false
}) => {
  const [prompt, setPrompt] = useState(currentDrawing?.prompt || '');
  const [svgContent, setSvgContent] = useState(currentDrawing?.svgContent || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(!!currentDrawing?.svgContent);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isManualEdit, setIsManualEdit] = useState(false);

  // Prompt suggestions for different product types
  const promptSuggestions = [
    "Create a technical drawing of a 2-track sliding window frame with dimensions and profile details",
    "Design a casement window technical diagram showing hinges, frame, and glass placement", 
    "Generate a door frame cross-section with technical annotations and measurements",
    "Draw a curtain wall profile showing glazing system and structural details",
    "Create an awning window mechanism diagram with opening directions",
    "Design a fixed window frame detail with thermal break specifications"
  ];

  const handleGenerateSVG = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt for SVG generation');
      return;
    }

    if (!productId) {
      setError('Product must be saved before generating technical drawings');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const request: SVGGenerationRequest = { prompt: prompt.trim() };
      const response = await productApi.generateSVG(productId, request);
      
      setSvgContent(response.technicalDrawing.svgContent);
      setShowPreview(true);
      setSuccess('Technical drawing generated successfully!');
      
      // Update the parent component
      onSave({
        svgContent: response.technicalDrawing.svgContent,
        prompt: response.technicalDrawing.prompt,
        generatedAt: response.technicalDrawing.generatedAt,
        isActive: response.technicalDrawing.isActive
      });

    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Failed to generate SVG. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateDrawing = async () => {
    if (!productId) {
      setError('Product must be saved before updating technical drawings');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      await productApi.updateTechnicalDrawing(productId, {
        svgContent: svgContent,
        prompt: prompt,
        isActive: true
      });
      
      setSuccess('Technical drawing updated successfully!');
      
      // Update the parent component
      onSave({
        svgContent: svgContent,
        prompt: prompt,
        generatedAt: new Date(),
        isActive: true
      });

    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Failed to update technical drawing');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearDrawing = () => {
    setSvgContent('');
    setPrompt('');
    setShowPreview(false);
    setError(null);
    setSuccess(null);
    setIsManualEdit(false);
    
    // Update the parent component
    onSave({
      svgContent: '',
      prompt: '',
      generatedAt: new Date(),
      isActive: false
    });
  };

  const handleDownloadSVG = () => {
    if (!svgContent) return;
    
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${productName || 'product'}-technical-drawing.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePromptSuggestion = (suggestion: string) => {
    setPrompt(suggestion);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Status and Actions Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileImage className="h-5 w-5 text-blue-600" />
          <div>
            <h3 className="font-semibold text-gray-900">Technical Drawing</h3>
            <p className="text-sm text-gray-600">
              {currentDrawing?.svgContent ? 'Drawing available' : 'No drawing created yet'}
            </p>
          </div>
        </div>
        
        {currentDrawing?.svgContent && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-600 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              Active
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadSVG}
              className="flex items-center gap-1"
            >
              <Download className="h-4 w-4" />
              Download SVG
            </Button>
          </div>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md border border-red-200 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 text-green-700 p-3 rounded-md border border-green-200 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* AI Prompt Section */}
      <Card className="border border-blue-200 bg-blue-50/50">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <Label className="font-medium text-blue-900">AI Generation Prompt</Label>
          </div>
          
          <div className="space-y-3">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the technical drawing you want to generate..."
              rows={3}
              disabled={disabled || isGenerating}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            
            {/* Prompt Suggestions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {promptSuggestions.slice(0, 4).map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handlePromptSuggestion(suggestion)}
                  disabled={disabled || isGenerating}
                  className="text-left text-xs p-2 bg-white border border-gray-200 rounded hover:bg-gray-50 hover:border-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleGenerateSVG}
                disabled={disabled || isGenerating || !prompt.trim() || !productId}
                className="flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Generate SVG
                  </>
                )}
              </Button>
              
              {!productId && (
                <div className="text-sm text-amber-600 flex items-center gap-1 px-2">
                  <AlertCircle className="h-4 w-4" />
                  Save product first to enable AI generation
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* SVG Preview/Edit Section */}
      {svgContent && (
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Label className="font-medium">Technical Drawing Preview</Label>
                {currentDrawing?.generatedAt && (
                  <span className="text-xs text-gray-500">
                    Generated: {new Date(currentDrawing.generatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? (
                    <>
                      <EyeOff className="h-4 w-4 mr-1" />
                      Hide Preview
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-1" />
                      Show Preview
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsManualEdit(!isManualEdit)}
                >
                  {isManualEdit ? 'Close Editor' : 'Edit SVG'}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearDrawing}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* SVG Preview */}
            {showPreview && (
              <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div 
                  className="flex justify-center items-center min-h-[200px] bg-white rounded border"
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              </div>
            )}
            
            {/* Manual SVG Editor */}
            {isManualEdit && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Edit SVG Code:</Label>
                <textarea
                  value={svgContent}
                  onChange={(e) => setSvgContent(e.target.value)}
                  rows={10}
                  disabled={disabled || isGenerating}
                  className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  placeholder="<svg>...</svg>"
                />
                
                <Button
                  type="button"
                  onClick={handleUpdateDrawing}
                  disabled={disabled || isGenerating || !svgContent.trim()}
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Update Drawing
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FileImage className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <h4 className="font-medium mb-1">Technical Drawing Tips:</h4>
            <ul className="space-y-1 text-blue-700">
              <li>• Be specific about dimensions, materials, and technical details</li>
              <li>• Mention profile types, glazing systems, or hardware components</li>
              <li>• The drawing will be included in quotation PDFs automatically</li>
              <li>• Generated SVGs are optimized for professional document display</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechnicalDrawingForm; 