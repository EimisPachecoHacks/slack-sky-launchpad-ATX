import React, { memo } from 'react';
import { useCanvas, useCanvasInteractions } from '../../../hooks/useCanvas';
import { useRenderPerformance } from '../../../hooks/usePerformance';
import type { Architecture } from '../../../types';

interface DiagramCanvasProps {
  architecture: Architecture;
  className?: string;
}

const DiagramCanvas: React.FC<DiagramCanvasProps> = memo(({ architecture, className = '' }) => {
  useRenderPerformance('DiagramCanvas');
  
  const canvas = useCanvas({
    enableGrid: true,
    enableSnap: true
  });
  
  const interactions = useCanvasInteractions();

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    interactions.handleMouseDown(event, canvas);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    interactions.handleMouseMove(event, canvas);
  };

  const handleMouseUp = () => {
    interactions.handleMouseUp();
  };

  if (!canvas.isReady) {
    return (
      <div className={`${className} flex items-center justify-center bg-background-secondary`}>
        <div className="text-text-primary opacity-75">Loading canvas...</div>
      </div>
    );
  }

  return (
    <div 
      ref={canvas.containerRef}
      className={`${className} bg-background-secondary overflow-hidden relative`}
    >
      <canvas
        ref={canvas.canvasRef}
        className="w-full h-full cursor-pointer"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
});

DiagramCanvas.displayName = 'DiagramCanvas';

export default DiagramCanvas;