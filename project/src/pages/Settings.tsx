import React from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import CloudSettings from '../components/settings/CloudSettings';

const Settings: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow">
        <CloudSettings />
      </main>
      <Footer />
    </div>
  );
};

export default Settings;
