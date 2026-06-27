import React, { useState } from 'react';
import UploadArea from '../ui/UploadArea';
import InfoCard from '../ui/InfoCard';
import { Architecture } from '../../types';
import { api } from '../../services/api';

interface ImageUploadAnalyzerProps {
  onArchitectureGenerated: (architecture: Architecture) => void;
}

/**
 * ImageUploadAnalyzer Component
 *
 * Used within the Architecture page for the "Upload" method.
 * Allows users to upload architecture diagrams and analyze them.
 * Uses refactored UploadArea component for consistent design.
 */
const ImageUploadAnalyzer: React.FC<ImageUploadAnalyzerProps> = ({ onArchitectureGenerated }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Info card data
  const howItWorksItems = [
    '1. Upload: Provide a clear image of your cloud architecture diagram',
    '2. Analyze: AI identifies components, connections, and cloud provider',
    '3. Generate: Automatically creates Terraform/CloudFormation code',
    '4. Review: Examine and modify the generated infrastructure',
    '5. Deploy: Deploy directly to your cloud provider',
  ];

  const handleFile = async (file: File) => {
    setSelectedFile(file);
    setIsAnalyzing(true);

    try {
      console.log('🔍 Analyzing uploaded diagram...');
      const response = await api.analyzeImage(file);

      if (response.success && response.data?.architecture) {
        console.log('✅ Analysis completed:', response.data);
        // Pass the generated architecture back to parent
        onArchitectureGenerated(response.data.architecture);
      } else {
        throw new Error('Analysis failed - no architecture data returned');
      }
    } catch (err) {
      console.error('❌ Analysis error:', err);
      alert(err instanceof Error ? err.message : 'Failed to analyze image. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Upload Area - matches ImageAnalysis page design */}
      <UploadArea
        onFileSelect={handleFile}
        onDrop={handleFile}
      />

      {/* Loading state */}
      {isAnalyzing && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-text-secondary">Analyzing your architecture diagram...</p>
        </div>
      )}

      {/* How it works - matches ImageAnalysis page design */}
      {!isAnalyzing && (
        <InfoCard title="How it works" items={howItWorksItems} />
      )}
    </div>
  );
};

export default ImageUploadAnalyzer;
