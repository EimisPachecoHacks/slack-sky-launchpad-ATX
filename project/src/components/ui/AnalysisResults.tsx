import React from 'react';
import { CheckCircle, Loader, Code2 } from 'lucide-react';
import Button from './Button';
import Card from './Card';
import '../../styles/design-tokens.css';

interface Component {
  service_name: string;
  confidence: number;
  estimated_monthly_cost?: number;
}

interface AnalysisData {
  architecture?: {
    provider?: string;
    estimated_cost?: number;
    complexity?: string;
  };
  analysis_result?: {
    estimated_monthly_cost?: number;
    complexity?: string;
  };
  detected_components?: Component[];
}

interface AnalysisResultsProps {
  isAnalyzing: boolean;
  error: string | null;
  analysis: AnalysisData | null;
  onRetry: () => void;
  onGenerateCode: () => void;
  preview: string | null;
  onUploadDifferent: () => void;
}

/**
 * AnalysisResults Component
 *
 * Displays the results of AI architecture analysis including:
 * - Loading state
 * - Error state with retry option
 * - Success state with detected components and metrics
 *
 * @param isAnalyzing - Whether analysis is in progress
 * @param error - Error message if analysis failed
 * @param analysis - Analysis results data
 * @param onRetry - Callback to retry analysis
 * @param onGenerateCode - Callback to generate infrastructure code
 * @param preview - Image preview URL
 * @param onUploadDifferent - Callback to upload a different image
 *
 * @example
 * <AnalysisResults
 *   isAnalyzing={false}
 *   error={null}
 *   analysis={analysisData}
 *   onRetry={handleRetry}
 *   onGenerateCode={handleGenerateCode}
 *   preview={previewUrl}
 *   onUploadDifferent={handleReset}
 * />
 */
const AnalysisResults: React.FC<AnalysisResultsProps> = ({
  isAnalyzing,
  error,
  analysis,
  onRetry,
  onGenerateCode,
  preview,
  onUploadDifferent,
}) => {
  const getConfidenceClass = (confidence: number): string => {
    if (confidence >= 90) return 'high';
    if (confidence >= 80) return 'medium';
    return 'low';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left: Image Preview */}
      <Card variant="glass" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-heading">
            Uploaded Architecture Diagram
          </h3>
          <button
            onClick={onUploadDifferent}
            className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
          >
            Upload Different Image
          </button>
        </div>
        {preview && (
          <div className="rounded-lg overflow-hidden bg-black/20 border border-gray-700/50">
            <img
              src={preview}
              alt="Architecture diagram"
              className="w-full h-auto"
            />
          </div>
        )}
        {!isAnalyzing && !analysis && (
          <button
            onClick={onRetry}
            className="w-full mt-6 px-6 py-4 rounded-xl text-lg font-semibold transition-all duration-300
              dark:bg-gradient-to-br dark:from-blue-500/90 dark:to-blue-600/90
              dark:border-2 dark:border-blue-400/30
              dark:shadow-[0_4px_20px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]
              dark:backdrop-blur-md
              dark:hover:from-blue-600/90 dark:hover:to-blue-700/90
              dark:hover:shadow-[0_6px_30px_rgba(59,130,246,0.4),inset_0_1px_0_rgba(255,255,255,0.3)]
              dark:hover:-translate-y-0.5
              light:bg-blue-500 light:hover:bg-blue-600 light:shadow-lg
              text-white"
          >
            Analyze Diagram
          </button>
        )}
      </Card>

      {/* Right: Analysis Results */}
      <Card variant="glass" className="p-6">
        {/* Loading State */}
        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader className="loading-spinner mb-4" />
            <h3 className="text-xl font-bold mb-2 text-heading">
              Analyzing Diagram
            </h3>
            <p className="text-body text-center">
              AI is detecting components and analyzing your architecture...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
            <h3 className="font-bold text-red-400 mb-2">Analysis Failed</h3>
            <p className="text-sm text-body">{error}</p>
            <Button onClick={onRetry} className="mt-4" size="sm">
              Retry Analysis
            </Button>
          </div>
        )}

        {/* Success State */}
        {analysis && (
          <div>
            <div className="flex items-center mb-6">
              <CheckCircle className="w-8 h-8 text-green-400 mr-3" />
              <h2 className="text-2xl font-bold text-heading">
                Analysis Complete!
              </h2>
            </div>

            {/* Metrics */}
            <div className="space-y-4 mb-6">
              <div className="result-metric">
                <span className="text-body">Detected Provider</span>
                <span className="result-badge primary">
                  {analysis.architecture?.provider?.toUpperCase() || 'AWS'}
                </span>
              </div>

              <div className="result-metric">
                <span className="text-body">Estimated Cost</span>
                <span className="text-green-400 font-bold text-lg">
                  $
                  {analysis.architecture?.estimated_cost ||
                    analysis.analysis_result?.estimated_monthly_cost ||
                    0}
                  /mo
                </span>
              </div>

              <div className="result-metric">
                <span className="text-body">Complexity</span>
                <span className="result-badge warning capitalize">
                  {analysis.architecture?.complexity ||
                    analysis.analysis_result?.complexity ||
                    'Medium'}
                </span>
              </div>
            </div>

            {/* Detected Components */}
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-3 text-heading">
                Detected Components:
              </h3>
              <div className="space-y-2">
                {(analysis.detected_components || []).map((comp, idx) => (
                  <div key={idx} className="component-card">
                    <span className="text-heading">{comp.service_name}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-body">
                        {comp.confidence}%
                      </span>
                      <div
                        className={`confidence-dot ${getConfidenceClass(
                          comp.confidence
                        )}`}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <button
              onClick={onGenerateCode}
              className="w-full px-6 py-4 rounded-xl text-lg font-semibold transition-all duration-300
                dark:bg-gradient-to-br dark:from-blue-500/90 dark:to-blue-600/90
                dark:border-2 dark:border-blue-400/30
                dark:shadow-[0_4px_20px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]
                dark:backdrop-blur-md
                dark:hover:from-blue-600/90 dark:hover:to-blue-700/90
                dark:hover:shadow-[0_6px_30px_rgba(59,130,246,0.4),inset_0_1px_0_rgba(255,255,255,0.3)]
                dark:hover:-translate-y-0.5
                light:bg-blue-500 light:hover:bg-blue-600 light:shadow-lg
                text-white flex items-center justify-center space-x-2"
            >
              <Code2 className="w-5 h-5" />
              <span>Generate Diagram Architecture</span>
            </button>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <button
                onClick={() => console.log('Preview diagram')}
                className="px-4 py-3 rounded-xl font-medium transition-all duration-300
                  dark:bg-gradient-to-br dark:from-blue-500/20 dark:to-blue-600/20
                  dark:border-2 dark:border-blue-400/30
                  dark:backdrop-blur-md
                  dark:hover:from-blue-500/30 dark:hover:to-blue-600/30
                  dark:hover:border-blue-400/50
                  dark:hover:-translate-y-0.5
                  light:bg-gray-100 light:hover:bg-gray-200 light:border light:border-gray-300
                  text-text-primary"
              >
                Preview Diagram
              </button>
              <button
                onClick={() => console.log('Export analysis')}
                className="px-4 py-3 rounded-xl font-medium transition-all duration-300
                  dark:bg-gradient-to-br dark:from-blue-500/20 dark:to-blue-600/20
                  dark:border-2 dark:border-blue-400/30
                  dark:backdrop-blur-md
                  dark:hover:from-blue-500/30 dark:hover:to-blue-600/30
                  dark:hover:border-blue-400/50
                  dark:hover:-translate-y-0.5
                  light:bg-gray-100 light:hover:bg-gray-200 light:border light:border-gray-300
                  text-text-primary"
              >
                Export Analysis
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AnalysisResults;
