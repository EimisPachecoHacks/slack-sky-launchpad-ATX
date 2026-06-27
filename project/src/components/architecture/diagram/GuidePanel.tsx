import React, { memo } from 'react';
import { useArchitectureStore } from '../../../store';
import { usePerformanceOptimization } from '../../../hooks/usePerformance';

const GuidePanel: React.FC = memo(() => {
  const { current: architecture } = useArchitectureStore();
  const { metrics, suggestions } = usePerformanceOptimization();

  const totalCost = architecture?.diagram.nodes.reduce((sum, node) => sum + node.cost, 0) || 0;
  const nodeCount = architecture?.diagram.nodes.length || 0;
  const edgeCount = architecture?.diagram.edges.length || 0;

  return (
    <div className="space-y-4">
      {/* Interaction Guide */}
      <div className="bg-background-secondary backdrop-blur-xl border border-blue-500/30 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-blue-400 mb-2">Interaction Guide</h4>
        <div className="text-xs text-text-secondary space-y-1">
          <div>• <strong>Click:</strong> Select components</div>
          <div>• <strong>Drag:</strong> Move components around</div>
          <div>• <strong>Ctrl+Click:</strong> Multi-select</div>
          <div>• <strong>Auto-connect:</strong> Connections follow components</div>
        </div>
      </div>

      {/* Architecture Statistics */}
      <div className="bg-background-secondary backdrop-blur-xl border border-green-500/30 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-green-400 mb-2">Architecture Stats</h4>
        <div className="text-xs text-text-secondary space-y-1">
          <div className="flex justify-between">
            <span>Components:</span>
            <span className="text-text-primary font-semibold">{nodeCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Connections:</span>
            <span className="text-text-primary font-semibold">{edgeCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Cost:</span>
            <span className="text-green-400 font-semibold">${totalCost.toFixed(2)}/mo</span>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-background-secondary backdrop-blur-xl border border-yellow-500/30 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-yellow-400 mb-2">Performance</h4>
        <div className="text-xs text-text-secondary space-y-1">
          <div className="flex justify-between">
            <span>Render Time:</span>
            <span className="text-text-primary font-semibold">{metrics.renderTime.toFixed(1)}ms</span>
          </div>
          <div className="flex justify-between">
            <span>FPS:</span>
            <span className={`font-semibold ${metrics.fps > 30 ? 'text-green-400' : 'text-red-400'}`}>
              {metrics.fps}
            </span>
          </div>
        </div>
      </div>

      {/* Optimization Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-background-secondary backdrop-blur-xl border border-orange-500/30 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-orange-400 mb-2">Suggestions</h4>
          <div className="text-xs text-text-secondary space-y-1">
            {suggestions.slice(0, 3).map((suggestion, index) => (
              <div key={index} className="text-orange-300">
                • {suggestion}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts */}
      <div className="bg-background-secondary backdrop-blur-xl border border-purple-500/30 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-purple-400 mb-2">Shortcuts</h4>
        <div className="text-xs text-text-secondary space-y-1">
          <div>• <strong>Ctrl+S:</strong> Save diagram</div>
          <div>• <strong>Ctrl+Z:</strong> Undo</div>
          <div>• <strong>Ctrl+Y:</strong> Redo</div>
          <div>• <strong>Delete:</strong> Remove selected</div>
          <div>• <strong>F11:</strong> Fullscreen</div>
        </div>
      </div>
    </div>
  );
});

GuidePanel.displayName = 'GuidePanel';

export default GuidePanel;