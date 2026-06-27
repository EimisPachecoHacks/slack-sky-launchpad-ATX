import { useEffect, useRef, useCallback, useState } from 'react';
import { usePerformanceStore } from '../store';

// Hook for measuring component render performance
export const useRenderPerformance = (componentName: string) => {
  const startTime = useRef<number>(0);
  const { updateMetrics } = usePerformanceStore();
  
  // Debounce the updateMetrics call to prevent infinite loops
  const debouncedUpdateMetrics = useDebounce(updateMetrics, 100);

  useEffect(() => {
    startTime.current = performance.now();
    
    return () => {
      const renderTime = performance.now() - startTime.current;
      debouncedUpdateMetrics({ renderTime });
      
      // Performance logging disabled in production
    };
  }, [debouncedUpdateMetrics, componentName]);
};

// Hook for debouncing expensive operations
export const useDebounce = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
};

// Hook for throttling high-frequency events
export const useThrottle = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const throttledCallback = useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallRef.current;
    
    if (timeSinceLastCall >= delay) {
      lastCallRef.current = now;
      callback(...args);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        lastCallRef.current = Date.now();
        callback(...args);
      }, delay - timeSinceLastCall);
    }
  }, [callback, delay]) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
};

// Hook for monitoring FPS
export const useFPS = () => {
  const [fps, setFPS] = useState(0);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const animationFrame = useRef<number>();
  const { updateMetrics } = usePerformanceStore();

  const measureFPS = useCallback(() => {
    frameCount.current++;
    const currentTime = performance.now();
    
    if (currentTime - lastTime.current >= 1000) {
      const currentFPS = Math.round((frameCount.current * 1000) / (currentTime - lastTime.current));
      setFPS(currentFPS);
      updateMetrics({ fps: currentFPS });
      
      frameCount.current = 0;
      lastTime.current = currentTime;
    }
    
    animationFrame.current = requestAnimationFrame(measureFPS);
  }, [updateMetrics]);

  useEffect(() => {
    animationFrame.current = requestAnimationFrame(measureFPS);
    
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [measureFPS]);

  return fps;
};

// Hook for memory usage monitoring
export const useMemoryMonitoring = () => {
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null>(null);

  useEffect(() => {
    const checkMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMemoryInfo({
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        });
      }
    };

    checkMemory();
    const interval = setInterval(checkMemory, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return memoryInfo;
};

// Hook for virtualization support
export const useVirtualization = <T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  buffer: number = 5
) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleRange = {
    start: Math.max(0, Math.floor(scrollTop / itemHeight) - buffer),
    end: Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + buffer
    )
  };

  const visibleItems = items.slice(visibleRange.start, visibleRange.end + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.start * itemHeight;

  return {
    visibleItems,
    totalHeight,
    offsetY,
    setScrollTop,
    visibleRange
  };
};

// Hook for lazy loading
export const useLazyLoading = <T>(
  loadFunction: () => Promise<T>,
  dependencies: any[] = []
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await loadFunction();
      
      if (mountedRef.current) {
        setData(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err as Error);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [loadFunction]);

  useEffect(() => {
    load();
  }, dependencies);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { data, loading, error, reload: load };
};

// Hook for intersection observer (lazy rendering)
export const useIntersectionObserver = (
  options: IntersectionObserverInit = {}
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        setEntry(entry);
      },
      options
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [options]);

  return { elementRef, isIntersecting, entry };
};

// Hook for performance monitoring and optimization suggestions
export const usePerformanceOptimization = () => {
  const { metrics, optimizations, setOptimizations } = usePerformanceStore();
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const newSuggestions: string[] = [];

    // Check render performance
    if (metrics.renderTime > 16) { // Target 60fps (16ms per frame)
      newSuggestions.push('Consider enabling virtualization for better render performance');
    }

    // Check node count
    if (metrics.nodeCount > 50) {
      newSuggestions.push('Large number of nodes detected. Consider using node clustering or pagination');
    }

    // Check FPS
    if (metrics.fps < 30) {
      newSuggestions.push('Low FPS detected. Consider reducing visual effects or enabling performance mode');
    }

    setSuggestions(newSuggestions);
  }, [metrics, optimizations]);

  return {
    metrics,
    suggestions,
    optimizations
  };
};

// Hook for automatic performance optimization
export const useAutoOptimization = () => {
  const { metrics, optimizations, setOptimizations } = usePerformanceStore();

  useEffect(() => {
    const currentOptimizations = usePerformanceStore.getState().optimizations;

    // Auto-enable virtualization for large datasets
    if (metrics.nodeCount > 100 && !currentOptimizations.useVirtualization) {
      setOptimizations({ useVirtualization: true });
    }

    // Adjust debounce interval based on performance
    if (metrics.renderTime > 32) { // If render time is too high
      const newInterval = Math.max(currentOptimizations.debounceInterval * 1.5, 100);
      if (newInterval !== currentOptimizations.debounceInterval) {
        setOptimizations({ debounceInterval: newInterval });
      }
    } else if (metrics.renderTime < 8) { // If performance is good
      const newInterval = Math.max(currentOptimizations.debounceInterval * 0.9, 16);
      if (newInterval !== currentOptimizations.debounceInterval) {
        setOptimizations({ debounceInterval: newInterval });
      }
    }

    // Reduce max render nodes if FPS is low
    if (metrics.fps < 30 && currentOptimizations.maxRenderNodes > 50) {
      const newMaxNodes = Math.max(currentOptimizations.maxRenderNodes * 0.8, 50);
      if (newMaxNodes !== currentOptimizations.maxRenderNodes) {
        setOptimizations({ maxRenderNodes: newMaxNodes });
      }
    }
  }, [metrics]);
};

// Hook for measuring custom metrics
export const useCustomMetrics = () => {
  const startMeasure = useCallback((name: string) => {
    performance.mark(`${name}-start`);
  }, []);

  const endMeasure = useCallback((name: string) => {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    const measure = performance.getEntriesByName(name, 'measure')[0];
    const duration = measure?.duration || 0;
    
    // Clean up marks
    performance.clearMarks(`${name}-start`);
    performance.clearMarks(`${name}-end`);
    performance.clearMeasures(name);
    
    return duration;
  }, []);

  return { startMeasure, endMeasure };
};