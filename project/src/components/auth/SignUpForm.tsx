import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, Github } from 'lucide-react';
import Button from '../ui/Button';
import OAuthButton from './OAuthButton';
import { useAuth } from '../../hooks/useAuth';

const SignUpForm: React.FC = () => {
  const navigate = useNavigate();
  const { mockSignIn } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock sign up and immediate sign in
      mockSignIn(formData.email);
      
      // Redirect to dashboard after successful sign up
      navigate('/dashboard');
    } catch (error) {
      console.error('Signup error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignUp = async (provider: string) => {
    setIsLoading(true);
    
    try {
      // Simulate OAuth signup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock sign up with provider email
      const providerEmail = `demo.${provider}@skyrchitect.com`;
      mockSignIn(providerEmail);
      
      // Redirect to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('OAuth signup error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoSignUp = async () => {
    setIsLoading(true);
    
    try {
      // Quick demo sign up
      await new Promise(resolve => setTimeout(resolve, 800));
      mockSignIn('demo@skyrchitect.com');
      navigate('/dashboard');
    } catch (error) {
      console.error('Demo signup error:', error);
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
            onClick={handleDemoSignUp}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
          >
            {isLoading ? 'Creating Account...' : 'Quick Demo'}
          </Button>
        </div>
      </div>

      {/* OAuth Buttons */}
      <div className="space-y-3">
        <OAuthButton
          provider="Google"
          icon={Mail}
          onClick={() => handleOAuthSignUp('google')}
          disabled={isLoading}
        />
        <OAuthButton
          provider="GitHub"
          icon={Github}
          onClick={() => handleOAuthSignUp('github')}
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
        {/* Name Field */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-2">
            Full Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-400" />
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleInputChange}
              className={`
                w-full pl-10 pr-4 py-3 rounded-lg
                bg-background-secondary border-2 text-text-primary placeholder-text-tertiary
                focus:outline-none focus:ring-2 focus:ring-blue-500/50
                transition-all duration-300
                ${errors.name ? 'border-red-500/50' : 'border-blue-500/30 focus:border-blue-500/60'}
              `}
              placeholder="Enter your full name"
              disabled={isLoading}
            />
          </div>
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

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
              placeholder="Create a password"
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

        {/* Confirm Password Field */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-secondary mb-2">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-400" />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={handleInputChange}
              className={`
                w-full pl-10 pr-12 py-3 rounded-lg
                bg-background-secondary border-2 text-text-primary placeholder-text-tertiary
                focus:outline-none focus:ring-2 focus:ring-blue-500/50
                transition-all duration-300
                ${errors.confirmPassword ? 'border-red-500/50' : 'border-blue-500/30 focus:border-blue-500/60'}
              `}
              placeholder="Confirm your password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-tertiary hover:text-blue-400 transition-colors"
              disabled={isLoading}
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </Button>
      </form>

      {/* Sign In Link */}
      <div className="text-center relative z-50">
        <p className="text-text-secondary">
          Already have an account?{' '}
          <Link 
            to="/signin" 
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
              console.log('Sign in link clicked!');
              navigate('/signin');
            }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignUpForm;