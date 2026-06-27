import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Github } from 'lucide-react';
import Button from '../ui/Button';
import OAuthButton from './OAuthButton';
import { useAuth } from '../../hooks/useAuth';

const SignInForm: React.FC = () => {
  const navigate = useNavigate();
  const { mockSignIn } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rememberMe, setRememberMe] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock sign in with the provided email
      mockSignIn(formData.email);
      
      // Redirect to dashboard after successful sign in
      navigate('/dashboard');
    } catch (error) {
      console.error('Signin error:', error);
      setErrors({ general: 'Invalid email or password' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: string) => {
    setIsLoading(true);
    
    try {
      // Simulate OAuth signin
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock sign in with provider email
      const providerEmail = `demo.${provider}@skyrchitect.com`;
      mockSignIn(providerEmail);
      
      // Redirect to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('OAuth signin error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    setIsLoading(true);
    
    try {
      // Quick demo sign in
      await new Promise(resolve => setTimeout(resolve, 800));
      mockSignIn('demo@skyrchitect.com');
      navigate('/dashboard');
    } catch (error) {
      console.error('Demo signin error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Demo Access Banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-blue-400 mb-1">Demo Mode</h4>
            <p className="text-xs text-text-secondary">Try the app without creating an account</p>
          </div>
          <Button
            onClick={handleDemoSignIn}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
          >
            {isLoading ? 'Signing In...' : 'Quick Demo'}
          </Button>
        </div>
      </div>

      {/* OAuth Buttons */}
      <div className="space-y-3">
        <OAuthButton
          provider="Google"
          icon={Mail}
          onClick={() => handleOAuthSignIn('google')}
          disabled={isLoading}
        />
        <OAuthButton
          provider="GitHub"
          icon={Github}
          onClick={() => handleOAuthSignIn('github')}
          disabled={isLoading}
        />
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border-secondary"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-background-primary text-text-secondary">Or continue with email</span>
        </div>
      </div>

      {/* Email Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* General Error */}
        {errors.general && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{errors.general}</p>
          </div>
        )}

        {/* Email Field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-400" />
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              className={`
                w-full pl-10 pr-4 py-3 rounded-lg
                bg-background-secondary border-2 text-text-primary placeholder-text-tertiary
                focus:outline-none focus:ring-2 focus:ring-blue-500/50
                transition-all duration-300
                ${errors.email ? 'border-red-500/50' : 'border-blue-500/30 focus:border-blue-500/60'}
              `}
              placeholder="Enter your email"
              disabled={isLoading}
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email}</p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-2">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-400" />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleInputChange}
              className={`
                w-full pl-10 pr-12 py-3 rounded-lg
                bg-background-secondary border-2 text-text-primary placeholder-text-tertiary
                focus:outline-none focus:ring-2 focus:ring-blue-500/50
                transition-all duration-300
                ${errors.password ? 'border-red-500/50' : 'border-blue-500/30 focus:border-blue-500/60'}
              `}
              placeholder="Enter your password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-tertiary hover:text-blue-400 transition-colors"
              disabled={isLoading}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password}</p>
          )}
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-2 border-blue-500/30 bg-background-secondary text-blue-500 focus:ring-2 focus:ring-blue-500/50"
              disabled={isLoading}
            />
            <span className="text-sm text-text-secondary">Remember me</span>
          </label>
          
          <Link 
            to="/forgot-password" 
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors hover:underline relative z-50"
            style={{ 
              pointerEvents: 'auto',
              position: 'relative',
              zIndex: 9999
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Forgot password link clicked!');
              navigate('/forgot-password');
            }}
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
        </Button>
      </form>

      {/* Sign Up Link */}
      <div className="text-center relative z-50">
        <p className="text-text-secondary">
          Don't have an account?{' '}
          <Link 
            to="/signup" 
            className="text-blue-400 hover:text-blue-300 font-medium transition-all duration-300 hover:underline cursor-pointer relative z-50 inline-block"
            style={{ 
              textDecoration: 'none',
              pointerEvents: 'auto',
              position: 'relative',
              zIndex: 9999
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Sign up link clicked!');
              navigate('/signup');
            }}
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignInForm;