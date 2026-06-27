import React from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import SignUpForm from '../components/auth/SignUpForm';

const SignUp: React.FC = () => {
  return (
    <AuthLayout
      title="Create Your Account"
      subtitle="Join thousands of architects building the future of cloud infrastructure"
    >
      <SignUpForm />
    </AuthLayout>
  );
};

export default SignUp;