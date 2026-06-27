import React from 'react';
import { Link } from 'react-router-dom';
import { Brain } from 'lucide-react';
import Card from '../ui/Card';
import Particles from '../ui/Particles';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen bg-background-primary text-text-primary flex items-center justify-center relative overflow-hidden">
      <Particles />
      
      {/* Background Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full filter blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full filter blur-3xl"></div>
      
      <div className="relative z-10 w-full max-w-md mx-auto px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-3 group">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Brain className="w-7 h-7 text-blue-400" />
            </div>
            <span className="text-xl font-bold">Sky Launchpad</span>
          </Link>
        </div>
        
        {/* Auth Card */}
        <Card variant="glass" className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">{title}</h1>
            <p className="text-text-secondary">{subtitle}</p>
          </div>
          
          {children}
        </Card>
        
        {/* Footer */}
        <div className="text-center mt-6 text-sm text-text-tertiary">
          <p>
            By continuing, you agree to our{' '}
            <Link to="/terms" className="text-blue-400 hover:text-blue-300 transition-colors">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-blue-400 hover:text-blue-300 transition-colors">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;