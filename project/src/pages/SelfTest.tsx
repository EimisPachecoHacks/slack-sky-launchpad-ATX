import React from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Particles from '../components/ui/Particles';
import SelfTestPanel from '../components/uitest/SelfTestPanel';
import { OPS_API, OPS_WS } from '../config/opsApi';

const SelfTest: React.FC = () => {
  return (
    <div className="min-h-screen text-white">
      <Particles />
      <Header />

      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-center">
            UI Self-Test
          </h1>
          <p className="text-text-secondary text-center mb-8">
            Playwright drives the live app; Qwen diagnoses and fixes UI bugs.
          </p>
          <SelfTestPanel apiBase={OPS_API} wsBase={OPS_WS} />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SelfTest;
