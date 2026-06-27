import React, { useState, useEffect } from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glass-dark' | 'glass-light' | 'glass' | 'gradient' | 'hero-glass';
  hover?: boolean;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  variant = 'default',
  hover = false,
  onClick
}) => {
  const isBenefitCard = className.includes('benefit-card');
  
  // Check if we're in light mode (check document class)
  const [isLightMode, setIsLightMode] = useState(false);
  
  useEffect(() => {
    const checkTheme = () => {
      setIsLightMode(document.documentElement.classList.contains('light'));
    };
    
    checkTheme();
    
    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });
    
    return () => observer.disconnect();
  }, []);
  
  const variantStyles = {
    default: isLightMode 
      ? '' // Light mode styles handled by glass-card-light class
      : 'bg-background-card dark:border dark:border-border-secondary',
    'glass-dark': isLightMode
      ? '' // Light mode styles handled by glass-card-light class
      : 'bg-background-glass backdrop-blur-xl dark:border dark:border-border-secondary/20 dark:group-hover:border-border-accent/30 dark:transition-all dark:duration-500',
    'glass-light': isLightMode
      ? '' // Light mode styles handled by glass-card-light class
      : 'bg-background-glass backdrop-blur-xl dark:border dark:border-border-secondary/20 dark:group-hover:border-border-accent/30 dark:transition-all dark:duration-500',
    glass: isLightMode
      ? '' // Light mode styles handled by glass-card-light class
      : 'bg-background-glass backdrop-blur-xl dark:border dark:border-border-secondary/20 dark:group-hover:border-border-accent/30 dark:transition-all dark:duration-500',
    gradient: isLightMode
      ? '' // Light mode styles handled by glass-card-light class
      : 'bg-gradient-to-br from-border-primary to-border-accent dark:border dark:border-border-secondary/20',
    'hero-glass': isLightMode
      ? '' // Light mode styles handled by glass-card-light class
      : 'bg-gradient-to-br from-hero-gradient-start via-hero-gradient-via to-hero-gradient-end backdrop-blur-xl dark:border dark:border-border-primary/20 dark:hover:border-border-primary/40 dark:transition-all dark:duration-300'
  };
  
  const baseStyles = 'rounded-xl p-8';
  const hoverStyles = hover 
    ? 'dark:hover:-translate-y-1 dark:hover:scale-105 dark:transition-all dark:duration-300'
    : '';
  const clickStyles = onClick ? 'cursor-pointer' : '';
  
  // Add glass-card class for light mode
  const lightModeClass = isLightMode ? 'glass-card-light' : '';
  
  return (
    <div 
      className={`group ${baseStyles} ${variantStyles[variant]} ${hoverStyles} ${clickStyles} ${lightModeClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;