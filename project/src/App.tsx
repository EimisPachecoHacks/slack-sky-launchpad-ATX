import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useTheme } from './hooks/useTheme';
import { useKeyboardShortcuts, useShortcutsHelp } from './hooks/useKeyboardShortcuts';
import { useAutoSave, useRecoveryMode } from './hooks/useAutoSave';
import { useFPS, useAutoOptimization } from './hooks/usePerformance';
import ErrorBoundary from './components/common/ErrorBoundary';
import RecoveryPrompt from './components/common/RecoveryPrompt';
import ShortcutsHelpModal from './components/common/ShortcutsHelpModal';
import Particles from './components/ui/Particles';
import Home from './pages/Home';
import Features from './pages/Features';
import Pricing from './pages/Pricing';
import Resources from './pages/Resources';
import About from './pages/About';
import Contact from './pages/Contact';
import Architecture from './pages/Architecture';
import Deployment from './pages/Deployment';
import ImageAnalysis from './pages/ImageAnalysis';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import SignUp from './pages/SignUp';
import SignIn from './pages/SignIn';
import ForgotPassword from './pages/ForgotPassword';

// Performance monitoring component for development
const PerformanceMonitor: React.FC = () => {
  const fps = useFPS();
  
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-black/80 text-white text-xs p-2 rounded flex items-center space-x-2">
      <span>FPS: {fps}</span>
      <span>•</span>
      <span>DEV MODE</span>
    </div>
  );
};

function App() {
  const { theme } = useTheme();
  
  // Enable keyboard shortcuts
  useKeyboardShortcuts({ enabled: true });
  
  // Auto-save functionality
  const autoSave = useAutoSave({
    enabled: true,
    interval: 30000, // 30 seconds
    debounceDelay: 2000 // 2 seconds
  });
  
  // Recovery mode for crash detection
  const recovery = useRecoveryMode();
  
  // Shortcuts help modal
  const shortcuts = useShortcutsHelp();
  
  // Auto performance optimization
  useAutoOptimization();

  // Initialize theme on app load
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  // Add global keyboard shortcut to show help
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '?' && event.shiftKey) {
        // Show shortcuts help
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ErrorBoundary componentName="App" showErrorDetails={process.env.NODE_ENV === 'development'}>
      <BrowserRouter>
        <div className="min-h-screen bg-background-primary overflow-hidden relative">
          {/* White background for light mode, gradient for dark mode */}
          <div className="fixed inset-0 z-0">
            <div className="absolute inset-0 light:bg-white dark:bg-gradient-to-br dark:from-background-primary dark:via-background-secondary dark:to-background-tertiary" />
            {/* Subtle gradient overlay for light mode depth */}
            <div className="absolute inset-0 light:bg-gradient-to-br light:from-blue-50/30 light:via-transparent light:to-purple-50/30 dark:from-transparent dark:via-transparent dark:to-transparent" />
          </div>
          
          {/* Particles layer - visible in both modes */}
          <div className="fixed inset-0 z-0">
            <Particles />
          </div>
          <PerformanceMonitor />
          
          {/* Auto-save indicator */}
          {autoSave.saving && (
            <div className="fixed top-4 left-4 z-50 bg-blue-600 text-white text-xs px-3 py-1 rounded-full flex items-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span>Saving...</span>
            </div>
          )}

          {/* Unsaved changes indicator */}
          {autoSave.hasUnsavedChanges && !autoSave.saving && (
            <div className="fixed top-4 left-4 z-50 bg-yellow-600 text-white text-xs px-3 py-1 rounded-full flex items-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full" />
              <span>Unsaved changes</span>
            </div>
          )}

          <div className="relative z-10">
            <Routes>
              <Route path="/" element={<Home />} />
            <Route path="/features" element={<Features />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/architecture" element={<Architecture />} />
            <Route path="/architecture/:id" element={<Architecture />} />
            <Route path="/image-analysis" element={<ImageAnalysis />} />
            <Route path="/deployment" element={<Deployment />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            </Routes>
          </div>

          {/* Recovery prompt modal */}
          <RecoveryPrompt
            show={recovery.showRecoveryPrompt}
            recoveryData={recovery.recoveryData}
            onRecover={recovery.recoverArchitecture}
            onDismiss={recovery.dismissRecovery}
          />
          
          {/* Keyboard shortcuts help modal */}
          <ShortcutsHelpModal
            show={shortcuts.showHelp}
            onClose={shortcuts.closeHelp}
          />
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;