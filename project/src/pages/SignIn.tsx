import React from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import SignInForm from '../components/auth/SignInForm';

const SignIn: React.FC = () => {
  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in to continue building amazing cloud architectures"
    >
      <SignInForm />
    </AuthLayout>
  );
};

export default SignIn;