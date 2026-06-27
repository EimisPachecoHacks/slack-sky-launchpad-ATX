import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import Button from '../components/ui/Button';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [resendCount, setResendCount] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const [countdown, setCountdown] = useState(0);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      // Simulate API call to send reset email
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate different responses based on email
      if (email.toLowerCase().includes('invalid')) {
        throw new Error('No account found with this email address');
      }
      
      setIsSubmitted(true);
      setResendCount(prev => prev + 1);
      
      // Start countdown for resend
      if (resendCount >= 0) {
        setCanResend(false);
        setCountdown(60);
        
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              setCanResend(true);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
      
    } catch (error: any) {
      setError(error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = () => {
    if (canResend) {
      setIsSubmitted(false);
      handleSubmit(new Event('submit') as any);
    }
  };

  const handleTryDifferentEmail = () => {
    setIsSubmitted(false);
    setEmail('');
    setError('');
    setResendCount(0);
    setCanResend(true);
    setCountdown(0);
  };

  if (isSubmitted) {
    return (
      <AuthLayout
        title="Check Your Email"
        subtitle="We've sent a password reset link to your email address"
      >
        <div className="text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          
          <div className="space-y-2">
            <p className="text-gray-300">
              We've sent a password reset link to:
            </p>
            <p className="font-medium text-blue-400 break-all">{email}</p>
          </div>
          
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <h4 className="font-medium text-blue-400 mb-2">What's next?</h4>
            <ul className="text-sm text-gray-300 space-y-1 text-left">
              <li>• Check your email inbox for the reset link</li>
              <li>• Click the link to create a new password</li>
              <li>• The link will expire in 24 hours</li>
              <li>• Check your spam folder if you don't see it</li>
            </ul>
          </div>
          
          <div className="space-y-4">
            {/* Resend Email */}
            <div className="flex flex-col items-center space-y-2">
              <p className="text-sm text-gray-400">
                Didn't receive the email?
              </p>
              
              {canResend ? (
                <Button
                  onClick={handleResend}
                  variant="outline"
                  size="sm"
                  icon={<RefreshCw className="w-4 h-4" />}
                  disabled={isLoading}
                >
                  {isLoading ? 'Sending...' : 'Resend Email'}
                </Button>
              ) : (
                <div className="text-sm text-gray-500">
                  Resend available in {countdown}s
                </div>
              )}
              
              {resendCount > 0 && (
                <p className="text-xs text-gray-500">
                  Email sent {resendCount} time{resendCount > 1 ? 's' : ''}
                </p>
              )}
            </div>
            
            {/* Try Different Email */}
            <Button
              onClick={handleTryDifferentEmail}
              variant="ghost"
              size="sm"
            >
              Try Different Email
            </Button>
            
            {/* Back to Sign In */}
            <Link 
              to="/signin"
              className="inline-flex items-center space-x-2 text-blue-400 hover:text-blue-300 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset Your Password"
      subtitle="Enter your email address and we'll send you a reset link"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-red-400 font-medium">Error</p>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Email Input */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-400" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              className={`
                w-full pl-10 pr-4 py-3 rounded-lg
                bg-black/30 border-2 text-white placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-blue-500/50
                transition-all duration-300
                ${error ? 'border-red-500/50' : 'border-blue-500/30 focus:border-blue-500/60'}
              `}
              placeholder="Enter your email address"
              disabled={isLoading}
              autoComplete="email"
            />
          </div>
          
          {/* Email Validation Hint */}
          <div className="mt-2 text-xs text-gray-500">
            We'll send a secure reset link to this email address
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-blue-400 mb-1">Security Notice</h4>
              <ul className="text-xs text-gray-300 space-y-1">
                <li>• Reset links expire after 24 hours</li>
                <li>• Only the most recent link will be valid</li>
                <li>• We'll never ask for your password via email</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          disabled={isLoading || !email.trim()}
          icon={isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
        >
          {isLoading ? 'Sending Reset Link...' : 'Send Reset Link'}
        </Button>

        {/* Back to Sign In */}
        <div className="text-center">
          <Link 
            to="/signin"
            className="inline-flex items-center space-x-2 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Sign In</span>
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
};

export default ForgotPassword;