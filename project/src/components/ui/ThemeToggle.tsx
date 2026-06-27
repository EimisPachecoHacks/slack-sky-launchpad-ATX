import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface ThemeToggleProps {
  variant?: 'button' | 'switch' | 'dropdown';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  variant = 'button', 
  size = 'md',
  showLabel = false 
}) => {
  const { theme, toggleTheme, setLightTheme, setDarkTheme, isLight, isDark } = useTheme();

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const buttonSizeClasses = {
    sm: 'p-2',
    md: 'p-2.5',
    lg: 'p-3'
  };

  if (variant === 'switch') {
    return (
      <div className="flex items-center space-x-3">
        {showLabel && (
          <span className="text-sm font-medium text-text-secondary">
            Theme
          </span>
        )}
        <div className="flex items-center space-x-2">
          <Sun className={`${sizeClasses[size]} ${isLight ? 'text-text-accent' : 'text-text-tertiary'}`} />
          <button
            onClick={toggleTheme}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-border-accent focus:ring-offset-2 ${
              isDark ? 'bg-blue-500' : 'bg-border-secondary'
            }`}
            aria-label="Toggle theme"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isDark ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <Moon className={`${sizeClasses[size]} ${isDark ? 'text-text-accent' : 'text-text-tertiary'}`} />
        </div>
      </div>
    );
  }

  if (variant === 'dropdown') {
    return (
      <div className="relative group">
        <button
          className={`${buttonSizeClasses[size]} rounded-lg bg-background-secondary border border-border-secondary hover:bg-surface-hover hover:border-border-primary transition-all duration-300 flex items-center space-x-2`}
          aria-label="Theme options"
        >
          {isDark ? (
            <Moon className={sizeClasses[size]} />
          ) : (
            <Sun className={sizeClasses[size]} />
          )}
          {showLabel && (
            <span className="text-sm font-medium text-text-primary capitalize">
              {theme}
            </span>
          )}
        </button>
        
        <div className="absolute right-0 top-full mt-2 w-32 bg-background-card border border-border-secondary rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
          <div className="py-2">
            <button
              onClick={setLightTheme}
              className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
            >
              <Sun className="w-4 h-4" />
              <span>Light</span>
            </button>
            <button
              onClick={setDarkTheme}
              className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
            >
              <Moon className="w-4 h-4" />
              <span>Dark</span>
            </button>
            <button
              className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
            >
              <Monitor className="w-4 h-4" />
              <span>System</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default button variant
  return (
    <button
      onClick={toggleTheme}
      className={`theme-toggle ${buttonSizeClasses[size]} group flex items-center space-x-2`}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
    >
      {isDark ? (
        <Sun className={`${sizeClasses[size]} text-text-secondary group-hover:text-text-accent transition-colors`} />
      ) : (
        <Moon className={`${sizeClasses[size]} text-text-secondary group-hover:text-text-accent transition-colors`} />
      )}
      {showLabel && (
        <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
          {isLight ? 'Dark' : 'Light'} Mode
        </span>
      )}
    </button>
  );
};

export default ThemeToggle;