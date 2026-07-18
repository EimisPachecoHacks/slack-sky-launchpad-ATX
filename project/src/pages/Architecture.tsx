import React, { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import ProviderSelector from '../components/architecture/ProviderSelector';
import UseCaseForm from '../components/architecture/UseCaseForm';
import ArchitectureDiagramOptimized from '../components/architecture/ArchitectureDiagramOptimized';
import ComponentList from '../components/architecture/ComponentList';
import CodeGenerator from '../components/architecture/CodeGenerator';
import ImageUploadAnalyzer from '../components/architecture/ImageUploadAnalyzer';
import WizardSteps, { Step } from '../components/architecture/WizardSteps';
import Particles from '../components/ui/Particles';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { CloudProvider, Architecture as ArchitectureType } from '../types';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Cloud, Database, Server, Upload, Brain, Wand2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { useArchitectureStore } from '../store';

const ArchitecturePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState<string>('method');
  const [creationMethod, setCreationMethod] = useState<'wizard' | 'upload' | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | null>(null);
  const [architecture, setArchitecture] = useState<ArchitectureType | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Get architecture from Zustand store
  const storedArchitecture = useArchitectureStore((state) => state.current);

  // Handle incoming data from image analysis
  useEffect(() => {
    const state = location.state as any;

    // Priority 1: Check location.state from navigation
    if (state?.fromImageAnalysis && state?.architecture) {
      console.log(`✅ Loaded architecture from image: ${state.architecture.diagram?.nodes?.length || 0} nodes`);
      setArchitecture(state.architecture);
      setCurrentStep(state.currentStep || 'review');
      setCreationMethod('upload');
      setSelectedProvider(state.architecture.provider || 'aws');
      return;
    }

    // Priority 2: Check Zustand store (fallback)
    if (storedArchitecture && !architecture) {
      console.log(`✅ Loaded architecture from store: ${storedArchitecture.diagram?.nodes?.length || 0} nodes`);
      setArchitecture(storedArchitecture);
      setCurrentStep('review');
      setCreationMethod('upload');
      setSelectedProvider(storedArchitecture.provider || 'aws');
      return;
    }

    // Priority 3: Auto-analyze from query param ?autoAnalyze=<filename>
    const params = new URLSearchParams(location.search);
    const autoFile = params.get('autoAnalyze');
    if (autoFile && !architecture && !isGenerating) {
      setIsGenerating(true);
      setCreationMethod('upload');
      setCurrentStep('upload');
      (async () => {
        try {
          console.log(`🔍 Auto-analyzing image: ${autoFile}`);
          const imgResp = await fetch(`/${autoFile}`);
          if (!imgResp.ok) throw new Error(`Image not found: ${autoFile}`);
          const blob = await imgResp.blob();
          const file = new File([blob], autoFile, { type: blob.type || 'image/jpeg' });
          const response = await api.analyzeImage(file);
          if (response.success && response.data?.architecture) {
            const arch = response.data.architecture;
            console.log('✅ Auto-analysis completed:', arch.components?.length, 'components,', arch.diagram?.nodes?.length, 'nodes');
            handleArchitectureGenerated(arch as ArchitectureType);
            setSelectedProvider(arch.provider || 'aws');
          } else {
            throw new Error('Analysis returned no architecture');
          }
        } catch (err) {
          console.error('❌ Auto-analysis failed:', err);
          setError(err instanceof Error ? err.message : 'Auto-analysis failed');
          setCurrentStep('method');
        } finally {
          setIsGenerating(false);
        }
      })();
    }
  }, [location.state, storedArchitecture]);

  const steps: Step[] = [
    { id: 'method', label: 'Method' },
    { id: 'provider', label: 'Provider' },
    { id: 'usecase', label: 'Use Case' },
    { id: 'review', label: 'Review' },
    { id: 'code', label: 'Code' }
  ];

  const uploadSteps: Step[] = [
    { id: 'method', label: 'Method' },
    { id: 'upload', label: 'Upload' },
    { id: 'review', label: 'Review' },
    { id: 'code', label: 'Code' }
  ];

  // Get provider info for display
  const getProviderInfo = (provider: CloudProvider) => {
    const providers = {
      aws: {
        name: 'Amazon Web Services',
        shortName: 'AWS',
        icon: <Cloud className="w-8 h-8 text-orange-500" />,
        color: 'from-orange-500 to-yellow-500',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/30'
      },
      azure: {
        name: 'Microsoft Azure',
        shortName: 'Azure',
        icon: <Database className="w-8 h-8 text-blue-500" />,
        color: 'from-blue-500 to-blue-700',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30'
      },
      gcp: {
        name: 'Google Cloud Platform',
        shortName: 'GCP',
        icon: <Server className="w-8 h-8 text-green-500" />,
        color: 'from-green-500 to-teal-500',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30'
      },
      alicloud: {
        name: 'Alibaba Cloud',
        shortName: 'Alibaba',
        icon: <Cloud className="w-8 h-8 text-orange-400" />,
        color: 'from-orange-400 to-red-500',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/30'
      }
    };
    return providers[provider];
  };

  const handleMethodSelect = (method: 'wizard' | 'upload') => {
    setCreationMethod(method);
    if (method === 'wizard') {
      setCurrentStep('provider');
    } else {
      setCurrentStep('upload');
    }
  };
  
  const handleProviderSelect = (provider: CloudProvider) => {
    setSelectedProvider(provider);
    setCurrentStep('usecase');
  };
  
  const handleUseCaseSubmit = async (data: { title: string; description: string; requirements: string[] }) => {
    const startTime = performance.now();
    console.log(`🚀 Generating ${selectedProvider.toUpperCase()} architecture: "${data.title}"`);

    setIsGenerating(true);
    setError(null);

    try {
      // Call the real AI backend API
      const response = await api.generateArchitecture({
        title: data.title,
        description: data.description,
        requirements: data.requirements,
        provider: selectedProvider,
        optimization_goal: 'balanced'
      });

      const duration = ((performance.now() - startTime) / 1000).toFixed(1);

      // Use the AI-generated architecture from backend
      if (response.data && typeof response.data === 'object' && response.data.diagram) {
        console.log(`✅ Architecture generated in ${duration}s: ${response.data.diagram.nodes?.length || 0} nodes, ${response.data.diagram.edges?.length || 0} connections`);
        setArchitecture(response.data as ArchitectureType);
        setCurrentStep('review');
      } else {
        console.error('⚠️ Invalid response structure:', JSON.stringify(response, null, 2));
        console.error('⚠️ Expected response.data.diagram to exist. Got data keys:', response.data ? Object.keys(response.data) : 'no data');
        const hint = response.data?.architecture
          ? ' Qwen returned raw text instead of structured JSON; please retry the request.'
          : '';
        setError(`AI generated a response but it was not in the expected format.${hint} Please try again.`);
      }
    } catch (err) {
      const duration = ((performance.now() - startTime) / 1000).toFixed(1);
      console.error(`❌ Generation failed after ${duration}s:`, err);
      setError(err instanceof Error ? err.message : 'Failed to generate architecture');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleArchitectureGenerated = (generatedArchitecture: ArchitectureType) => {
    const now = new Date().toISOString();
    const normalized: ArchitectureType = {
      ...generatedArchitecture,
      description: generatedArchitecture.description || generatedArchitecture.name || '',
      alternatives: generatedArchitecture.alternatives || [],
      optimizationPreference: generatedArchitecture.optimizationPreference || 'balanced',
      diagram: generatedArchitecture.diagram || { nodes: [], edges: [], viewport: { zoom: 1, pan: { x: 0, y: 0 } }, grid: { size: 20, enabled: true, snapEnabled: false } },
      metadata: generatedArchitecture.metadata || { totalCost: 0, estimatedPerformance: 80, complexity: 'medium', tags: [], lastModified: now, version: '1.0' },
      createdAt: generatedArchitecture.createdAt || now,
      updatedAt: generatedArchitecture.updatedAt || now,
    };
    setArchitecture(normalized);
    setCurrentStep('review');
  };
  
  const handleReplaceComponent = (originalId: string, alternativeId: string) => {
    if (!architecture) return;
    
    // Find the original component and the alternative
    const originalComponent = architecture.components.find(c => c.id === originalId);
    const alternativeComponent = architecture.alternatives.find(a => a.id === alternativeId);
    
    if (!originalComponent || !alternativeComponent) return;
    
    // Create a new component based on the alternative
    const newComponent = {
      ...originalComponent,
      name: alternativeComponent.name,
      description: alternativeComponent.description,
      cost: alternativeComponent.cost
    };
    
    // Update the components array
    const updatedComponents = architecture.components.map(c => 
      c.id === originalId ? newComponent : c
    );
    
    // Remove the used alternative
    const updatedAlternatives = architecture.alternatives.filter(a => a.id !== alternativeId);
    
    // Update the architecture
    setArchitecture({
      ...architecture,
      components: updatedComponents,
      alternatives: updatedAlternatives
    });
  };
  
  const handleGoToDeployment = () => {
    navigate('/deployment', { state: { architecture } });
  };

  // Handle back button navigation
  const handleBack = () => {
    const currentSteps = creationMethod === 'upload' ? uploadSteps : steps;
    const currentIndex = currentSteps.findIndex(step => step.id === currentStep);
    
    if (currentIndex > 0) {
      const previousStep = currentSteps[currentIndex - 1];
      setCurrentStep(previousStep.id);
      
      // Reset data when going back to method selection
      if (previousStep.id === 'method') {
        setCreationMethod(null);
        setSelectedProvider(null);
        setArchitecture(null);
      }
      // Reset data when going back to provider selection
      else if (previousStep.id === 'provider') {
        setSelectedProvider(null);
        setArchitecture(null);
      }
      // Reset architecture when going back to use case or upload
      else if (previousStep.id === 'usecase' || previousStep.id === 'upload') {
        setArchitecture(null);
      }
    }
  };

  // Check if back button should be shown
  const showBackButton = currentStep !== 'method';

  const renderMethodSelection = () => (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">How would you like to create your architecture?</h2>
        <p className="text-xl text-gray-300">Choose the method that works best for you</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Guided Wizard */}
        <button
          type="button"
          className="method-card-purple w-full p-8 cursor-pointer group transition-all duration-300 text-left"
          onClick={() => handleMethodSelect('wizard')}
        >
          <div className="text-center">
            <div className="method-icon w-20 h-20 rounded-xl flex items-center justify-center mx-auto mb-6 transition-transform">
              <Wand2 className="w-10 h-10 text-blue-400" />
            </div>
            <h3 className="text-2xl font-bold mb-4">Guided Wizard</h3>
            <p className="text-gray-300 mb-6">
              Answer a few questions about your requirements and let our AI design the perfect architecture for you.
            </p>
            <ul className="text-left space-y-2 text-sm text-gray-400 mb-6">
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bullet-point rounded-full"></div>
                <span>Step-by-step guidance</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bullet-point rounded-full"></div>
                <span>AI-powered recommendations</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bullet-point rounded-full"></div>
                <span>Best practices included</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bullet-point rounded-full"></div>
                <span>Perfect for beginners</span>
              </li>
            </ul>
            <div className="action-link font-medium transition-colors">
              Start Wizard →
            </div>
          </div>
        </button>

        {/* Image Upload */}
        <button
          type="button"
          className="method-card-purple w-full p-8 cursor-pointer group transition-all duration-300 text-left"
          onClick={() => handleMethodSelect('upload')}
        >
          <div className="text-center">
            <div className="method-icon w-20 h-20 rounded-xl flex items-center justify-center mx-auto mb-6 transition-transform">
              <Brain className="w-10 h-10 text-purple-400" />
            </div>
            <h3 className="text-2xl font-bold mb-4">AI Image Analysis</h3>
            <p className="text-gray-300 mb-6">
              Upload an existing architecture diagram and let AI automatically generate the infrastructure code.
            </p>
            <ul className="text-left space-y-2 text-sm text-gray-400 mb-6">
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bullet-point rounded-full"></div>
                <span>Upload any diagram image</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bullet-point rounded-full"></div>
                <span>AI component recognition</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bullet-point rounded-full"></div>
                <span>Automatic code generation</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bullet-point rounded-full"></div>
                <span>Great for existing designs</span>
              </li>
            </ul>
            <div className="action-link font-medium transition-colors">
              Upload Image →
            </div>
          </div>
        </button>
      </div>
    </div>
  );
  
  const renderStepContent = () => {
    switch (currentStep) {
      case 'method':
        return renderMethodSelection();
        
      case 'provider':
        return (
          <ProviderSelector
            selectedProvider={selectedProvider}
            onSelect={handleProviderSelect}
          />
        );
      
      case 'usecase':
        return selectedProvider ? (
          <>
            {error && (
              <div className="max-w-4xl mx-auto mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-red-400 font-medium">Architecture Generation Failed</p>
                  <p className="text-red-300/80 text-sm mt-1">{error}</p>
                </div>
              </div>
            )}
            <UseCaseForm
              provider={selectedProvider}
              onSubmit={handleUseCaseSubmit}
              isGenerating={isGenerating}
            />
          </>
        ) : null;

      case 'upload':
        return (
          <ImageUploadAnalyzer
            onArchitectureGenerated={handleArchitectureGenerated}
          />
        );
      
      case 'review':
        if (!architecture) {
          console.error('❌ REVIEW STEP: No architecture data available!');
          console.error('  - currentStep:', currentStep);
          console.error('  - creationMethod:', creationMethod);
          console.error('  - architecture:', architecture);
          console.error('  - location.state:', location.state);
          console.error('  - storedArchitecture:', storedArchitecture);

          return (
            <div className="max-w-4xl mx-auto text-center py-16">
              <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-8">
                <h3 className="text-2xl font-bold text-red-400 mb-4">No Architecture Data Found</h3>
                <p className="text-gray-300 mb-6">
                  The architecture diagram could not be loaded. This might be due to a navigation issue.
                </p>
                <Button onClick={() => navigate('/image-analysis')} size="lg">
                  Go Back to Image Upload
                </Button>
              </div>
            </div>
          );
        }

        return (
          <div className="w-full max-w-none space-y-12">
            <ArchitectureDiagramOptimized architecture={architecture} />
            <ComponentList
              architecture={architecture}
              onReplaceComponent={handleReplaceComponent}
            />
            <div className="flex justify-end">
              <Button
                onClick={() => setCurrentStep('code')}
                size="lg"
              >
                Generate Code
              </Button>
            </div>
          </div>
        );
      
      case 'code':
        return architecture ? (
          <div className="w-full max-w-none space-y-12">
            <CodeGenerator architecture={architecture} />
            <div className="flex justify-end">
              <Button
                onClick={handleGoToDeployment}
                size="lg"
              >
                Proceed to Deployment
              </Button>
            </div>
          </div>
        ) : null;
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen text-text-primary">
      <Particles />
      <Header />
      
      <main className="w-full px-6 pt-24 pb-16">
        <div className={`w-full max-w-[95vw] mx-auto ${selectedProvider ? selectedProvider + '-theme' : ''}`}>
          {/* Header with Back Button and Provider Info */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-6">
              {showBackButton && (
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  icon={<ArrowLeft className="w-5 h-5" />}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Back
                </Button>
              )}
              
              <h1 className="text-3xl md:text-4xl font-bold">
                Let's Build with Sky Launchpad
              </h1>
            </div>
            
            {/* Selected Provider Display */}
            {selectedProvider && (
              <div className={`flex items-center space-x-4 px-6 py-3 rounded-xl backdrop-blur-xl border-2 ${getProviderInfo(selectedProvider).bgColor} ${getProviderInfo(selectedProvider).borderColor}`}>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getProviderInfo(selectedProvider).color} flex items-center justify-center`}>
                  {getProviderInfo(selectedProvider).icon}
                </div>
                <div>
                  <div className="text-sm text-gray-400">Selected Provider</div>
                  <div className="font-bold text-lg">{getProviderInfo(selectedProvider).name}</div>
                </div>
              </div>
            )}
          </div>
          
          <WizardSteps
            steps={creationMethod === 'upload' ? uploadSteps : steps}
            currentStep={currentStep}
          />
          
          <div className="mt-8 w-full">
            {renderStepContent()}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ArchitecturePage;
