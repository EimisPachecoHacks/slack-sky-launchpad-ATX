import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  icon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  className = '',
  type = 'button',
  icon,
}) => {
  const baseStyles = 'flex items-center justify-center font-medium rounded-xl transition-all duration-300 relative overflow-hidden cursor-pointer border border-transparent';
  
  const variantStyles = {
    primary: 'bg-gradient-to-r from-border-primary to-border-accent text-white border-border-primary/30 shadow-[0_4px_12px] shadow-border-primary/20 hover:shadow-[0_8px_24px] hover:shadow-border-primary/30 hover:-translate-y-px light:shadow-[0_6px_16px] light:shadow-border-primary/15',
    secondary: 'bg-background-glass/90 text-text-primary border-border-secondary shadow-[0_2px_4px] shadow-black/5 hover:bg-surface-hover hover:shadow-[0_4px_8px] hover:shadow-black/10 hover:-translate-y-px light:shadow-[0_3px_8px] light:shadow-black/8',
    outline: 'bg-transparent text-text-primary border-border-secondary hover:bg-surface-hover hover:border-border-accent',
    ghost: 'bg-transparent text-text-primary hover:bg-surface-hover'
  };
  
  const sizeStyles = {
    sm: 'text-sm px-4 py-2',
    md: 'text-base px-6 py-3',
    lg: 'text-lg px-8 py-4'
  };
  
  const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed hover:transform-none hover:shadow-none' : '';
  
  return (
    <button
      type={type}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${disabledStyles} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="mr-2">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

export default Button;