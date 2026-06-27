import React from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Hero from '../components/home/Hero';
import Features from '../components/home/Features';
import Roadmap from '../components/home/Roadmap';

const Home: React.FC = () => {
  return (
    <div className="min-h-screen text-text-primary relative">
      <Header />
      
      <main>
        <Hero />
        <Features />
        <Roadmap />
      </main>
      
      <Footer />
    </div>
  );
};

export default Home;