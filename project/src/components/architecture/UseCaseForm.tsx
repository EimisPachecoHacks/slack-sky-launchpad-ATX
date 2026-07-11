import React, { useState, useEffect } from 'react';
import { PlusCircle, MinusCircle, Loader2, Sparkles, Brain, Cpu, DollarSign, CheckCircle2 } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import VoiceInput from '../ui/VoiceInput';
import { CloudProvider } from '../../types';

interface UseCaseFormProps {
  provider: CloudProvider;
  onSubmit: (data: { title: string; description: string; requirements: string[] }) => void;
  isGenerating?: boolean;
}

const UseCaseForm: React.FC<UseCaseFormProps> = ({ provider, onSubmit, isGenerating = false }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState<string[]>(['']);
  const [loadingStep, setLoadingStep] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const loadingSteps = [
    { icon: Brain, message: 'Analyzing your requirements...', color: 'text-blue-400' },
    { icon: Sparkles, message: 'Reasoning with Gemma 4 on the AMD MI300X...', color: 'text-purple-400' },
    { icon: Cpu, message: 'Designing optimal architecture...', color: 'text-green-400' },
    { icon: DollarSign, message: 'Calculating costs and alternatives...', color: 'text-yellow-400' },
    { icon: CheckCircle2, message: 'Finalizing recommendations...', color: 'text-emerald-400' }
  ];

  useEffect(() => {
    if (isGenerating) {
      setElapsedSeconds(0);
      const stepInterval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingSteps.length);
      }, 2000);
      const timerInterval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      return () => { clearInterval(stepInterval); clearInterval(timerInterval); };
    } else {
      setLoadingStep(0);
    }
  }, [isGenerating, loadingSteps.length]);

  const addRequirement = () => {
    setRequirements([...requirements, '']);
  };

  const removeRequirement = (index: number) => {
    const newRequirements = [...requirements];
    newRequirements.splice(index, 1);
    setRequirements(newRequirements);
  };

  const updateRequirement = (index: number, value: string) => {
    const newRequirements = [...requirements];
    newRequirements[index] = value;
    setRequirements(newRequirements);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Filter out empty requirements
    const filteredRequirements = requirements.filter(req => req.trim() !== '');
    
    onSubmit({
      title,
      description,
      requirements: filteredRequirements
    });
  };

  const getProviderName = () => {
    switch (provider) {
      case 'aws': return 'AWS';
      case 'azure': return 'Azure';
      case 'gcp': return 'GCP';
      default: return provider.toUpperCase();
    }
  };

  const currentStep = loadingSteps[loadingStep];
  const StepIcon = currentStep.icon;

  return (
    <div className={`${provider}-theme max-w-3xl mx-auto relative`}>
      <div className="component-glass-card p-8">
      <h2 className="text-2xl font-bold mb-6">Describe Your Vision. Sky Launchpad Designs</h2>
      <p className="text-text-secondary mb-6">
        Tell us what your project needs on {getProviderName()}, and Sky Launchpad will craft the blueprint for you.
      </p>

      <form onSubmit={handleSubmit} className={isGenerating ? 'pointer-events-none opacity-50' : ''}>
        <div className="mb-6">
          <label htmlFor="title" className="block text-sm font-medium text-text-secondary mb-2">
            Project Title
          </label>
          <div className="relative">
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full component-form-input rounded-lg px-4 py-2 pr-12"
              placeholder="E.g., E-commerce Platform, Data Analytics Pipeline"
              required
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <VoiceInput
                onTranscript={(text) => setTitle(text)}
              />
            </div>
          </div>
        </div>
        
        <div className="mb-6">
          <label htmlFor="description" className="block text-sm font-medium text-text-secondary mb-2">
            Project Description
          </label>
          <div className="relative">
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full component-form-input rounded-lg px-4 py-2 pr-12 min-h-[100px]"
              placeholder="Describe your project's overall purpose and goals..."
              required
            />
            <div className="absolute right-3 top-3">
              <VoiceInput
                onTranscript={(text) => setDescription(text)}
              />
            </div>
          </div>
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Requirements <span className="text-gray-500 text-xs font-normal">(Optional)</span>
          </label>

          <div className="space-y-3">
            {requirements.map((req, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={req}
                    onChange={(e) => updateRequirement(index, e.target.value)}
                    className="w-full component-form-input rounded-lg px-4 py-2 pr-12"
                    placeholder={`Requirement ${index + 1}, e.g., "Need to store user data", "Process 1M requests/day"`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <VoiceInput
                      onTranscript={(text) => updateRequirement(index, text)}
                    />
                  </div>
                </div>

                {requirements.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRequirement(index)}
                    className="text-red-400 hover:text-red-300 flex-shrink-0"
                  >
                    <MinusCircle className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRequirement}
            className="mt-3 text-blue-400 hover:text-blue-300 flex items-center space-x-2"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Add Requirement</span>
          </button>
        </div>
        
        <div className="flex justify-end">
          <Button
            type="submit"
            size="lg"
            className="component-button-primary"
            disabled={isGenerating}
            icon={isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : undefined}
          >
            {isGenerating ? 'Generating...' : 'Generate Architecture'}
          </Button>
        </div>
      </form>
      </div>

      {/* Loading Overlay */}
      {isGenerating && (
        <div className="absolute inset-0 bg-background-primary/95 backdrop-blur-sm rounded-xl flex items-center justify-center z-50">
          <div className="text-center space-y-6 p-8">
            {/* Animated Icon */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 border-4 border-blue-500/20 rounded-full animate-ping"></div>
              </div>
              <div className="relative flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center">
                  <StepIcon className={`w-12 h-12 ${currentStep.color} animate-pulse`} />
                </div>
              </div>
            </div>

            {/* Status Message */}
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-white">
                {currentStep.message}
              </h3>
              <div className="text-2xl font-mono font-bold text-blue-400">
                {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
              </div>
              <p className="text-text-secondary text-sm max-w-md">
                Gemma 4 on the AMD MI300X is analyzing your requirements and designing the optimal cloud architecture.
              </p>
            </div>

            {/* Progress Dots */}
            <div className="flex justify-center space-x-2">
              {loadingSteps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === loadingStep
                      ? 'bg-blue-400 w-8'
                      : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>

            {/* Tip */}
            <div className="pt-4 border-t border-gray-700">
              <p className="text-xs text-gray-400">
                💡 Tip: Don't close this page. The architecture will appear automatically when ready.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UseCaseForm;