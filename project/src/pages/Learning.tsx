import React from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Particles from '../components/ui/Particles';
import LearningPanel from '../components/learning/LearningPanel';
import { OPS_API } from '../config/opsApi';

const Learning: React.FC = () => {
  return (
    <div className="min-h-screen text-white">
      <Particles />
      <Header />

      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-center">
            How It Learned
          </h1>
          <p className="text-text-secondary text-center mb-8">
            Continual Learning — the system improves with every failure.
          </p>
          <LearningPanel apiBase={OPS_API} />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Learning;
