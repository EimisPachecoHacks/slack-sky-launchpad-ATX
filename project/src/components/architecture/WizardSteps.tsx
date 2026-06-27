import React from 'react';
import { Check, ChevronRight } from 'lucide-react';

export type Step = {
  id: string;
  label: string;
};

interface WizardStepsProps {
  steps: Step[];
  currentStep: string;
  onSelectStep?: (stepId: string) => void;
}

const WizardSteps: React.FC<WizardStepsProps> = ({ 
  steps, 
  currentStep,
  onSelectStep 
}) => {
  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.id === currentStep);
  };

  const isStepCompleted = (stepId: string) => {
    const currentIndex = getCurrentStepIndex();
    const stepIndex = steps.findIndex(step => step.id === stepId);
    return stepIndex < currentIndex;
  };
  
  const isStepCurrent = (stepId: string) => {
    return stepId === currentStep;
  };

  return (
    <div className="py-6">
      <div className="flex items-center justify-center">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div 
              className={`flex flex-col items-center ${onSelectStep ? 'cursor-pointer' : ''}`}
              onClick={() => onSelectStep && onSelectStep(step.id)}
            >
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors
                  ${isStepCompleted(step.id) 
                    ? 'bg-blue-500 text-white' 
                    : isStepCurrent(step.id)
                      ? 'bg-blue-900 text-blue-300 border-2 border-blue-500'
                      : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}
              >
                {isStepCompleted(step.id) ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span 
                className={`text-sm font-medium
                  ${isStepCompleted(step.id) || isStepCurrent(step.id)
                    ? 'text-white'
                    : 'text-gray-500'
                  }`}
              >
                {step.label}
              </span>
            </div>
            
            {index < steps.length - 1 && (
              <div className={`w-12 h-0.5 mx-1 
                ${getCurrentStepIndex() > index ? 'bg-blue-500' : 'bg-gray-700'}`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default WizardSteps;