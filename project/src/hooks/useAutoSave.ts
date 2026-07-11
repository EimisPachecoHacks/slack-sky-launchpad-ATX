import { useEffect, useRef, useCallback, useState } from 'react';
import { useArchitectureStore, usePreferencesStore } from '../store';
import { useDebounce } from './usePerformance';
import type { Architecture } from '../types';

interface UseAutoSaveOptions {
  interval?: number; // Auto-save interval in milliseconds
  debounceDelay?: number; // Debounce delay for changes
  enabled?: boolean;
  onSave?: (architecture: Architecture) => Promise<void> | void;
  onError?: (error: Error) => void;
  storageKey?: string;
}

interface AutoSaveState {
  lastSaved: string | null;
  saving: boolean;
  error: string | null;
  pendingChanges: boolean;
}

export const useAutoSave = (options: UseAutoSaveOptions = {}) => {
  const {
    interval = 30000, // 30 seconds default
    debounceDelay = 2000, // 2 seconds debounce
    enabled = true,
    onSave,
    onError,
    storageKey = 'skyrchitect-autosave'
  } = options;

  const { current: architecture, unsavedChanges, markSaved } = useArchitectureStore();
  const { preferences } = usePreferencesStore();
  const autoSaveEnabled = enabled && preferences.ui.autoSave;

  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>({
    lastSaved: null,
    saving: false,
    error: null,
    pendingChanges: false
  });

  const intervalRef = useRef<NodeJS.Timeout>();
  const lastArchitectureRef = useRef<string>('');

  // Save function
  const saveArchitecture = useCallback(async (arch: Architecture) => {
    if (!arch) return;

    setAutoSaveState(prev => ({ ...prev, saving: true, error: null }));

    try {
      if (onSave) {
        await onSave(arch);
      } else {
        // Default: save to localStorage
        localStorage.setItem(storageKey, JSON.stringify({
          architecture: arch,
          timestamp: new Date().toISOString(),
          version: '1.0'
        }));
      }

      setAutoSaveState(prev => ({
        ...prev,
        saving: false,
        lastSaved: new Date().toISOString(),
        pendingChanges: false,
        error: null
      }));

      markSaved();
      console.log('[AutoSave] Architecture saved successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setAutoSaveState(prev => ({
        ...prev,
        saving: false,
        error: errorMessage
      }));

      console.error('[AutoSave] Failed to save architecture:', error);
      onError?.(error as Error);
    }
  }, [onSave, storageKey, markSaved, onError]);

  // Debounced save function
  const debouncedSave = useDebounce(saveArchitecture, debounceDelay);

  // Check for changes and trigger auto-save
  const checkForChanges = useCallback(() => {
    if (!architecture || !autoSaveEnabled) return;

    const currentArchitectureString = JSON.stringify(architecture);
    const hasChanges = currentArchitectureString !== lastArchitectureRef.current;

    if (hasChanges) {
      setAutoSaveState(prev => ({ ...prev, pendingChanges: true }));
      lastArchitectureRef.current = currentArchitectureString;
      debouncedSave(architecture);
    }
  }, [architecture, autoSaveEnabled, debouncedSave]);

  // Manual save function
  const saveNow = useCallback(async () => {
    if (architecture) {
      await saveArchitecture(architecture);
    }
  }, [architecture, saveArchitecture]);

  // Load saved architecture
  const loadSavedArchitecture = useCallback((): Architecture | null => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        return data.architecture;
      }
    } catch (error) {
      console.error('[AutoSave] Failed to load saved architecture:', error);
    }
    return null;
  }, [storageKey]);

  // Clear saved data
  const clearSavedData = useCallback(() => {
    localStorage.removeItem(storageKey);
    setAutoSaveState(prev => ({
      ...prev,
      lastSaved: null,
      pendingChanges: false,
      error: null
    }));
  }, [storageKey]);

  // Get save info
  const getSaveInfo = useCallback(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        return {
          timestamp: data.timestamp,
          version: data.version,
          hasData: true
        };
      }
    } catch (error) {
      console.error('[AutoSave] Failed to get save info:', error);
    }
    return {
      timestamp: null,
      version: null,
      hasData: false
    };
  }, [storageKey]);

  // Set up interval-based auto-save
  useEffect(() => {
    if (!autoSaveEnabled || !architecture) return;

    intervalRef.current = setInterval(() => {
      if (unsavedChanges) {
        saveArchitecture(architecture);
      }
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoSaveEnabled, architecture, unsavedChanges, interval, saveArchitecture]);

  // Watch for changes
  useEffect(() => {
    if (autoSaveEnabled) {
      checkForChanges();
    }
  }, [architecture, autoSaveEnabled, checkForChanges]);

  // Handle page visibility changes (save when page becomes hidden)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && architecture && unsavedChanges) {
        saveArchitecture(architecture);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [architecture, unsavedChanges, saveArchitecture]);

  // Handle beforeunload (save before page unload)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (unsavedChanges) {
        // Attempt synchronous save
        try {
          if (architecture) {
            localStorage.setItem(storageKey, JSON.stringify({
              architecture,
              timestamp: new Date().toISOString(),
              version: '1.0'
            }));
          }
        } catch (error) {
          console.error('[AutoSave] Emergency save failed:', error);
        }

        // Show warning to user
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return event.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [unsavedChanges, architecture, storageKey]);

  return {
    // State
    ...autoSaveState,
    autoSaveEnabled,
    
    // Actions
    saveNow,
    loadSavedArchitecture,
    clearSavedData,
    getSaveInfo,
    
    // Utils
    hasUnsavedChanges: unsavedChanges,
    timeSinceLastSave: autoSaveState.lastSaved 
      ? Date.now() - new Date(autoSaveState.lastSaved).getTime()
      : null
  };
};

// Hook for recovery mode (detecting and recovering from crashes)
export const useRecoveryMode = () => {
  const [recoveryData, setRecoveryData] = useState<Architecture | null>(null);
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false);
  const { setCurrentArchitecture } = useArchitectureStore();

  // Offer recovery at most ONCE per browser-tab session. The old logic removed
  // its session marker on every unmount and re-showed on every remount/reload,
  // so the modal reappeared endlessly (and on each page the tester navigated
  // to). A sessionStorage guard makes it fire once per tab, then stay quiet
  // until the tab is closed — regardless of remounts, reloads, or navigation.
  useEffect(() => {
    const PROMPTED_KEY = 'skyrchitect-recovery-prompted';
    if (sessionStorage.getItem(PROMPTED_KEY)) return;

    try {
      const autoSaveData = localStorage.getItem('skyrchitect-autosave');
      if (autoSaveData) {
        const data = JSON.parse(autoSaveData);
        const saveTime = new Date(data.timestamp).getTime();
        // Only offer to restore a recent (< 1 hour) auto-save.
        if (Date.now() - saveTime < 3600000 && data.architecture) {
          setRecoveryData(data.architecture);
          setShowRecoveryPrompt(true);
        }
      }
    } catch (error) {
      console.error('[Recovery] Failed to check for recovery data:', error);
    } finally {
      // Mark prompted for this tab session even if nothing was shown, so a
      // background auto-save written moments later can't trigger a late prompt.
      sessionStorage.setItem(PROMPTED_KEY, 'true');
    }
  }, []);

  const recoverArchitecture = useCallback(() => {
    if (recoveryData) {
      setCurrentArchitecture(recoveryData);
      setShowRecoveryPrompt(false);
      console.log('[Recovery] Architecture recovered successfully');
    }
  }, [recoveryData, setCurrentArchitecture]);

  const dismissRecovery = useCallback(() => {
    setShowRecoveryPrompt(false);
    setRecoveryData(null);
    localStorage.removeItem('skyrchitect-autosave');
  }, []);

  return {
    recoveryData,
    showRecoveryPrompt,
    recoverArchitecture,
    dismissRecovery
  };
};