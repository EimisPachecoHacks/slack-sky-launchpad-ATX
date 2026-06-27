import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import WizardSteps, { Step } from '../components/architecture/WizardSteps';
import UploadArea from '../components/ui/UploadArea';
import AnalysisResults from '../components/ui/AnalysisResults';
import InfoCard from '../components/ui/InfoCard';
import Button from '../components/ui/Button';
import { ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { useArchitectureStore } from '../store';

const ImageAnalysis: React.FC = () => {
  const navigate = useNavigate();
  const setArchitecture = useArchitectureStore((state) => state.setCurrentArchitecture);

  const [currentStep, setCurrentStep] = useState('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Step configuration - matching Architecture page upload steps
  const steps: Step[] = [
    { id: 'method', label: 'Method' },
    { id: 'upload', label: 'Upload' },
    { id: 'review', label: 'Review' },
    { id: 'code', label: 'Code' },
  ];

  // Info card data
  const howItWorksItems = [
    '1. Upload: Provide a clear image of your cloud architecture diagram',
    '2. Analyze: AI identifies components, connections, and cloud provider',
    '3. Generate: Automatically creates Terraform/CloudFormation code',
    '4. Review: Examine and modify the generated infrastructure',
    '5. Deploy: Deploy directly to your cloud provider',
  ];

  const handleFile = (file: File) => {
    setSelectedFile(file);
    setError(null);
    setAnalysis(null);
    setCurrentStep('upload');

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setError(null);
    setCurrentStep('review');

    try {
      console.log('🔍 Analyzing uploaded diagram...');
      const response = await api.analyzeImage(selectedFile);

      if (response.success && response.data) {
        setAnalysis(response.data);
        setCurrentStep('code');
        console.log('✅ Analysis completed:', response.data);
      } else {
        throw new Error('Analysis failed');
      }
    } catch (err) {
      console.error('❌ Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze image');
      setCurrentStep('upload');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper function to get service icons
  const getServiceIcon = (serviceName: string): string => {
    const name = serviceName.toLowerCase();
    if (name.includes('kinesis') || name.includes('stream')) return '🌊';
    if (name.includes('glue') || name.includes('etl')) return '🔧';
    if (name.includes('s3') || name.includes('storage') || name.includes('blob')) return '💾';
    if (name.includes('catalog') || name.includes('metadata')) return '📚';
    if (name.includes('sftp') || name.includes('transfer')) return '📤';
    if (name.includes('athena') || name.includes('query')) return '🔍';
    if (name.includes('lambda') || name.includes('function')) return 'λ';
    if (name.includes('ec2') || name.includes('compute') || name.includes('vm')) return '💻';
    if (name.includes('rds') || name.includes('database') || name.includes('sql')) return '🗄️';
    if (name.includes('redshift') || name.includes('warehouse')) return '🏢';
    if (name.includes('vpc') || name.includes('network')) return '🌐';
    if (name.includes('cloudwatch') || name.includes('monitor')) return '📊';
    if (name.includes('sns') || name.includes('notification')) return '📢';
    if (name.includes('sqs') || name.includes('queue')) return '📬';
    return '☁️';
  };

  const handleGenerateCode = () => {
    console.log('🎯 handleGenerateCode called');
    console.log('  - analysis:', analysis);

    if (!analysis) {
      console.error('❌ No analysis data available!');
      return;
    }

    // Convert detected components to architecture format for the diagram
    // IMPORTANT: Must match Architecture interface from types/index.ts
    const architectureData: any = {
      id: `analyzed-${Date.now()}`,
      name: analysis.architecture?.title || analysis.architecture?.name || 'Architecture generated from uploaded diagram',
      description: analysis.architecture?.description || 'AI-analyzed architecture from uploaded diagram',
      provider: analysis.architecture?.provider || 'aws',
      components: [],
      alternatives: [],
      diagram: {
        nodes: [],
        edges: [],
        viewport: {
          zoom: 1,
          pan: { x: 0, y: 0 }
        },
        grid: {
          size: 20,
          enabled: true,
          snapEnabled: false
        }
      },
      optimizationPreference: 'balanced',
      metadata: {
        totalCost: analysis.architecture?.estimated_cost || 0,
        estimatedPerformance: 80,
        complexity: analysis.architecture?.complexity || 'medium',
        tags: ['ai-generated', 'image-analysis'],
        lastModified: new Date().toISOString(),
        version: '1.0'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('📦 Creating architecture data...');

    // Convert detected components to architecture components
    if (analysis.detected_components && analysis.detected_components.length > 0) {
      console.log(`  - Found ${analysis.detected_components.length} detected components`);

      architectureData.components = analysis.detected_components.map((comp: any, index: number) => ({
        id: `comp-${index}`,
        name: comp.service_name || comp.name,
        description: comp.description || '',
        type: comp.type || 'compute',
        cost: 0,
        confidence: comp.confidence || 0
      }));

      // Create diagram nodes from detected components
      // IMPORTANT: Match the exact structure expected by ReactFlowDiagram
      architectureData.diagram.nodes = analysis.detected_components.map((comp: any, index: number) => ({
        id: `node-${index}`,
        x: 150 + (index % 4) * 250,  // Grid layout: 4 columns
        y: 100 + Math.floor(index / 4) * 180,  // Vertical spacing
        width: 200,
        height: 100,
        label: comp.service_name || comp.name,
        subLabel: comp.type || 'Service',
        icon: getServiceIcon(comp.service_name || comp.name),
        cost: 0,
        description: comp.description || `Detected with ${comp.confidence}% confidence`,
        isDragging: false,
        type: comp.category || comp.type || 'compute',
        provider: analysis.architecture?.provider || 'aws'
      }));

      // Create edges to connect the nodes (sequential flow for detected architecture)
      architectureData.diagram.edges = [];
      for (let i = 0; i < analysis.detected_components.length - 1; i++) {
        architectureData.diagram.edges.push({
          id: `edge-${i}`,
          from: `node-${i}`,
          to: `node-${i + 1}`,
          type: 'Data Flow'
        });
      }

      console.log('  ✅ Components converted:', architectureData.components.length);
      console.log('  ✅ Diagram nodes created:', architectureData.diagram.nodes.length);
      console.log('  ✅ Diagram edges created:', architectureData.diagram.edges.length);
    } else {
      console.warn('  ⚠️ No detected components found in analysis!');
    }

    console.log('📤 Final architecture data:', architectureData);
    console.log('  - title:', architectureData.title);
    console.log('  - provider:', architectureData.provider);
    console.log('  - components:', architectureData.components?.length || 0);
    console.log('  - diagram.nodes:', architectureData.diagram?.nodes?.length || 0);

    // Store in global Zustand state
    console.log('💾 Storing in Zustand store...');
    setArchitecture(architectureData);

    // Navigate to architecture page with the generated architecture
    console.log('🚀 Navigating to /architecture page...');
    navigate('/architecture', {
      state: {
        fromImageAnalysis: true,
        architecture: architectureData,
        currentStep: 'review'
      }
    });

    console.log('✅ Navigation initiated!');
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreview(null);
    setAnalysis(null);
    setError(null);
    setCurrentStep('upload');
  };

  return (
    <div className="min-h-screen text-text-primary">
      <Header />

      <main className="w-full px-6 pt-24 pb-16">
        <div className="w-full max-w-[95vw] mx-auto">
          {/* Header with Back Button */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-6">
              <Button
                variant="ghost"
                onClick={() => navigate('/')}
                icon={<ArrowLeft className="w-5 h-5" />}
                className="text-blue-400 hover:text-blue-300"
              >
                Back
              </Button>

              <h1 className="text-3xl md:text-4xl font-bold">
                Let's Build with Sky Launchpad
              </h1>
            </div>
          </div>

          <WizardSteps
            steps={steps}
            currentStep={currentStep}
          />

          <div className="mt-8 w-full">
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Upload Section */}
              {!selectedFile && (
                <>
                  <UploadArea
                    onFileSelect={handleFile}
                    onDrop={handleFile}
                  />

                  {/* How it works */}
                  <InfoCard title="How it works" items={howItWorksItems} />
                </>
              )}

              {/* Analysis Section */}
              {selectedFile && (
                <AnalysisResults
                  isAnalyzing={isAnalyzing}
                  error={error}
                  analysis={analysis}
                  onRetry={handleUpload}
                  onGenerateCode={handleGenerateCode}
                  preview={preview}
                  onUploadDifferent={handleReset}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ImageAnalysis;
