import React from 'react';
import { Check } from 'lucide-react';
import '../../styles/design-tokens.css';

export interface Step {
  number: number;
  label: string;
}

interface StepProgressProps {
  steps: Step[];
  currentStep: number;
}

/**
 * StepProgress Component
 *
 * Displays a horizontal step indicator showing progress through a multi-step process.
 *
 * @param steps - Array of step objects with number and label
 * @param currentStep - The currently active step number
 *
 * @example
 * <StepProgress
 *   steps={[
 *     { number: 1, label: 'Method' },
 *     { number: 2, label: 'Upload' },
 *     { number: 3, label: 'Review' },
 *     { number: 4, label: 'Code' }
 *   ]}
 *   currentStep={2}
 * />
 */
const StepProgress: React.FC<StepProgressProps> = ({ steps, currentStep }) => {
  return (
    <div className="step-progress mb-12">
      {steps.map((step, index) => (
        <React.Fragment key={step.number}>
          {/* Step Circle */}
          <div className="flex flex-col items-center">
            <div
              className={`step-circle ${
                currentStep === step.number
                  ? 'active'
                  : currentStep > step.number
                  ? 'completed'
                  : 'inactive'
              }`}
            >
              {currentStep > step.number ? (
                <Check className="w-6 h-6" />
              ) : (
                step.number
              )}
            </div>
            <span
              className={`step-label ${
                currentStep >= step.number ? 'active' : 'inactive'
              }`}
            >
              {step.label}
            </span>
          </div>

          {/* Connector Line */}
          {index < steps.length - 1 && (
            <div
              className={`step-connector mb-6 ${
                currentStep > step.number ? 'active' : 'inactive'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default StepProgress;
