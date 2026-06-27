import React, { useState } from 'react';
import { Upload, Brain, Lightbulb, ImageIcon } from 'lucide-react';
import Button from './Button';
import Card from './Card';
import '../../styles/design-tokens.css';

interface UploadAreaProps {
  onFileSelect: (file: File) => void;
  onDrop: (file: File) => void;
}

/**
 * UploadArea Component
 *
 * Provides a drag-and-drop file upload interface with visual feedback.
 * Includes tips for best results and file type restrictions.
 *
 * @param onFileSelect - Callback when user selects a file via file picker
 * @param onDrop - Callback when user drops a file
 *
 * @example
 * <UploadArea
 *   onFileSelect={(file) => handleFile(file)}
 *   onDrop={(file) => handleFile(file)}
 * />
 */
const UploadArea: React.FC<UploadAreaProps> = ({ onFileSelect, onDrop }) => {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onDrop(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleButtonClick = () => {
    document.getElementById('file-upload')?.click();
  };

  return (
    <Card variant="glass" className="p-8 upload-card-dark">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-4">
          <Brain className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-white">
          AI Architecture Analyzer
        </h2>
        <p className="text-gray-300">
          Upload an image of your cloud architecture diagram and let AI generate the infrastructure code for you
        </p>
      </div>

      {/* Drag and Drop Area */}
      <div
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all mb-6 ${
          dragActive
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-blue-600/50 hover:border-blue-500/70'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className="w-12 h-12 text-blue-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold mb-2 text-white">
          Drop your architecture diagram here
        </h3>
        <p className="text-gray-300 mb-6">
          Supports PNG, JPG, JPEG files up to 10MB
        </p>

        <input
          id="file-upload"
          type="file"
          accept="image/png,image/jpeg,image/jpg,application/pdf"
          onChange={handleFileInput}
          className="hidden"
        />
        <Button
          size="lg"
          className="upload-button"
          onClick={handleButtonClick}
          icon={<ImageIcon className="w-5 h-5" />}
        >
          Choose File
        </Button>
      </div>

      {/* Tips Section */}
      <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <Lightbulb className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-blue-400 mb-3">Tips for best results:</h4>
            <ul className="text-sm text-gray-300 space-y-2">
              <li>• Use clear, high-resolution images</li>
              <li>• Ensure component labels are visible</li>
              <li>• Include connection lines between components</li>
              <li>• Standard cloud provider icons work best</li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default UploadArea;
