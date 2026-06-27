import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface OAuthButtonProps {
  provider: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
}

const OAuthButton: React.FC<OAuthButtonProps> = ({ 
  provider, 
  icon: Icon, 
  onClick, 
  disabled = false 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full flex items-center justify-center space-x-3 px-6 py-4 rounded-xl
        bg-background-secondary backdrop-blur-2xl
        border-2 border-blue-500/40
        shadow-[0_0_20px_rgba(59,130,246,0.15),0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.3)]
        text-text-primary font-medium
        hover:bg-surface-hover hover:border-blue-500/60
        hover:shadow-[0_0_30px_rgba(59,130,246,0.25),0_12px_40px_rgba(0,0,0,0.15)]
        hover:scale-[1.02]
        focus:outline-none focus:ring-2 focus:ring-blue-500/50
        transition-all duration-300 group
        relative overflow-hidden
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-br before:from-blue-500/3 before:via-blue-600/2 before:to-purple-600/3
        after:absolute after:inset-[1px] after:rounded-[10px] after:bg-gradient-to-br after:from-white/2 after:to-transparent after:pointer-events-none
      `}
    >
      <Icon className="w-5 h-5 text-blue-400 group-hover:text-blue-300 transition-colors relative z-10" />
      <span className="font-medium relative z-10">Continue with {provider}</span>
    </button>
  );
};

export default OAuthButton;