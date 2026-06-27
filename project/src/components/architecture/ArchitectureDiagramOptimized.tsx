import React, { memo, useCallback, useEffect } from 'react';
import ReactFlowDiagram from './diagram/ReactFlowDiagram';
import DiagramToolbar from './diagram/DiagramToolbar';
import DesignPanel from './diagram/DesignPanel';
import { useArchitectureStore, useUIStore } from '../../store';
import { useRenderPerformance, useAutoOptimization } from '../../hooks/usePerformance';
import type { Architecture } from '../../types';

interface ArchitectureDiagramOptimizedProps {
  architecture: Architecture;
}

const ArchitectureDiagramOptimized: React.FC<ArchitectureDiagramOptimizedProps> = memo(({
  architecture
}) => {
  useRenderPerformance('ArchitectureDiagramOptimized');
  useAutoOptimization(); // Automatically optimize performance based on metrics

  const { setCurrentArchitecture, markSaved } = useArchitectureStore();
  const { fullscreenMode } = useUIStore();

  // Set current architecture when component mounts
  useEffect(() => {
    setCurrentArchitecture(architecture);
  }, [architecture, setCurrentArchitecture]);

  const handleSave = useCallback(() => {
    const diagramData = {
      architecture,
      timestamp: new Date().toISOString()
    };
    console.log('Saving diagram:', diagramData);
    markSaved();
    
    // In a real app, this would make an API call
    // await api.saveArchitecture(diagramData);
  }, [architecture, markSaved]);

  const handleReset = useCallback(() => {
    // Reset to original state
    const resetArchitecture: Architecture = {
      ...architecture,
      diagram: {
        nodes: [
          {
            id: 'node-1',
            x: 150,
            y: 80,
            width: 200,
            height: 100,
            label: architecture.provider === 'aws' ? 'EC2 Instance' : 
                   architecture.provider === 'azure' ? 'Virtual Machine' : 'Compute Engine',
            subLabel: 'Compute service',
            icon: '💻',
            cost: 29.2,
            description: 'Primary application server',
            isDragging: false,
            type: 'compute',
            provider: architecture.provider
          },
          {
            id: 'node-2',
            x: 450,
            y: 80,
            width: 200,
            height: 100,
            label: architecture.provider === 'aws' ? 'S3 Bucket' : 
                   architecture.provider === 'azure' ? 'Blob Storage' : 'Cloud Storage',
            subLabel: 'Object storage',
            icon: '💾',
            cost: 12.5,
            description: 'Static assets and data files',
            isDragging: false,
            type: 'storage',
            provider: architecture.provider
          },
          {
            id: 'node-3',
            x: 150,
            y: 250,
            width: 200,
            height: 100,
            label: architecture.provider === 'aws' ? 'RDS Database' : 
                   architecture.provider === 'azure' ? 'Azure SQL' : 'Cloud SQL',
            subLabel: 'Database service',
            icon: '🗄️',
            cost: 45.8,
            description: 'Relational database',
            isDragging: false,
            type: 'database',
            provider: architecture.provider
          },
          {
            id: 'node-4',
            x: 450,
            y: 250,
            width: 200,
            height: 100,
            label: architecture.provider === 'aws' ? 'Lambda Function' : 
                   architecture.provider === 'azure' ? 'Function App' : 'Cloud Functions',
            subLabel: 'Serverless compute',
            icon: 'λ',
            cost: 8.3,
            description: 'Event-driven functions',
            isDragging: false,
            type: 'serverless',
            provider: architecture.provider
          }
        ],
        edges: [
          { id: 'edge-1', from: 'node-1', to: 'node-2', type: 'HTTP/HTTPS' },
          { id: 'edge-2', from: 'node-1', to: 'node-3', type: 'Database' },
          { id: 'edge-3', from: 'node-2', to: 'node-4', type: 'Event' },
          { id: 'edge-4', from: 'node-3', to: 'node-4', type: 'Database' }
        ],
        viewport: {
          zoom: 1,
          pan: { x: 0, y: 0 },
          bounds: { x: 0, y: 0, width: 800, height: 600 }
        },
        grid: {
          size: 20,
          enabled: true,
          snapEnabled: false
        }
      }
    };
    
    setCurrentArchitecture(resetArchitecture);
  }, [architecture, setCurrentArchitecture]);

  const handleExport = useCallback(async (format: 'pdf' | 'png') => {
    if (format === 'png') {
      // For PNG export, we'd typically use html2canvas or similar
      console.log('Exporting as PNG...');
      
      // Mock implementation - in real app would use proper export library
      const link = document.createElement('a');
      link.download = `architecture-diagram-${architecture.provider}.png`;
      // link.href = canvas.toDataURL('image/png');
      // link.click();
    } else if (format === 'pdf') {
      console.log('Exporting as PDF...');
      // For PDF, would use jsPDF or similar
    }
  }, [architecture.provider]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      // Handle fullscreen state changes if needed
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className="w-full">
      {/* Project Information Container - Above Diagram */}
      {!fullscreenMode && (
        <div className="component-glass-card p-4 lg:p-6 mb-4 lg:mb-6 w-full">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between space-y-4 lg:space-y-0">
            <div className="flex-1">
              <h2 className="text-xl lg:text-2xl font-bold text-white mb-2">
                {architecture.name}
              </h2>
              <p className="text-gray-300 leading-relaxed text-sm lg:text-base">
                {architecture.description}
              </p>
            </div>
            <div className="flex items-center space-x-4 lg:ml-6">
              <div className="text-center lg:text-right">
                <div className="text-xs lg:text-sm text-gray-400">Provider</div>
                <div className="text-sm lg:text-lg font-bold text-blue-400">
                  {architecture.provider.toUpperCase()}
                </div>
              </div>
              <div className="text-center lg:text-right">
                <div className="text-xs lg:text-sm text-gray-400">Components</div>
                <div className="text-sm lg:text-lg font-bold text-green-400">
                  {architecture.diagram.nodes.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout: Fixed Height Grid with Exact Matching Heights */}
      <div className="flex flex-col xl:grid xl:grid-cols-12 gap-4 lg:gap-6">
        
        {/* LEFT PANEL: DESIGN PANEL - Much Narrower (3 cols) */}
        <div className="xl:col-span-3 order-2 xl:order-1">
          <DesignPanel />
        </div>

        {/* RIGHT PANEL: ARCHITECTURE DIAGRAM - Much Wider (9 cols) */}
        <div className="xl:col-span-9 order-1 xl:order-2">
          <div className={`w-full transition-all duration-300 h-[640px] flex flex-col component-glass-card ${
            fullscreenMode
              ? 'fixed inset-0 z-50 rounded-none bg-background-primary backdrop-blur-xl'
              : ''
          }`}>
            <DiagramToolbar
              architecture={architecture}
              onSave={handleSave}
              onReset={handleReset}
              onExport={handleExport}
            />

            <ReactFlowDiagram
              architecture={architecture}
              className={`flex-1 ${fullscreenMode ? '' : 'rounded-b-xl border-t-0'}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

ArchitectureDiagramOptimized.displayName = 'ArchitectureDiagramOptimized';

export default ArchitectureDiagramOptimized;