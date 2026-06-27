import React, { memo, useState } from 'react';
import { Save, RotateCcw, Maximize2, Minimize2, Download, ChevronDown } from 'lucide-react';
import Button from '../../ui/Button';
import { useUIStore } from '../../../store';
import type { Architecture } from '../../../types';

interface DiagramToolbarProps {
  architecture: Architecture;
  onSave: () => void;
  onReset: () => void;
  onExport: (format: 'pdf' | 'png') => void;
}

const DiagramToolbar: React.FC<DiagramToolbarProps> = memo(({ 
  architecture, 
  onSave, 
  onReset, 
  onExport 
}) => {
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const { fullscreenMode, setFullscreenMode } = useUIStore();

  const toggleFullscreen = () => {
    setFullscreenMode(!fullscreenMode);
    
    if (!fullscreenMode) {
      const element = document.documentElement;
      if (element.requestFullscreen) {
        element.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleExport = (format: 'pdf' | 'png') => {
    onExport(format);
    setShowExportDropdown(false);
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between p-4 lg:p-6 border-b border-blue-500/20">
      <h3 className="text-xl lg:text-2xl font-bold mb-4 lg:mb-0">Architecture Diagram</h3>
      
      <div className="flex flex-wrap items-center gap-2 lg:gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSave}
          icon={<Save className="w-3 h-3 lg:w-4 lg:h-4 text-green-400" />}
          className="!text-green-400 hover:!text-green-300 text-xs lg:text-sm"
        >
          Save
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          icon={<RotateCcw className="w-3 h-3 lg:w-4 lg:h-4 text-yellow-400" />}
          className="!text-yellow-400 hover:!text-yellow-300 text-xs lg:text-sm"
        >
          Reset
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleFullscreen}
          icon={fullscreenMode ? <Minimize2 className="w-3 h-3 lg:w-4 lg:h-4 text-purple-400" /> : <Maximize2 className="w-3 h-3 lg:w-4 lg:h-4 text-purple-400" />}
          className="!text-purple-400 hover:!text-purple-300 text-xs lg:text-sm"
        >
          {fullscreenMode ? 'Exit' : 'Fullscreen'}
        </Button>

        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowExportDropdown(!showExportDropdown);
            }}
            icon={<Download className="w-3 h-3 lg:w-4 lg:h-4 text-blue-400" />}
            className="!text-blue-400 hover:!text-blue-300 flex items-center space-x-1 text-xs lg:text-sm"
          >
            <span>Export</span>
            <ChevronDown className={`w-2 h-2 lg:w-3 lg:h-3 transition-transform ${showExportDropdown ? 'rotate-180' : ''}`} />
          </Button>
          
          {showExportDropdown && (
            <div className="absolute right-0 top-full mt-2 w-32 bg-background-card backdrop-blur-xl border border-border-secondary rounded-lg shadow-lg z-50">
              <div className="py-2">
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full px-4 py-2 text-left text-xs lg:text-sm text-text-secondary hover:bg-surface-hover hover:text-blue-400 transition-colors"
                >
                  Export as PDF
                </button>
                <button
                  onClick={() => handleExport('png')}
                  className="w-full px-4 py-2 text-left text-xs lg:text-sm text-text-secondary hover:bg-surface-hover hover:text-blue-400 transition-colors"
                >
                  Export as PNG
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

DiagramToolbar.displayName = 'DiagramToolbar';

export default DiagramToolbar;