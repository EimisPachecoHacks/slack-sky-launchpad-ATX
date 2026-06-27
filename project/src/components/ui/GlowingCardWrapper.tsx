import React from 'react';

interface GlowingCardWrapperProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'blue-purple' | 'green' | 'red' | 'yellow' | 'purple';
}

const GlowingCardWrapper: React.FC<GlowingCardWrapperProps> = ({ 
  children, 
  className = '',
  glowColor = 'blue-purple'
}) => {
  const glowColors = {
    'blue-purple': 'from-blue-500 via-cyan-200 to-purple-400',
    'green': 'from-green-400 via-emerald-200 to-green-400',
    'red': 'from-red-400 via-pink-200 to-red-500',
    'yellow': 'from-yellow-400 via-amber-200 to-yellow-400',
    'purple': 'from-purple-400 via-violet-200 to-purple-400'
  };

  // Check if this is being used for benefit cards (check parent has benefit-card-wrapper class)
  const parentRef = React.useRef<HTMLDivElement>(null);
  const [isBenefitCard, setIsBenefitCard] = React.useState(false);
  
  React.useEffect(() => {
    if (parentRef.current?.parentElement?.classList.contains('benefit-card-wrapper')) {
      setIsBenefitCard(true);
    }
  }, []);

  // Check if we're in dark mode using matchMedia
  const [isDarkMode, setIsDarkMode] = React.useState(false);
  
  React.useEffect(() => {
    // Check if dark mode class is on the document
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    
    // Watch for changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);
  
  // In light mode, return children directly without ANY wrapper
  if (!isDarkMode) {
    return <>{children}</>;
  }
  
  // In dark mode, return the full glowing card structure
  return (
    <div ref={parentRef} className={`roadmap-card ${className}`}>
      <div className={`roadmap-glow bg-gradient-to-r ${glowColors[glowColor]}`}></div>
      <div className="roadmap-content" style={isBenefitCard ? { background: 'transparent' } : {}}>
        {children}
      </div>
    </div>
  );
};

export default GlowingCardWrapper;