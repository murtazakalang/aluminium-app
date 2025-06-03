import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { CuttingPlanVisualizer } from './CuttingPlanVisualizer';
import { manufacturingApi } from '@/lib/api/manufacturingService';

// Mock the manufacturingApi
jest.mock('@/lib/api/manufacturingService', () => ({
  manufacturingApi: {
    getCuttingPlanSvg: jest.fn(),
  },
}));

describe('CuttingPlanVisualizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays loading state initially', () => {
    render(<CuttingPlanVisualizer orderId="123" />);
    expect(screen.getByText('Loading cutting plan visualization...')).toBeInTheDocument();
  });

  it('displays the SVG content when loaded', async () => {
    const mockSvgContent = '<svg><rect x="10" y="10" width="100" height="100" /></svg>';
    (manufacturingApi.getCuttingPlanSvg as jest.Mock).mockResolvedValueOnce({
      data: { svg: mockSvgContent },
    });

    render(<CuttingPlanVisualizer orderId="123" />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading cutting plan visualization...')).not.toBeInTheDocument();
    });

    // Check that the SVG container is present
    const svgContainer = document.querySelector('[aria-label="Cutting plan visualization"]');
    expect(svgContainer).toBeInTheDocument();
    expect(svgContainer?.innerHTML).toContain(mockSvgContent);
  });

  it('displays an error message when API call fails', async () => {
    const errorMessage = 'Failed to fetch SVG';
    (manufacturingApi.getCuttingPlanSvg as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

    render(<CuttingPlanVisualizer orderId="123" />);
    
    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('displays "No cutting plan visualization available" when no SVG content', async () => {
    (manufacturingApi.getCuttingPlanSvg as jest.Mock).mockResolvedValueOnce({
      data: { svg: '' },
    });

    render(<CuttingPlanVisualizer orderId="123" />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading cutting plan visualization...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('No cutting plan visualization available.')).toBeInTheDocument();
  });
}); 