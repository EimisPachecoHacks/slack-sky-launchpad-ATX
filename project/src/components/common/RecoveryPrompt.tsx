import React from 'react';
import type { Architecture } from '../../types';

interface RecoveryPromptProps {
  show: boolean;
  recoveryData: Architecture | null;
  onRecover: () => void;
  onDismiss: () => void;
}

const RecoveryPrompt: React.FC<RecoveryPromptProps> = ({
  show,
  recoveryData,
  onRecover,
  onDismiss
}) => {
  if (!show || !recoveryData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background-card rounded-lg shadow-xl max-w-md w-full mx-4 border border-border-secondary">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0">
              <svg className="h-8 w-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-text-primary">
                Recover Your Work
              </h3>
              <p className="text-sm text-text-secondary">
                We found unsaved changes from your previous session.
              </p>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-text-secondary">
              Would you like to recover your architecture diagram? This will restore:
            </p>
            <ul className="mt-2 text-sm text-text-secondary list-disc list-inside">
              <li>{recoveryData.diagram.nodes.length} components</li>
              <li>{recoveryData.diagram.edges.length} connections</li>
              <li>All positioning and configurations</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onRecover}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
            >
              Recover
            </button>
            <button
              onClick={onDismiss}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
            >
              Start Fresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecoveryPrompt;